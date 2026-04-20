import type Database from "better-sqlite3";
import type { ErrorLogEntry, ErrorSource } from "../../shared/types";

interface Row {
  id: string;
  source: string;
  message: string;
  stack: string | null;
  context: string | null;
  created_at: string;
}

export class ErrorLogRepository {
  constructor(private readonly db: Database.Database) {}

  list(): ErrorLogEntry[] {
    const rows = this.db
      .prepare("SELECT * FROM error_logs ORDER BY created_at DESC LIMIT 200")
      .all() as Row[];
    return rows.map((row) => ({
      id: row.id,
      source: row.source as ErrorSource,
      message: row.message,
      stack: row.stack ?? undefined,
      context: row.context ?? undefined,
      createdAt: row.created_at,
    }));
  }

  insert(entry: ErrorLogEntry): void {
    this.db.prepare(
      `INSERT INTO error_logs (id, source, message, stack, context, created_at)
       VALUES (@id, @source, @message, @stack, @context, @created_at)`,
    ).run({
      id: entry.id,
      source: entry.source,
      message: entry.message,
      stack: entry.stack ?? null,
      context: entry.context ?? null,
      created_at: entry.createdAt,
    });
  }

  clear(): void {
    this.db.prepare("DELETE FROM error_logs").run();
  }
}
