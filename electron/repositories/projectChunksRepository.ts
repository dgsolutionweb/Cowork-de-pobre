import type Database from "better-sqlite3";

interface ChunkRow {
  project_id: string;
  file_path: string;
  content: string;
}

export interface SearchResult {
  filePath: string;
  content: string;
  rank: number;
}

export class ProjectChunksRepository {
  constructor(private readonly db: Database.Database) {}

  insertMany(chunks: ChunkRow[]) {
    const stmt = this.db.prepare(
      "INSERT INTO project_chunks (project_id, file_path, content) VALUES (?, ?, ?)",
    );

    const transaction = this.db.transaction((items: ChunkRow[]) => {
      for (const item of items) {
        stmt.run(item.project_id, item.file_path, item.content);
      }
    });

    transaction(chunks);
  }

  deleteByFile(projectId: string, filePath: string) {
    this.db
      .prepare("DELETE FROM project_chunks WHERE project_id = ? AND file_path = ?")
      .run(projectId, filePath);
  }

  deleteByProject(projectId: string) {
    this.db.prepare("DELETE FROM project_chunks WHERE project_id = ?").run(projectId);
  }

  search(projectId: string, query: string, limit = 5): SearchResult[] {
    const rows = this.db
      .prepare(
        `
        SELECT file_path, content, rank
        FROM project_chunks
        WHERE project_id = ? AND project_chunks MATCH ?
        ORDER BY rank
        LIMIT ?
      `,
      )
      .all(projectId, query, limit) as any[];

    return rows.map((row) => ({
      filePath: row.file_path,
      content: row.content,
      rank: row.rank,
    }));
  }
}
