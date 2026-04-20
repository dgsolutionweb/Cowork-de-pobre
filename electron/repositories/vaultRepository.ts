import type Database from "better-sqlite3";
import type { VaultEntry, VaultEntryStatus } from "../../shared/types";

interface Row {
  id: string;
  original_path: string;
  original_name: string;
  vault_path: string;
  size: number;
  deleted_at: string;
  status: string;
}

export class VaultRepository {
  constructor(private readonly db: Database.Database) {}

  list(): VaultEntry[] {
    const rows = this.db
      .prepare("SELECT * FROM vault_entries WHERE status = 'available' ORDER BY deleted_at DESC LIMIT 100")
      .all() as Row[];
    return rows.map(this.toEntry);
  }

  insert(entry: VaultEntry): void {
    this.db.prepare(
      `INSERT INTO vault_entries (id, original_path, original_name, vault_path, size, deleted_at, status)
       VALUES (@id, @original_path, @original_name, @vault_path, @size, @deleted_at, @status)`,
    ).run({
      id: entry.id,
      original_path: entry.originalPath,
      original_name: entry.originalName,
      vault_path: entry.vaultPath,
      size: entry.size,
      deleted_at: entry.deletedAt,
      status: entry.status,
    });
  }

  updateStatus(id: string, status: VaultEntryStatus): void {
    this.db.prepare("UPDATE vault_entries SET status = ? WHERE id = ?").run(status, id);
  }

  getById(id: string): VaultEntry | null {
    const row = this.db.prepare("SELECT * FROM vault_entries WHERE id = ?").get(id) as Row | undefined;
    return row ? this.toEntry(row) : null;
  }

  deleteAll(): number {
    const result = this.db.prepare("UPDATE vault_entries SET status = 'purged' WHERE status = 'available'").run();
    return result.changes;
  }

  private toEntry(row: Row): VaultEntry {
    return {
      id: row.id,
      originalPath: row.original_path,
      originalName: row.original_name,
      vaultPath: row.vault_path,
      size: row.size,
      deletedAt: row.deleted_at,
      status: row.status as VaultEntryStatus,
    };
  }
}
