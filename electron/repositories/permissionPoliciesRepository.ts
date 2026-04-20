import type Database from "better-sqlite3";
import type { PermissionPolicy } from "../../shared/types";

interface Row {
  id: string;
  project_id: string;
  file_roots_json: string;
  domain_allowlist_json: string;
  allow_destructive: number;
  created_at: string;
  updated_at: string;
}

const mapRow = (row: Row): PermissionPolicy => ({
  id: row.id,
  projectId: row.project_id,
  fileRoots: JSON.parse(row.file_roots_json) as string[],
  domainAllowlist: JSON.parse(row.domain_allowlist_json) as string[],
  allowDestructive: Boolean(row.allow_destructive),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export class PermissionPoliciesRepository {
  constructor(private readonly db: Database.Database) {}

  getByProject(projectId: string): PermissionPolicy | null {
    const row = this.db
      .prepare("SELECT * FROM permission_policies WHERE project_id = ?")
      .get(projectId) as Row | undefined;

    return row ? mapRow(row) : null;
  }

  upsert(policy: PermissionPolicy) {
    this.db
      .prepare(
        `INSERT INTO permission_policies (
          id, project_id, file_roots_json, domain_allowlist_json, allow_destructive, created_at, updated_at
        ) VALUES (
          @id, @project_id, @file_roots_json, @domain_allowlist_json, @allow_destructive, @created_at, @updated_at
        )
        ON CONFLICT(project_id)
        DO UPDATE SET
          file_roots_json = excluded.file_roots_json,
          domain_allowlist_json = excluded.domain_allowlist_json,
          allow_destructive = excluded.allow_destructive,
          updated_at = excluded.updated_at`,
      )
      .run({
        id: policy.id,
        project_id: policy.projectId,
        file_roots_json: JSON.stringify(policy.fileRoots),
        domain_allowlist_json: JSON.stringify(policy.domainAllowlist),
        allow_destructive: policy.allowDestructive ? 1 : 0,
        created_at: policy.createdAt,
        updated_at: policy.updatedAt,
      });

    return this.getByProject(policy.projectId)!;
  }
}
