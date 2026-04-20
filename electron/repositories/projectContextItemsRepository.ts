import type Database from "better-sqlite3";
import type { ProjectContextItem } from "../../shared/types";

interface Row {
  id: string;
  project_id: string;
  type: string;
  value: string;
  metadata_json: string | null;
  created_at: string;
}

const mapRow = (row: Row): ProjectContextItem => ({
  id: row.id,
  projectId: row.project_id,
  type: row.type as ProjectContextItem["type"],
  value: row.value,
  metadata: row.metadata_json ? JSON.parse(row.metadata_json) : undefined,
  createdAt: row.created_at,
});

export class ProjectContextItemsRepository {
  constructor(private readonly db: Database.Database) {}

  listByProject(projectId: string): ProjectContextItem[] {
    const rows = this.db
      .prepare("SELECT * FROM project_context_items WHERE project_id = ? ORDER BY created_at DESC")
      .all(projectId) as Row[];

    return rows.map(mapRow);
  }

  insert(item: ProjectContextItem) {
    this.db
      .prepare(
        `INSERT INTO project_context_items (
          id, project_id, type, value, metadata_json, created_at
        ) VALUES (
          @id, @project_id, @type, @value, @metadata_json, @created_at
        )`,
      )
      .run({
        id: item.id,
        project_id: item.projectId,
        type: item.type,
        value: item.value,
        metadata_json: item.metadata ? JSON.stringify(item.metadata) : null,
        created_at: item.createdAt,
      });

    return item;
  }

  delete(id: string) {
    this.db.prepare("DELETE FROM project_context_items WHERE id = ?").run(id);
  }
}
