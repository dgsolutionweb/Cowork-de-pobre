import type Database from "better-sqlite3";
import type { ProjectRun } from "../../shared/types";

interface Row {
  id: string;
  project_id: string;
  type: string;
  status: string;
  input: string | null;
  output: string | null;
  created_at: string;
  updated_at: string;
}

const mapRow = (row: Row): ProjectRun => ({
  id: row.id,
  projectId: row.project_id,
  type: row.type,
  status: row.status as ProjectRun["status"],
  input: row.input ?? undefined,
  output: row.output ?? undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export class ProjectRunsRepository {
  constructor(private readonly db: Database.Database) {}

  listByProject(projectId: string): ProjectRun[] {
    const rows = this.db
      .prepare("SELECT * FROM project_runs WHERE project_id = ? ORDER BY created_at DESC")
      .all(projectId) as Row[];

    return rows.map(mapRow);
  }

  get(id: string): ProjectRun | null {
    const row = this.db.prepare("SELECT * FROM project_runs WHERE id = ?").get(id) as Row | undefined;
    return row ? mapRow(row) : null;
  }

  insert(run: ProjectRun) {
    this.db
      .prepare(
        `INSERT INTO project_runs (
          id, project_id, type, status, input, output, created_at, updated_at
        ) VALUES (
          @id, @project_id, @type, @status, @input, @output, @created_at, @updated_at
        )`,
      )
      .run({
        id: run.id,
        project_id: run.projectId,
        type: run.type,
        status: run.status,
        input: run.input ?? null,
        output: run.output ?? null,
        created_at: run.createdAt,
        updated_at: run.updatedAt,
      });

    return run;
  }

  update(id: string, fields: Partial<Pick<ProjectRun, "status" | "output" | "updated_at">>) {
    const sets: string[] = [];
    const params: any[] = [];

    if (fields.status) {
      sets.push("status = ?");
      params.push(fields.status);
    }
    if (fields.output !== undefined) {
      sets.push("output = ?");
      params.push(fields.output);
    }
    
    sets.push("updated_at = ?");
    params.push(fields.updated_at || new Date().toISOString());

    params.push(id);

    this.db.prepare(`UPDATE project_runs SET ${sets.join(", ")} WHERE id = ?`).run(...params);
  }
}
