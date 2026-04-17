import fs from "node:fs/promises";
import path from "node:path";
import { shell } from "electron";
import type {
  AuthorizedDirectory,
  BrowseFilesInput,
  FileExplorerData,
  FileItem,
} from "../../shared/types";
import { ensureAllowedPath } from "../utils/pathSafety";
import { hashFile } from "../utils/fileHash";

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);
const PDF_EXTENSIONS = new Set([".pdf"]);
const HIDDEN_FILE_NAMES = new Set([".ds_store", "thumbs.db", "desktop.ini"]);
const SKIPPED_DIRECTORY_NAMES = new Set([
  ".git",
  ".hg",
  ".svn",
  "node_modules",
  "__macosx",
]);
const PACKAGE_DIRECTORY_EXTENSIONS = new Set([
  ".app",
  ".bundle",
  ".framework",
  ".pkg",
  ".rtfd",
  ".photoslibrary",
  ".nib",
]);

type DuplicateCandidate = {
  hash: string;
  files: FileItem[];
};

const fileToItem = async (
  filePath: string,
  directoryName?: string,
): Promise<FileItem> => {
  const stats = await fs.stat(filePath);
  return {
    name: path.basename(filePath),
    path: filePath,
    extension: path.extname(filePath).toLowerCase(),
    size: stats.size,
    modifiedAt: stats.mtime.toISOString(),
    isDirectory: stats.isDirectory(),
    directoryName,
  };
};

const isHiddenOrSystemName = (name: string) => {
  const normalizedName = name.trim().toLowerCase();
  return normalizedName.startsWith(".") || HIDDEN_FILE_NAMES.has(normalizedName);
};

const shouldSkipDirectory = (name: string) => {
  const normalizedName = name.trim().toLowerCase();
  return (
    isHiddenOrSystemName(name) ||
    SKIPPED_DIRECTORY_NAMES.has(normalizedName) ||
    PACKAGE_DIRECTORY_EXTENSIONS.has(path.extname(normalizedName))
  );
};

export class FileService {
  async browseAuthorizedFiles(
    directories: AuthorizedDirectory[],
    input: BrowseFilesInput = {},
  ): Promise<FileExplorerData> {
    const scopedDirectories = input.directoryId
      ? directories.filter((directory) => directory.id === input.directoryId)
      : directories;

    const files = await this.scanMany(scopedDirectories, {
      query: input.query,
      extension: input.extension,
      limit: input.limit ?? 180,
    });

    return {
      directories,
      files,
      scannedAt: new Date().toISOString(),
    };
  }

  async getTopLevelFiles(directory: AuthorizedDirectory, limit = 60) {
    const entries = await fs.readdir(directory.path, { withFileTypes: true });
    const files = await Promise.all(
      entries
        .filter((entry) => entry.isFile() && !isHiddenOrSystemName(entry.name))
        .slice(0, limit)
        .map((entry) => fileToItem(path.join(directory.path, entry.name), directory.name)),
    );

    return files;
  }

  async getFilesByExtension(
    directories: AuthorizedDirectory[],
    extensions: string[],
    limit = 40,
  ) {
    return this.scanMany(directories, {
      extension: extensions.join(","),
      limit,
    });
  }

