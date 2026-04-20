import type Database from "better-sqlite3";
import type { ProjectFileIndex } from "../../shared/types";

interface Row {
  id: string;
  project_id: string;
  file_path: string;
  last_indexed_at: string;
  hash: string;
}

export class ProjectFileIndexRepository {
  constructor(private readonly db: Database.Database) {}

  getByPath(projectId: string, filePath: string): ProjectFileIndex | null {
    const row = this.db
      .prepare("SELECT * FROM project_file_index WHERE project_id = ? AND file_path = ?")
      .get(projectId, filePath) as Row | undefined;

    if (!row) return null;
    return {
      id: row.id,
      projectId: row.project_id,
      filePath: row.file_path,
      lastIndexedAt: row.last_indexed_at,
      hash: row.hash,
    };
  }

  upsert(index: ProjectFileIndex) {
    this.db
      .prepare(
        `INSERT INTO project_file_index (
          id, project_id, file_path, last_indexed_at, hash
        ) VALUES (
          @id, @project_id, @file_path, @last_indexed_at, @hash
        )
        ON CONFLICT(project_id, file_path)
        DO UPDATE SET last_indexed_at = excluded.last_indexed_at, hash = excluded.hash`,
      )
      .run({
        id: index.id,
        project_id: index.projectId,
        file_path: index.filePath,
        last_indexed_at: index.lastIndexedAt,
        hash: index.hash,
      });
  }

  deleteByProject(projectId: string) {
    this.db.prepare("DELETE FROM project_file_index WHERE project_id = ?").run(projectId);
  }
}
