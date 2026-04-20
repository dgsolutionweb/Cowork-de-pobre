import { getDatabase } from "../db/database";
import type { ConnectorConfig, ConnectorType, ConnectorStatus } from "../../shared/types";
import crypto from "node:crypto";

interface ConnectorRow {
  id: string;
  project_id: string | null;
  type: string;
  name: string;
  status: string;
  config_json: string;
  created_at: string;
  updated_at: string;
}

const toConnectorConfig = (row: ConnectorRow): ConnectorConfig => ({
  id: row.id,
  projectId: row.project_id || undefined,
  type: row.type as ConnectorType,
  name: row.name,
  status: row.status as ConnectorStatus,
  config: JSON.parse(row.config_json),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  lastSyncedAt: (row as any).last_synced_at || undefined,
  syncError: (row as any).sync_error || undefined,
});

export const connectorService = {
  list: (projectId?: string): ConnectorConfig[] => {
    const db = getDatabase();
    if (projectId) {
      const rows = db.prepare("SELECT * FROM project_connectors WHERE project_id = ? ORDER BY created_at DESC").all(projectId) as ConnectorRow[];
      return rows.map(toConnectorConfig);
    } else {
      const rows = db.prepare("SELECT * FROM project_connectors WHERE project_id IS NULL ORDER BY created_at DESC").all() as ConnectorRow[];
      return rows.map(toConnectorConfig);
    }
  },

  listAll: (): ConnectorConfig[] => {
    const db = getDatabase();
    const rows = db.prepare("SELECT * FROM project_connectors ORDER BY created_at DESC").all() as ConnectorRow[];
    return rows.map(toConnectorConfig);
  },

  create: (input: {
    projectId?: string;
    type: ConnectorType;
    name: string;
    config: Record<string, any>;
  }): ConnectorConfig => {
    const db = getDatabase();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const status: ConnectorStatus = "disconnected";

    db.prepare(
      "INSERT INTO project_connectors (id, project_id, type, name, status, config_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(
      id,
      input.projectId || null,
      input.type,
      input.name,
      status,
      JSON.stringify(input.config),
      now,
      now
    );

    return {
      id,
      projectId: input.projectId,
      type: input.type,
      name: input.name,
      status,
      config: input.config,
      createdAt: now,
      updatedAt: now,
    };
  },

  update: (id: string, config: Record<string, any>): ConnectorConfig => {
    const db = getDatabase();
    const now = new Date().toISOString();
    
    db.prepare("UPDATE project_connectors SET config_json = ?, updated_at = ? WHERE id = ?").run(
      JSON.stringify(config),
      now,
      id
    );

    const row = db.prepare("SELECT * FROM project_connectors WHERE id = ?").get(id) as ConnectorRow;
    return toConnectorConfig(row);
  },

  delete: (id: string): void => {
    const db = getDatabase();
    db.prepare("DELETE FROM project_connectors WHERE id = ?").run(id);
  },
};