  async getRecentFiles(directories: AuthorizedDirectory[], limit = 40) {
    const files = await this.scanMany(directories, { limit: limit * 3 });
    return files
      .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt))
      .slice(0, limit);
  }

  async detectDuplicates(directories: AuthorizedDirectory[], limit = 30) {
    const files = await this.scanMany(directories, { limit: 250 });
    const grouped = new Map<string, FileItem[]>();

    for (const file of files.filter((entry) => !entry.isDirectory)) {
      const key = `${file.name}-${file.size}`;
      const current = grouped.get(key) ?? [];
      current.push(file);
      grouped.set(key, current);
    }

    const candidates = Array.from(grouped.values())
      .filter((entries) => entries.length > 1)
      .slice(0, limit);

    const verified: DuplicateCandidate[] = [];

    for (const candidate of candidates) {
      const hashed = await Promise.all(
        candidate.map(async (file) => ({
          file,
          hash: await hashFile(file.path),
        })),
      );

      const byHash = new Map<string, FileItem[]>();
      for (const item of hashed) {
        const current = byHash.get(item.hash) ?? [];
        current.push(item.file);
        byHash.set(item.hash, current);
      }

      for (const [hash, filesWithSameHash] of byHash.entries()) {
        if (filesWithSameHash.length > 1) {
          verified.push({ hash, files: filesWithSameHash });
        }
      }
    }

    return verified;
  }

  async moveFiles(
    files: FileItem[],
    destinationDirectory: string,
    allowedPaths: string[],
  ) {
    ensureAllowedPath(destinationDirectory, allowedPaths, "Movimentação");
    await fs.mkdir(destinationDirectory, { recursive: true });

    const movedFiles: FileItem[] = [];

    for (const file of files) {
      ensureAllowedPath(file.path, allowedPaths, "Movimentação");

      const targetPath = await this.resolveUniquePath(
        path.join(destinationDirectory, file.name),
      );
      await fs.rename(file.path, targetPath);
      movedFiles.push(await fileToItem(targetPath));
    }

    return movedFiles;
  }

  async renameFiles(
    files: FileItem[],
    allowedPaths: string[],
    labelPrefix: string,
  ) {
    const renamedFiles: FileItem[] = [];
    const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");

    for (const [index, file] of files.entries()) {
      ensureAllowedPath(file.path, allowedPaths, "Renomeação");

      const directoryPath = path.dirname(file.path);
      const extension = file.extension || "";
      const targetName = `${stamp}-${labelPrefix}-${String(index + 1).padStart(2, "0")}${extension}`;
      const targetPath = await this.resolveUniquePath(
        path.join(directoryPath, targetName),
      );

      await fs.rename(file.path, targetPath);
      renamedFiles.push(await fileToItem(targetPath));
    }

    return renamedFiles;
  }

  async renameSingleFile(
    filePath: string,
    newName: string,
    allowedPaths: string[],
  ): Promise<FileItem> {
    ensureAllowedPath(filePath, allowedPaths, "Renomeação");
    const dir = path.dirname(filePath);
    const targetPath = await this.resolveUniquePath(path.join(dir, newName));
    await fs.rename(filePath, targetPath);
    return fileToItem(targetPath);
  }

  async moveSingleFile(
    filePath: string,
    destDirPath: string,
    allowedPaths: string[],
  ): Promise<FileItem> {
    ensureAllowedPath(filePath, allowedPaths, "Movimentação");
    ensureAllowedPath(destDirPath, allowedPaths, "Movimentação");
    await fs.mkdir(destDirPath, { recursive: true });
    const targetPath = await this.resolveUniquePath(
      path.join(destDirPath, path.basename(filePath)),
    );
    await fs.rename(filePath, targetPath);
    return fileToItem(targetPath);
  }

  async deleteSingleFile(filePath: string, allowedPaths: string[]): Promise<void> {
    ensureAllowedPath(filePath, allowedPaths, "Exclusão");
    try {
      await shell.trashItem(filePath);
    } catch (error) {
      await fs.rm(filePath, { recursive: true, force: true });
    }
  }

  async createDirectory(
    destinationDirectory: string,
    allowedPaths: string[],
  ) {
    ensureAllowedPath(destinationDirectory, allowedPaths, "Criação de pasta");
    await fs.mkdir(destinationDirectory, { recursive: true });
    return destinationDirectory;
  }

  async openFile(filePath: string, allowedPaths: string[]): Promise<void> {
    ensureAllowedPath(filePath, allowedPaths, "Abertura");

    const stats = await fs.stat(filePath);
    if (!stats.isFile()) {
      throw new Error("O caminho informado não é um arquivo.");
    }

    const openError = await shell.openPath(filePath);
    if (openError) {
      throw new Error(openError);
    }
  }

  private async scanMany(
    directories: AuthorizedDirectory[],
    filters: {
      query?: string;
      extension?: string;
      limit: number;
    },
  ) {
    const extensions = new Set(
      (filters.extension ?? "")
        .split(",")
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean)
        .map((entry) => (entry.startsWith(".") ? entry : `.${entry}`)),
    );

    const results: FileItem[] = [];

    for (const directory of directories) {
      await this.scanDirectory(directory.path, directory.name, results, {
        query: filters.query,
        extensions,
        limit: filters.limit,
      });

      if (results.length >= filters.limit) {
        break;
      }
    }

    return results
      .filter((file) => !file.isDirectory)
      .slice(0, filters.limit);
  }

  private async scanDirectory(
    directoryPath: string,
    directoryName: string,
    collector: FileItem[],
    filters: {
      query?: string;
      extensions: Set<string>;
      limit: number;
    },
  ) {
    if (collector.length >= filters.limit) {
      return;
    }

    const entries = await fs.readdir(directoryPath, { withFileTypes: true });

    for (const entry of entries) {
      if (collector.length >= filters.limit) {
        return;
      }

      if (entry.isDirectory() && shouldSkipDirectory(entry.name)) {
        continue;
      }

      if (entry.isFile() && isHiddenOrSystemName(entry.name)) {
        continue;
      }

      const absolutePath = path.join(directoryPath, entry.name);
      const item = await fileToItem(absolutePath, directoryName);

      if (item.isDirectory) {
        await this.scanDirectory(absolutePath, directoryName, collector, filters);
        continue;
      }

      if (filters.query && !item.name.toLowerCase().includes(filters.query.toLowerCase())) {
        continue;
      }

      if (
        filters.extensions.size > 0 &&
        !filters.extensions.has(item.extension.toLowerCase())
      ) {
        continue;
      }

      collector.push(item);
    }
  }

  async categorizeTopLevelFiles(directory: AuthorizedDirectory) {
    const files = await this.getTopLevelFiles(directory, 120);

    return files.map((file) => {
      const category = PDF_EXTENSIONS.has(file.extension)
        ? "PDFs"
        : IMAGE_EXTENSIONS.has(file.extension)
          ? "Imagens"
          : [".doc", ".docx", ".txt", ".rtf"].includes(file.extension)
            ? "Documentos"
            : "Outros";

      return {
        file,
        destinationDirectory: path.join(directory.path, category),
      };
    });
  }

  async resolveUniquePath(candidatePath: string) {
    const directoryPath = path.dirname(candidatePath);
    const extension = path.extname(candidatePath);
    const baseName = path.basename(candidatePath, extension);

    let index = 1;
    let currentPath = candidatePath;

    while (true) {
      try {
        await fs.access(currentPath);
        currentPath = path.join(
          directoryPath,
          `${baseName}-${String(index).padStart(2, "0")}${extension}`,
        );
        index += 1;
      } catch {
        return currentPath;
      }
    }
  }
}
