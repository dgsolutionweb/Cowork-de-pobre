import { getDatabase } from "../db/database";
import { connectorService } from "./connectorService";
import { fetchGitHubContent, validateGitHubToken } from "./githubConnectorService";
import {
  fetchGoogleDriveContent,
  validateGoogleToken,
} from "./googleDriveConnectorService";
import type { ConnectorConfig } from "../../shared/types";

// Pseudo project_id prefix for connector chunks in FTS5 table
// Stored as: __conn__:<connectorId>
const CONN_PREFIX = "__conn__:";

export interface SyncResult {
  connectorId: string;
  connectorName: string;
  success: boolean;
  itemsIndexed: number;
  error?: string;
}

// ─── Chunk helpers ────────────────────────────────────────────────────────────

function chunkText(text: string, size = 1200, overlap = 200): string[] {
  const chunks: string[] = [];
  if (!text) return chunks;
  let start = 0;
  while (start < text.length) {
    let end = start + size;
    if (end < text.length) {
      const nl = text.indexOf("\n", end - 80);
      if (nl !== -1 && nl < end + 80) end = nl + 1;
    }
    chunks.push(text.slice(start, end).trim());
    start = end - overlap;
    if (start < 0) start = 0;
    if (start >= text.length || end >= text.length) break;
  }
  return chunks.filter(Boolean);
}

function storeChunks(
  connectorId: string,
  items: Array<{ remotePath: string; content: string | null; hash?: string }>
) {
  const db = getDatabase();
  const projectId = CONN_PREFIX + connectorId;

  const currentPaths = items.map((i) => i.remotePath);
  const tx = db.transaction(() => {
    // Criar a tabela sob demanda caso o db original não a tenha
    db.exec(`
      CREATE TABLE IF NOT EXISTS connector_file_index (
        id TEXT PRIMARY KEY,
        connector_id TEXT NOT NULL,
        file_path TEXT NOT NULL,
        last_indexed_at TEXT NOT NULL,
        hash TEXT NOT NULL,
        UNIQUE(connector_id, file_path)
      )
    `);

    // 1. Apagar chunks de arquivos que não existem mais
    if (currentPaths.length > 0) {
      db.prepare(
        `DELETE FROM project_chunks WHERE project_id = ? AND file_path NOT IN (${currentPaths.map(() => "?").join(",")})`
      ).run(projectId, ...currentPaths);
      db.prepare(
        `DELETE FROM connector_file_index WHERE connector_id = ? AND file_path NOT IN (${currentPaths.map(() => "?").join(",")})`
      ).run(connectorId, ...currentPaths);
    } else {
      db.prepare("DELETE FROM project_chunks WHERE project_id = ?").run(projectId);
      db.prepare("DELETE FROM connector_file_index WHERE connector_id = ?").run(connectorId);
    }

    const delStmt = db.prepare("DELETE FROM project_chunks WHERE project_id = ? AND file_path = ?");
    const addStmt = db.prepare(
      "INSERT INTO project_chunks (project_id, file_path, content) VALUES (?, ?, ?)"
    );
    const updateHashStmt = db.prepare(
      `INSERT INTO connector_file_index (id, connector_id, file_path, last_indexed_at, hash) 
       VALUES (?, ?, ?, ?, ?) 
       ON CONFLICT(connector_id, file_path) DO UPDATE SET hash=excluded.hash, last_indexed_at=excluded.last_indexed_at`
    );

    // 2. Inserir ou atualizar apenas arquivos com conteúdo (modificados ou novos)
    for (const item of items) {
      if (item.content !== null) {
        delStmt.run(projectId, item.remotePath);
        const chunks = chunkText(item.content);
        for (const chunk of chunks) {
          addStmt.run(projectId, item.remotePath, chunk);
        }
      }

      // 3. Atualizar metadata
      if (item.hash) {
        const id = require("crypto").randomUUID();
        updateHashStmt.run(id, connectorId, item.remotePath, new Date().toISOString(), item.hash);
      }
    }
  });

  tx();
}

function updateConnectorStatus(
  id: string,
  status: string,
  lastSyncedAt: string | null,
  syncError: string | null
) {
  const db = getDatabase();
  db.prepare(
    "UPDATE project_connectors SET status = ?, last_synced_at = ?, sync_error = ?, updated_at = ? WHERE id = ?"
  ).run(status, lastSyncedAt, syncError, new Date().toISOString(), id);
}

// ─── Sync single connector ────────────────────────────────────────────────────

async function syncGitHub(
  connector: ConnectorConfig,
  onProgress?: (msg: string) => void
): Promise<SyncResult> {
  const { token } = connector.config;
  if (!token) {
    return {
      connectorId: connector.id,
      connectorName: connector.name,
      success: false,
      itemsIndexed: 0,
      error: "Token GitHub não encontrado no conector.",
    };
  }

  try {
    // Validate token first
    await validateGitHubToken(token);

    // Load existing items to prevent re-fetching
    const db = getDatabase();
    db.exec(`
      CREATE TABLE IF NOT EXISTS connector_file_index (
        id TEXT PRIMARY KEY,
        connector_id TEXT NOT NULL,
        file_path TEXT NOT NULL,
        last_indexed_at TEXT NOT NULL,
        hash TEXT NOT NULL,
        UNIQUE(connector_id, file_path)
      )
    `);
    const existing = db.prepare(`SELECT file_path, hash FROM connector_file_index WHERE connector_id = ?`).all(connector.id) as any[];
    const existingMap = new Map(existing.map(r => [r.file_path, r.hash]));

    const items = await fetchGitHubContent(token, existingMap, onProgress);
    storeChunks(connector.id, items);
    updateConnectorStatus(connector.id, "connected", new Date().toISOString(), null);

    return {
      connectorId: connector.id,
      connectorName: connector.name,
      success: true,
      itemsIndexed: items.length,
    };
  } catch (err: any) {
    const msg = err.message || "Erro desconhecido";
    updateConnectorStatus(connector.id, "error", null, msg);
    return {
      connectorId: connector.id,
      connectorName: connector.name,
      success: false,
      itemsIndexed: 0,
      error: msg,
    };
  }
}

