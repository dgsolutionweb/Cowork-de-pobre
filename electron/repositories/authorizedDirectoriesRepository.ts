import type Database from "better-sqlite3";
import type { AuthorizedDirectory } from "../../shared/types";

interface Row {
  id: string;
  name: string;
  path: string;
  created_at: string;
}

export class AuthorizedDirectoriesRepository {
  constructor(private readonly db: Database.Database) {}

  list(): AuthorizedDirectory[] {
    const rows = this.db
      .prepare("SELECT * FROM authorized_directories ORDER BY created_at DESC")
      .all() as Row[];

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      path: row.path,
      createdAt: row.created_at,
    }));
  }

  insert(directory: AuthorizedDirectory) {
    this.db
      .prepare(
        `
          INSERT INTO authorized_directories (id, name, path, created_at)
          VALUES (@id, @name, @path, @created_at)
        `,
      )
      .run({
        id: directory.id,
        name: directory.name,
        path: directory.path,
        created_at: directory.createdAt,
      });

    return directory;
  }

  remove(id: string) {
    this.db
      .prepare("DELETE FROM authorized_directories WHERE id = ?")
      .run(id);
  }
}
