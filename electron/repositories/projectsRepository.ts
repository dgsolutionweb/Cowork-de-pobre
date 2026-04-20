import type Database from "better-sqlite3";
import type { ProjectStatus, ProjectSummary } from "../../shared/types";

interface Row {
  id: string;
  name: string;
  root_path: string;
  status: string;
  created_at: string;
  updated_at: string;
  last_opened_at: string | null;
}

const mapRow = (row: Row): ProjectSummary => ({
  id: row.id,
  name: row.name,
  rootPath: row.root_path,
  status: row.status as ProjectStatus,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  lastOpenedAt: row.last_opened_at ?? undefined,
});

export class ProjectsRepository {
  constructor(private readonly db: Database.Database) {}

  list(): ProjectSummary[] {
    const rows = this.db
      .prepare("SELECT * FROM projects ORDER BY updated_at DESC")
      .all() as Row[];

    return rows.map(mapRow);
  }

  get(id: string): ProjectSummary | null {
    const row = this.db.prepare("SELECT * FROM projects WHERE id = ?").get(id) as Row | undefined;
    return row ? mapRow(row) : null;
  }

  insert(project: ProjectSummary) {
    this.db
      .prepare(
        `INSERT INTO projects (
          id, name, root_path, status, created_at, updated_at, last_opened_at
        ) VALUES (
          @id, @name, @root_path, @status, @created_at, @updated_at, @last_opened_at
        )`,
      )
      .run({
        id: project.id,
        name: project.name,
        root_path: project.rootPath,
        status: project.status,
        created_at: project.createdAt,
        updated_at: project.updatedAt,
        last_opened_at: project.lastOpenedAt ?? null,
      });

    return project;
  }

  updateStatus(id: string, status: ProjectStatus, updatedAt: string) {
    this.db
      .prepare("UPDATE projects SET status = ?, updated_at = ? WHERE id = ?")
      .run(status, updatedAt, id);
  }

  touchOpenedAt(id: string, openedAt: string) {
    this.db
      .prepare("UPDATE projects SET last_opened_at = ?, updated_at = ? WHERE id = ?")
      .run(openedAt, openedAt, id);
  }

  delete(id: string) {
    this.db.prepare("DELETE FROM projects WHERE id = ?").run(id);
  }
}
