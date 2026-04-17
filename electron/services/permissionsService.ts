import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { BrowserWindow } from "electron";
import { dialog } from "electron";
import type { AuthorizedDirectory } from "../../shared/types";
import { createId } from "../utils/id";
import { labelFromPath, normalizePath } from "../utils/pathSafety";
import { AuthorizedDirectoriesRepository } from "../repositories/authorizedDirectoriesRepository";

export class PermissionsService {
  constructor(
    private readonly repository: AuthorizedDirectoriesRepository,
  ) {}

  ensureStarterDirectories() {
    const current = this.repository.list();
    if (current.length > 0) {
      return current;
    }

    const starterDirectories = ["Desktop", "Downloads", "Documents"]
      .map((name) => path.join(os.homedir(), name))
      .filter((candidate) => fs.existsSync(candidate));

    for (const candidate of starterDirectories) {
      const createdAt = new Date().toISOString();
      this.repository.insert({
        id: createId(),
        name: labelFromPath(candidate),
        path: normalizePath(candidate),
        createdAt,
      });
    }

    return this.repository.list();
  }

  list() {
    return this.repository.list();
  }

  add(directoryPath: string, label?: string) {
    const normalizedPath = normalizePath(directoryPath);

    const existing = this.repository
      .list()
      .find((directory) => directory.path === normalizedPath);

    if (existing) {
      return existing;
    }

    const directory: AuthorizedDirectory = {
      id: createId(),
      name: label ?? labelFromPath(normalizedPath),
      path: normalizedPath,
      createdAt: new Date().toISOString(),
    };

    return this.repository.insert(directory);
  }

  async pick(window: BrowserWindow) {
    const result = await dialog.showOpenDialog(window, {
      title: "Adicionar pasta autorizada",
      properties: ["openDirectory"],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return this.add(result.filePaths[0]);
  }

  remove(id: string) {
    this.repository.remove(id);
  }
}
