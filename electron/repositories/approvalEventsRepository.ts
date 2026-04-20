import type Database from "better-sqlite3";
import type { ApprovalDecision, ApprovalEvent, ApprovalRiskLevel } from "../../shared/types";

interface Row {
  id: string;
  project_id: string | null;
  action_type: string;
  risk_level: string;
  target: string;
  details: string | null;
  decision: string;
  created_at: string;
}

const mapRow = (row: Row): ApprovalEvent => ({
  id: row.id,
  projectId: row.project_id ?? undefined,
  actionType: row.action_type,
  riskLevel: row.risk_level as ApprovalRiskLevel,
  target: row.target,
  details: row.details ?? undefined,
  decision: row.decision as ApprovalDecision,
  createdAt: row.created_at,
});

export class ApprovalEventsRepository {
  constructor(private readonly db: Database.Database) {}

  list(limit = 100): ApprovalEvent[] {
    const rows = this.db
      .prepare("SELECT * FROM approval_events ORDER BY created_at DESC LIMIT ?")
      .all(limit) as Row[];

    return rows.map(mapRow);
  }

  insert(event: ApprovalEvent) {
    this.db
      .prepare(
        `INSERT INTO approval_events (
          id, project_id, action_type, risk_level, target, details, decision, created_at
        ) VALUES (
          @id, @project_id, @action_type, @risk_level, @target, @details, @decision, @created_at
        )`,
      )
      .run({
        id: event.id,
        project_id: event.projectId ?? null,
        action_type: event.actionType,
        risk_level: event.riskLevel,
        target: event.target,
        details: event.details ?? null,
        decision: event.decision,
        created_at: event.createdAt,
      });

    return event;
  }
}
