import type Database from "better-sqlite3";
import type { ProjectMemory } from "../../shared/types";

interface Row {
  id: string;
  project_id: string;
  key: string;
  value: string;
  category: string;
  created_at: string;
  updated_at: string;
}

const mapRow = (row: Row): ProjectMemory => ({
  id: row.id,
  projectId: row.project_id,
  key: row.key,
  value: row.value,
  category: row.category as ProjectMemory["category"],
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export class ProjectMemoriesRepository {
  constructor(private readonly db: Database.Database) {}

  listByProject(projectId: string): ProjectMemory[] {
    const rows = this.db
      .prepare("SELECT * FROM project_memories WHERE project_id = ? ORDER BY updated_at DESC")
      .all(projectId) as Row[];

    return rows.map(mapRow);
  }

  upsert(memory: ProjectMemory) {
    this.db
      .prepare(
        `INSERT INTO project_memories (
          id, project_id, key, value, category, created_at, updated_at
        ) VALUES (
          @id, @project_id, @key, @value, @category, @created_at, @updated_at
        )
        ON CONFLICT(project_id, key)
        DO UPDATE SET value = excluded.value, category = excluded.category, updated_at = excluded.updated_at`,
      )
      .run({
        id: memory.id,
        project_id: memory.projectId,
        key: memory.key,
        value: memory.value,
        category: memory.category,
        created_at: memory.createdAt,
        updated_at: memory.updatedAt,
      });

    return memory;
  }

  delete(projectId: string, key: string) {
    this.db
      .prepare("DELETE FROM project_memories WHERE project_id = ? AND key = ?")
      .run(projectId, key);
  }

  clearProject(projectId: string) {
    this.db.prepare("DELETE FROM project_memories WHERE project_id = ?").run(projectId);
  }
}
