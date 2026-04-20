import type Database from "better-sqlite3";
import type { ConversationMessage, ConversationSummary, PersistedConversation } from "../../shared/types";

interface Row {
  id: string;
  project_id: string | null;
  title: string;
  messages_json: string;
  created_at: string;
  updated_at: string;
}

export class ConversationsRepository {
  constructor(private readonly db: Database.Database) {}

  list(projectId?: string): ConversationSummary[] {
    let query = "SELECT id, project_id, title, created_at, updated_at, messages_json FROM conversations";
    const params: any[] = [];

    if (projectId) {
      query += " WHERE project_id = ?";
      params.push(projectId);
    }

    query += " ORDER BY updated_at DESC LIMIT 50";

    const rows = this.db.prepare(query).all(...params) as Row[];

    return rows.map((row) => {
      const messages = JSON.parse(row.messages_json) as ConversationMessage[];
      return {
        id: row.id,
        projectId: row.project_id ?? undefined,
        title: row.title,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        messageCount: messages.length,
      };
    });
  }

  get(id: string): PersistedConversation | null {
    const row = this.db
      .prepare("SELECT * FROM conversations WHERE id = ?")
      .get(id) as Row | undefined;

    if (!row) return null;

    return {
      id: row.id,
      projectId: row.project_id ?? undefined,
      title: row.title,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      messages: JSON.parse(row.messages_json) as ConversationMessage[],
    };
  }

  save(conversation: PersistedConversation): void {
    this.db
      .prepare(
        `INSERT INTO conversations (id, project_id, title, messages_json, created_at, updated_at)
         VALUES (@id, @project_id, @title, @messages_json, @created_at, @updated_at)
         ON CONFLICT(id) DO UPDATE SET
           project_id = excluded.project_id,
           title = excluded.title,
           messages_json = excluded.messages_json,
           updated_at = excluded.updated_at`,
      )
      .run({
        id: conversation.id,
        project_id: conversation.projectId ?? null,
        title: conversation.title,
        messages_json: JSON.stringify(conversation.messages),
        created_at: conversation.createdAt,
        updated_at: conversation.updatedAt,
      });
  }

  delete(id: string): void {
    this.db.prepare("DELETE FROM conversations WHERE id = ?").run(id);
  }

  clearAll(): void {
    this.db.prepare("DELETE FROM conversations").run();
  }
}
