import fs from "node:fs/promises";
import path from "node:path";
import { app } from "electron";
import type { VaultEntry } from "../../shared/types";
import { VaultRepository } from "../repositories/vaultRepository";
import { createId } from "../utils/id";

export class VaultService {
  private vaultDir: string;

  constructor(private readonly repository: VaultRepository) {
    const userData = app.isReady()
      ? app.getPath("userData")
      : path.resolve(process.cwd(), ".cowork-data");
    this.vaultDir = path.join(userData, "vault");
  }

  async ensureVaultDir(): Promise<void> {
    await fs.mkdir(this.vaultDir, { recursive: true });
  }

  async moveToVault(filePath: string): Promise<VaultEntry> {
    await this.ensureVaultDir();

    const name = path.basename(filePath);
    const ext = path.extname(name);
    const base = path.basename(name, ext);
    const stamp = Date.now();
    const vaultName = `${base}_${stamp}${ext}`;
    const vaultPath = path.join(this.vaultDir, vaultName);

    await fs.rename(filePath, vaultPath);

    const stats = await fs.stat(vaultPath);
    const entry: VaultEntry = {
      id: createId(),
      originalPath: filePath,
      originalName: name,
      vaultPath,
      size: stats.size,
      deletedAt: new Date().toISOString(),
      status: "available",
    };

    this.repository.insert(entry);
    return entry;
  }

  list(): VaultEntry[] {
    return this.repository.list();
  }

  async restore(id: string): Promise<VaultEntry> {
    const entry = this.repository.getById(id);
    if (!entry) throw new Error("Item não encontrado no vault.");
    if (entry.status !== "available") throw new Error("Item já restaurado ou purgado.");

    await fs.mkdir(path.dirname(entry.originalPath), { recursive: true });
    await fs.rename(entry.vaultPath, entry.originalPath);

    this.repository.updateStatus(id, "restored");
    return { ...entry, status: "restored" };
  }

  async purge(id: string): Promise<void> {
    const entry = this.repository.getById(id);
    if (!entry) throw new Error("Item não encontrado.");

    try {
      await fs.rm(entry.vaultPath, { force: true });
    } catch {}

    this.repository.updateStatus(id, "purged");
  }

  async purgeAll(): Promise<{ purged: number }> {
    const entries = this.repository.list();
    let purged = 0;

    for (const entry of entries) {
      try {
        await fs.rm(entry.vaultPath, { force: true });
        purged++;
      } catch {}
    }

    this.repository.deleteAll();
    return { purged };
  }
}
