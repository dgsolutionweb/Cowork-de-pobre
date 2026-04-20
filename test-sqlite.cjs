const Database = require('better-sqlite3');
const db = new Database(':memory:');
const statements = [
    `PRAGMA journal_mode = WAL;`,
    `CREATE TABLE IF NOT EXISTS authorized_directories (id TEXT PRIMARY KEY, name TEXT NOT NULL, path TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL);`,
    `CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, name TEXT NOT NULL, root_path TEXT NOT NULL UNIQUE, status TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, last_opened_at TEXT);`,
    `CREATE TABLE IF NOT EXISTS project_instructions (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, scope TEXT NOT NULL, path TEXT NOT NULL DEFAULT '', content TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE, UNIQUE(project_id, scope, path));`,
    `CREATE TABLE IF NOT EXISTS permission_policies (id TEXT PRIMARY KEY, project_id TEXT NOT NULL UNIQUE, file_roots_json TEXT NOT NULL, domain_allowlist_json TEXT NOT NULL, allow_destructive INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE);`,
    `CREATE VIRTUAL TABLE IF NOT EXISTS project_chunks USING fts5(project_id UNINDEXED, file_path UNINDEXED, content, tokenize = 'porter unicode61');`,
    `CREATE TABLE IF NOT EXISTS project_artifacts (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, title TEXT NOT NULL, type TEXT NOT NULL, content TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, file_path TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE);`
];
for(let i = 0; i < statements.length; i++) {
    try {
        db.exec(statements[i]);
    } catch(e) {
        console.error(`Statement ${i} failed:`, e.message);
    }
}
