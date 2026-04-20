import type { ConversationSummary, PersistedConversation } from "../../shared/types";
import { ConversationsRepository } from "../repositories/conversationsRepository";

export class ConversationService {
  constructor(private readonly repository: ConversationsRepository) {}

  list(projectId?: string): ConversationSummary[] {
    return this.repository.list(projectId);
  }

  get(id: string): PersistedConversation | null {
    return this.repository.get(id);
  }

  save(conversation: PersistedConversation): void {
    const title =
      conversation.title ||
      conversation.messages.find((m) => m.role === "user")?.text?.slice(0, 50) ||
      "Conversa";
    this.repository.save({ ...conversation, title });
  }

  delete(id: string): void {
    this.repository.delete(id);
  }

  clearAll(): void {
    this.repository.clearAll();
  }
}
