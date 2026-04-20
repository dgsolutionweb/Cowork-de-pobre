import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { app } from "electron";

let database: Database.Database | null = null;

const hasColumn = (db: Database.Database, table: string, column: string) => {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return rows.some((row) => row.name === column);
};

const ensureColumn = (
  db: Database.Database,
  table: string,
  column: string,
  definition: string,
) => {
  if (!hasColumn(db, table, column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
};

const createSchema = (db: Database.Database) => {
  db.exec(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS authorized_directories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      path TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS task_history (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      command_text TEXT NOT NULL,
      intent TEXT NOT NULL,
      status TEXT NOT NULL,
      confirmed INTEGER NOT NULL,
      summary TEXT NOT NULL,
      affected_files_json TEXT NOT NULL,
      error_message TEXT,
      created_at TEXT NOT NULL,
      executed_at TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS automations (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      command_text TEXT NOT NULL,
      schedule TEXT NOT NULL,
      enabled INTEGER NOT NULL,
      last_run_at TEXT,
      last_status TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      title TEXT NOT NULL,
      messages_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS vault_entries (
      id TEXT PRIMARY KEY,
      original_path TEXT NOT NULL,
      original_name TEXT NOT NULL,
      vault_path TEXT NOT NULL,
      size INTEGER NOT NULL,
      deleted_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'available'
    );

    CREATE TABLE IF NOT EXISTS error_logs (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      message TEXT NOT NULL,
      stack TEXT,
      context TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS file_watch_events (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      path TEXT NOT NULL,
      name TEXT NOT NULL,
      directory_id TEXT NOT NULL,
      directory_name TEXT NOT NULL,
      seen INTEGER NOT NULL DEFAULT 0,
      detected_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      root_path TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_opened_at TEXT
    );

    CREATE TABLE IF NOT EXISTS project_instructions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      scope TEXT NOT NULL,
      path TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      UNIQUE(project_id, scope, path)
    );

    CREATE TABLE IF NOT EXISTS permission_policies (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL UNIQUE,
      file_roots_json TEXT NOT NULL,
      domain_allowlist_json TEXT NOT NULL,
      allow_destructive INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS approval_events (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      action_type TEXT NOT NULL,
      risk_level TEXT NOT NULL,
      target TEXT NOT NULL,
      details TEXT,
      decision TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS project_context_items (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      type TEXT NOT NULL,
      value TEXT NOT NULL,
      metadata_json TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS project_memories (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      category TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      UNIQUE(project_id, key)
    );

    CREATE TABLE IF NOT EXISTS project_runs (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      type TEXT NOT NULL,
      status TEXT NOT NULL,
      input TEXT,
      output TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS project_file_index (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      file_path TEXT NOT NULL,
      last_indexed_at TEXT NOT NULL,
      hash TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      UNIQUE(project_id, file_path)
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS project_chunks USING fts5(
      project_id UNINDEXED,
      file_path UNINDEXED,
      content,
      tokenize = 'porter unicode61'
    );

    CREATE TABLE IF NOT EXISTS project_artifacts (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      title TEXT NOT NULL,
      type TEXT NOT NULL, -- 'document', 'spreadsheet', 'presentation'
      content TEXT NOT NULL, -- markdown or json representation
      version INTEGER NOT NULL DEFAULT 1,
      file_path TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS project_connectors (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      status TEXT NOT NULL,
      config_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
    `);

  ensureColumn(db, "app_settings", "key", "TEXT");
  ensureColumn(db, "task_history", "project_id", "TEXT");
  ensureColumn(db, "automations", "project_id", "TEXT");
  ensureColumn(db, "conversations", "project_id", "TEXT");
  ensureColumn(db, "project_connectors", "last_synced_at", "TEXT");
  ensureColumn(db, "project_connectors", "sync_error", "TEXT");
};

const seedDefaults = (db: Database.Database) => {
  const settings = [
    ["theme", "dark"],
    ["deletionMode", "vault"],
    ["aiReady", "false"],
    ["geminiApiKey", ""],
    ["geminiModel", "gemini-2.5-flash"],
    ["customSystemPrompt", ""],
    ["notificationsEnabled", "true"],
    ["onboardingCompleted", "false"],
    ["activeProjectId", ""],
  ];

  const stmt = db.prepare(
    "INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)",
  );
  for (const [key, value] of settings) stmt.run(key, value);
};

export const getDatabase = () => {
  if (database) return database;

  const userDataPath = app.isReady()
    ? app.getPath("userData")
    : path.resolve(process.cwd(), ".cowork-data");

  fs.mkdirSync(userDataPath, { recursive: true });

  const databasePath = path.join(userDataPath, "cowork-local-ai.sqlite");
  database = new Database(databasePath);
  createSchema(database);
  seedDefaults(database);
  ensureColumn(database, "app_settings", "key", "TEXT");
  return database;
};
