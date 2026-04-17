import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { app } from "electron";

let database: Database.Database | null = null;

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
      command_text TEXT NOT NULL,
      intent TEXT NOT NULL,
      status TEXT NOT NULL,
      confirmed INTEGER NOT NULL,
      summary TEXT NOT NULL,
      affected_files_json TEXT NOT NULL,
      error_message TEXT,
      created_at TEXT NOT NULL,
      executed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS automations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      command_text TEXT NOT NULL,
      schedule TEXT NOT NULL,
      enabled INTEGER NOT NULL,
      last_run_at TEXT,
      last_status TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
};

const seedDefaults = (db: Database.Database) => {
  const settings = [
    ["theme", "dark"],
    ["deletionMode", "vault"],
    ["aiReady", "false"],
    ["geminiApiKey", ""],
    ["geminiModel", "gemini-2.5-flash"],
  ];

  const settingsStmt = db.prepare(
    "INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)",
  );

  for (const [key, value] of settings) {
    settingsStmt.run(key, value);
  }
};

export const getDatabase = () => {
  if (database) {
    return database;
  }

  const userDataPath = app.isReady()
    ? app.getPath("userData")
    : path.resolve(process.cwd(), ".cowork-data");

  fs.mkdirSync(userDataPath, { recursive: true });

  const databasePath = path.join(userDataPath, "cowork-local-ai.sqlite");
  database = new Database(databasePath);
  createSchema(database);
  seedDefaults(database);
  return database;
};
