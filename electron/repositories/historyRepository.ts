import type Database from "better-sqlite3";
import type { FileItem, HistoryEntry } from "../../shared/types";

interface Row {
  id: string;
  project_id: string | null;
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

  list(projectId?: string): HistoryEntry[] {
    let query = "SELECT * FROM task_history";
    const params: any[] = [];

    if (projectId) {
      query += " WHERE project_id = ?";
      params.push(projectId);
    }

    query += " ORDER BY created_at DESC LIMIT 30";

    const rows = this.db.prepare(query).all(...params) as Row[];

    return rows.map((row) => ({
      id: row.id,
      projectId: row.project_id ?? undefined,
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
            id, project_id, command_text, intent, status, confirmed, summary,
            affected_files_json, error_message, created_at, executed_at
          ) VALUES (
            @id, @project_id, @command_text, @intent, @status, @confirmed, @summary,
            @affected_files_json, @error_message, @created_at, @executed_at
          )
        `,
      )
      .run({
        id: entry.id,
        project_id: entry.projectId ?? null,
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
