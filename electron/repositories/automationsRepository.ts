import type Database from "better-sqlite3";
import type { Automation } from "../../shared/types";

interface Row {
  id: string;
  project_id: string | null;
  name: string;
  description: string;
  command_text: string;
  schedule: string;
  enabled: number;
  last_run_at: string | null;
  last_status: string | null;
  created_at: string;
}

export class AutomationsRepository {
  constructor(private readonly db: Database.Database) {}

  list(projectId?: string): Automation[] {
    let query = "SELECT * FROM automations";
    const params: any[] = [];

    if (projectId) {
      query += " WHERE project_id = ?";
      params.push(projectId);
    }

    query += " ORDER BY created_at DESC";

    const rows = this.db.prepare(query).all(...params) as Row[];

    return rows.map((row) => ({
      id: row.id,
      projectId: row.project_id ?? undefined,
      name: row.name,
      description: row.description,
      commandText: row.command_text,
      schedule: row.schedule,
      enabled: Boolean(row.enabled),
      lastRunAt: row.last_run_at ?? undefined,
      lastStatus: (row.last_status as Automation["lastStatus"]) ?? undefined,
      createdAt: row.created_at,
    }));
  }

  insert(automation: Automation) {
    this.db
      .prepare(
        `
          INSERT INTO automations (
            id, project_id, name, description, command_text, schedule, enabled,
            last_run_at, last_status, created_at
          ) VALUES (
            @id, @project_id, @name, @description, @command_text, @schedule, @enabled,
            @last_run_at, @last_status, @created_at
          )
        `,
      )
      .run({
        id: automation.id,
        project_id: automation.projectId ?? null,
        name: automation.name,
        description: automation.description,
        command_text: automation.commandText,
        schedule: automation.schedule,
        enabled: automation.enabled ? 1 : 0,
        last_run_at: automation.lastRunAt ?? null,
        last_status: automation.lastStatus ?? null,
        created_at: automation.createdAt,
      });

    return automation;
  }

  updateState(id: string, enabled: boolean) {
    this.db
      .prepare("UPDATE automations SET enabled = ? WHERE id = ?")
      .run(enabled ? 1 : 0, id);
  }

  updateLastRun(id: string, lastRunAt: string, lastStatus: Automation["lastStatus"]) {
    this.db
      .prepare(
        "UPDATE automations SET last_run_at = ?, last_status = ? WHERE id = ?",
      )
      .run(lastRunAt, lastStatus ?? null, id);
  }

  update(
    id: string,
    fields: Partial<Pick<Automation, "name" | "description" | "commandText" | "schedule" | "enabled">>,
  ) {
    if (fields.name !== undefined)
      this.db.prepare("UPDATE automations SET name = ? WHERE id = ?").run(fields.name, id);
    if (fields.description !== undefined)
      this.db.prepare("UPDATE automations SET description = ? WHERE id = ?").run(fields.description, id);
    if (fields.commandText !== undefined)
      this.db.prepare("UPDATE automations SET command_text = ? WHERE id = ?").run(fields.commandText, id);
    if (fields.schedule !== undefined)
      this.db.prepare("UPDATE automations SET schedule = ? WHERE id = ?").run(fields.schedule, id);
    if (fields.enabled !== undefined)
      this.db.prepare("UPDATE automations SET enabled = ? WHERE id = ?").run(fields.enabled ? 1 : 0, id);
  }

  delete(id: string) {
    this.db.prepare("DELETE FROM automations WHERE id = ?").run(id);
  }
}