async function syncGoogleDrive(
  connector: ConnectorConfig,
  onProgress?: (msg: string) => void
): Promise<SyncResult> {
  const { accessToken, refreshToken, clientId, clientSecret } = connector.config;

  if (!accessToken || !clientId || !clientSecret) {
    return {
      connectorId: connector.id,
      connectorName: connector.name,
      success: false,
      itemsIndexed: 0,
      error: "Credenciais Google Drive incompletas.",
    };
  }

  try {
    // Validate token
    await validateGoogleToken(accessToken);

    const db = getDatabase();
    db.exec(`
      CREATE TABLE IF NOT EXISTS connector_file_index (
        id TEXT PRIMARY KEY,
        connector_id TEXT NOT NULL,
        file_path TEXT NOT NULL,
        last_indexed_at TEXT NOT NULL,
        hash TEXT NOT NULL,
        UNIQUE(connector_id, file_path)
      )
    `);
    const existing = db.prepare(`SELECT file_path, hash FROM connector_file_index WHERE connector_id = ?`).all(connector.id) as any[];
    const existingMap = new Map(existing.map(r => [r.file_path, r.hash]));

    const { items, newAccessToken } = await fetchGoogleDriveContent(
      accessToken,
      clientId,
      clientSecret,
      refreshToken,
      existingMap,
      onProgress
    );

    storeChunks(connector.id, items);

    // Persist refreshed access token
    if (newAccessToken !== accessToken) {
      const db = getDatabase();
      const updatedConfig = { ...connector.config, accessToken: newAccessToken };
      db.prepare(
        "UPDATE project_connectors SET config_json = ?, updated_at = ? WHERE id = ?"
      ).run(JSON.stringify(updatedConfig), new Date().toISOString(), connector.id);
    }

    updateConnectorStatus(connector.id, "connected", new Date().toISOString(), null);

    return {
      connectorId: connector.id,
      connectorName: connector.name,
      success: true,
      itemsIndexed: items.length,
    };
  } catch (err: any) {
    const msg = err.message || "Erro desconhecido";
    updateConnectorStatus(connector.id, "error", null, msg);
    return {
      connectorId: connector.id,
      connectorName: connector.name,
      success: false,
      itemsIndexed: 0,
      error: msg,
    };
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function syncConnector(
  connectorId: string,
  onProgress?: (msg: string) => void
): Promise<SyncResult> {
  const connectors = connectorService.listAll();
  const connector = connectors.find((c) => c.id === connectorId);

  if (!connector) {
    return {
      connectorId,
      connectorName: "?",
      success: false,
      itemsIndexed: 0,
      error: "Conector não encontrado.",
    };
  }

  onProgress?.(`Iniciando sync: ${connector.name}`);

  if (connector.type === "github") return syncGitHub(connector, onProgress);
  if (connector.type === "google_drive") return syncGoogleDrive(connector, onProgress);

  return {
    connectorId,
    connectorName: connector.name,
    success: false,
    itemsIndexed: 0,
    error: `Tipo "${connector.type}" não suporta sync automático.`,
  };
}

export async function syncAll(
  onProgress?: (msg: string) => void
): Promise<SyncResult[]> {
  const connectors = connectorService.listAll().filter(
    (c) => c.type === "github" || c.type === "google_drive"
  );

  const results: SyncResult[] = [];
  for (const connector of connectors) {
    const result = await syncConnector(connector.id, onProgress);
    results.push(result);
  }
  return results;
}

// ─── Search across connector chunks ──────────────────────────────────────────

export interface ConnectorSearchResult {
  connectorName: string;
  remotePath: string;
  content: string;
}

export function searchConnectorChunks(
  query: string,
  limit = 6
): ConnectorSearchResult[] {
  const db = getDatabase();
  const connectors = connectorService.listAll().filter(
    (c) => c.type === "github" || c.type === "google_drive"
  );

  if (connectors.length === 0) return [];

  const results: ConnectorSearchResult[] = [];

  for (const connector of connectors) {
    const projectId = CONN_PREFIX + connector.id;
    try {
      const rows = db
        .prepare(
          `SELECT file_path, content, rank
           FROM project_chunks
           WHERE project_id = ? AND project_chunks MATCH ?
           ORDER BY rank
           LIMIT ?`
        )
        .all(projectId, query, limit) as any[];

      for (const row of rows) {
        results.push({
          connectorName: connector.name,
          remotePath: row.file_path,
          content: row.content,
        });
      }
    } catch {
      // FTS error (e.g. no chunks yet) — skip silently
    }
  }

  return results.slice(0, limit);
}

export function getConnectorItems(connectorId: string): { remotePath: string }[] {
  const db = getDatabase();
  const projectId = CONN_PREFIX + connectorId;
  const rows = db.prepare("SELECT DISTINCT file_path FROM project_chunks WHERE project_id = ? ORDER BY file_path ASC").all(projectId) as any[];
  return rows.map((r) => ({ remotePath: r.file_path }));
}

export function getConnectorFileContent(remotePath: string): string | null {
  const db = getDatabase();
  const rows = db.prepare("SELECT content FROM project_chunks WHERE file_path = ? AND project_id LIKE '__conn__:%'").all(remotePath) as any[];
  if (rows.length === 0) return null;
  return rows.map(r => r.content).join("\n\n");
}
