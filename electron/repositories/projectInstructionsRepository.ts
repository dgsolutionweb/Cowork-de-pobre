import type Database from "better-sqlite3";
import type { ProjectInstruction, ProjectInstructionScope } from "../../shared/types";

interface Row {
  id: string;
  project_id: string;
  scope: string;
  path: string;
  content: string;
  updated_at: string;
}

const mapRow = (row: Row): ProjectInstruction => ({
  id: row.id,
  projectId: row.project_id,
  scope: row.scope as ProjectInstructionScope,
  path: row.path || undefined,
  content: row.content,
  updatedAt: row.updated_at,
});

export class ProjectInstructionsRepository {
  constructor(private readonly db: Database.Database) {}

  listByProject(projectId: string): ProjectInstruction[] {
    const rows = this.db
      .prepare("SELECT * FROM project_instructions WHERE project_id = ? ORDER BY scope, path")
      .all(projectId) as Row[];

    return rows.map(mapRow);
  }

  upsert(instruction: ProjectInstruction) {
    this.db
      .prepare(
        `INSERT INTO project_instructions (
          id, project_id, scope, path, content, updated_at
        ) VALUES (
          @id, @project_id, @scope, @path, @content, @updated_at
        )
        ON CONFLICT(project_id, scope, path)
        DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at`,
      )
      .run({
        id: instruction.id,
        project_id: instruction.projectId,
        scope: instruction.scope,
        path: instruction.path ?? "",
        content: instruction.content,
        updated_at: instruction.updatedAt,
      });

    const row = this.db
      .prepare(
        "SELECT * FROM project_instructions WHERE project_id = ? AND scope = ? AND path = ?",
      )
      .get(instruction.projectId, instruction.scope, instruction.path ?? "") as Row;

    return mapRow(row);
  }
}
