import fs from "node:fs/promises";
import path from "node:path";
import { createId } from "../utils/id";
import { hashFile } from "../utils/fileHash";
import { ProjectFileIndexRepository } from "../repositories/projectFileIndexRepository";
import { ProjectChunksRepository } from "../repositories/projectChunksRepository";
import { DocumentService } from "./documentService";

const SUPPORTED_EXTENSIONS = new Set([".md", ".txt", ".pdf", ".docx", ".csv"]);

export class ProjectIndexingService {
  constructor(
    private readonly fileIndexRepository: ProjectFileIndexRepository,
    private readonly chunksRepository: ProjectChunksRepository,
    private readonly documentService: DocumentService,
  ) {}

  async indexProject(projectId: string, rootPath: string) {
    const files = await this.scanDirectory(rootPath);
    
    for (const filePath of files) {
      await this.indexFile(projectId, filePath);
    }
  }

  async indexFile(projectId: string, filePath: string) {
    const ext = path.extname(filePath).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.has(ext)) return;

    try {
      const stats = await fs.stat(filePath);
      const hash = await hashFile(filePath);
      const existing = this.fileIndexRepository.getByPath(projectId, filePath);

      if (existing && existing.hash === hash) {
        return; // Already indexed and unchanged
      }

      // Read and chunk
      const document = await this.documentService.readDocument(filePath, [path.dirname(filePath)]);
      const chunks = this.chunkText(document.markdownContent);

      // Update DB
      this.chunksRepository.deleteByFile(projectId, filePath);
      this.chunksRepository.insertMany(
        chunks.map((content) => ({
          project_id: projectId,
          file_path: filePath,
          content,
        })),
      );

      this.fileIndexRepository.upsert({
        id: createId(),
        projectId,
        filePath,
        lastIndexedAt: new Date().toISOString(),
        hash,
      });
    } catch (error) {
      console.error(`Failed to index file ${filePath}:`, error);
    }
  }

  async search(projectId: string, query: string, limit = 5) {
    return this.chunksRepository.search(projectId, query, limit);
  }

  private async scanDirectory(dir: string): Promise<string[]> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "dist") continue;
        files.push(...(await this.scanDirectory(fullPath)));
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }

    return files;
  }

  private chunkText(text: string, size = 1000, overlap = 200): string[] {
    const chunks: string[] = [];
    if (!text) return chunks;

    let start = 0;
    while (start < text.length) {
      let end = start + size;
      
      // Try to find a good break point (newline or period)
      if (end < text.length) {
        const nextNewline = text.indexOf("\n", end - 50);
        if (nextNewline !== -1 && nextNewline < end + 50) {
          end = nextNewline + 1;
        } else {
          const nextPeriod = text.indexOf(". ", end - 50);
          if (nextPeriod !== -1 && nextPeriod < end + 50) {
            end = nextPeriod + 2;
          }
        }
      }

      chunks.push(text.slice(start, end).trim());
      start = end - overlap;
      if (start < 0) start = 0;
      if (start >= text.length || end >= text.length) break;
    }

    return chunks.filter(Boolean);
  }
}
