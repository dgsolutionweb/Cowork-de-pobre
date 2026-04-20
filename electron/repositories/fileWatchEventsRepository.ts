import type Database from "better-sqlite3";
import type { FileWatchEvent, FileWatchEventType } from "../../shared/types";

interface Row {
  id: string;
  type: string;
  path: string;
  name: string;
  directory_id: string;
  directory_name: string;
  seen: number;
  detected_at: string;
}

export class FileWatchEventsRepository {
  constructor(private readonly db: Database.Database) {}

  list(): FileWatchEvent[] {
    const rows = this.db
      .prepare("SELECT * FROM file_watch_events ORDER BY detected_at DESC LIMIT 100")
      .all() as Row[];
    return rows.map(this.toEvent);
  }

  unseenCount(): number {
    const result = this.db
      .prepare("SELECT COUNT(*) as count FROM file_watch_events WHERE seen = 0")
      .get() as { count: number };
    return result.count;
  }

  insert(event: FileWatchEvent): void {
    this.db.prepare(
      `INSERT INTO file_watch_events (id, type, path, name, directory_id, directory_name, seen, detected_at)
       VALUES (@id, @type, @path, @name, @directory_id, @directory_name, 0, @detected_at)`,
    ).run({
      id: event.id,
      type: event.type,
      path: event.path,
      name: event.name,
      directory_id: event.directoryId,
      directory_name: event.directoryName,
      detected_at: event.detectedAt,
    });
  }

  markAllSeen(): void {
    this.db.prepare("UPDATE file_watch_events SET seen = 1 WHERE seen = 0").run();
  }

  private toEvent(row: Row): FileWatchEvent {
    return {
      id: row.id,
      type: row.type as FileWatchEventType,
      path: row.path,
      name: row.name,
      directoryId: row.directory_id,
      directoryName: row.directory_name,
      detectedAt: row.detected_at,
    };
  }
}
