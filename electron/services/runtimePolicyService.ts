import type { ApprovalEvent, ApprovalRiskLevel, PermissionPolicy } from "../../shared/types";
import { createId } from "../utils/id";
import { ApprovalEventsRepository } from "../repositories/approvalEventsRepository";
import { PermissionPoliciesRepository } from "../repositories/permissionPoliciesRepository";

export class RuntimePolicyService {
  constructor(
    private readonly approvalEventsRepository: ApprovalEventsRepository,
    private readonly permissionPoliciesRepository: PermissionPoliciesRepository,
  ) {}

  getProjectPolicy(projectId: string): PermissionPolicy | null {
    return this.permissionPoliciesRepository.getByProject(projectId);
  }

  listApprovalEvents(limit = 80): ApprovalEvent[] {
    return this.approvalEventsRepository.list(limit);
  }

  recordApprovedAction(input: {
    projectId?: string;
    actionType: string;
    target: string;
    details?: string;
  }) {
    const event: ApprovalEvent = {
      id: createId(),
      projectId: input.projectId,
      actionType: input.actionType,
      riskLevel: this.classifyRisk(input.actionType),
      target: input.target,
      details: input.details,
      decision: "approved",
      createdAt: new Date().toISOString(),
    };

    return this.approvalEventsRepository.insert(event);
  }

  private classifyRisk(actionType: string): ApprovalRiskLevel {
    if (actionType.includes("delete") || actionType.includes("remove")) return "high";
    if (actionType.includes("move") || actionType.includes("rename")) return "medium";
    return "low";
  }
}
