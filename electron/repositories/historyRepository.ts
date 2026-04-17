import type Database from "better-sqlite3";
import type { FileItem, HistoryEntry } from "../../shared/types";

interface Row {
  id: string;
  command_text: string;
  intent: string;
  status: string;
  confirmed: number;
  summary: string;
  affected_files_json: string;
  error_message: string | null;
  created_at: string;
  executed_at: string | null;
}

export class HistoryRepository {
  constructor(private readonly db: Database.Database) {}

  list(): HistoryEntry[] {
    const rows = this.db
      .prepare("SELECT * FROM task_history ORDER BY created_at DESC LIMIT 30")
      .all() as Row[];

    return rows.map((row) => ({
      id: row.id,
      commandText: row.command_text,
      intent: row.intent as HistoryEntry["intent"],
      status: row.status as HistoryEntry["status"],
      confirmed: Boolean(row.confirmed),
      summary: row.summary,
      affectedFiles: JSON.parse(row.affected_files_json) as FileItem[],
      errorMessage: row.error_message ?? undefined,
      createdAt: row.created_at,
      executedAt: row.executed_at ?? undefined,
    }));
  }

  insert(entry: HistoryEntry) {
    this.db
      .prepare(
        `
          INSERT INTO task_history (
            id, command_text, intent, status, confirmed, summary,
            affected_files_json, error_message, created_at, executed_at
          ) VALUES (
            @id, @command_text, @intent, @status, @confirmed, @summary,
            @affected_files_json, @error_message, @created_at, @executed_at
          )
        `,
      )
      .run({
        id: entry.id,
        command_text: entry.commandText,
        intent: entry.intent,
        status: entry.status,
        confirmed: entry.confirmed ? 1 : 0,
        summary: entry.summary,
        affected_files_json: JSON.stringify(entry.affectedFiles),
        error_message: entry.errorMessage ?? null,
        created_at: entry.createdAt,
        executed_at: entry.executedAt ?? null,
      });

    return entry;
  }
}
