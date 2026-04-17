import type { AppPreferences, Automation, ExecutionResult } from "../../shared/types";
import { createId } from "../utils/id";
import { AutomationsRepository } from "../repositories/automationsRepository";
import { TaskExecutionService } from "./taskExecutionService";
import { GeminiChatService } from "./geminiChatService";
import { FileService } from "./fileService";
import { DocumentService } from "./documentService";

export class AutomationService {
  constructor(
    private readonly repository: AutomationsRepository,
    private readonly taskExecutionService: TaskExecutionService,
    private readonly geminiChatService: GeminiChatService,
    private readonly fileService: FileService,
    private readonly documentService: DocumentService,
  ) {}

  ensureDefaults() {
    const current = this.repository.list();
    if (current.length > 0) {
      return current;
    }

    const now = new Date().toISOString();
    const defaults: Automation[] = [
      {
        id: createId(),
        name: "Downloads Diário",
        description: "Organiza arquivos recém-chegados na pasta Downloads.",
        commandText: "organizar downloads",
        schedule: "Todos os dias, 09:00",
        enabled: true,
        createdAt: now,
        lastStatus: "preview",
      },
      {
        id: createId(),
        name: "PDFs da Operação",
        description: "Lista PDFs para revisão comercial e documental.",
        commandText: "listar pdfs",
        schedule: "Manual sob demanda",
        enabled: false,
        createdAt: now,
        lastStatus: "preview",
      },
    ];

    for (const automation of defaults) {
      this.repository.insert(automation);
    }

    return this.repository.list();
  }

  list() {
    return this.repository.list();
  }

  toggle(id: string, enabled: boolean) {
    this.repository.updateState(id, enabled);
    return this.repository.list().find((item) => item.id === id)!;
  }

  create(input: {
    name: string;
    description: string;
    commandText: string;
    schedule: string;
    enabled: boolean;
  }): Automation {
    const automation: Automation = {
      id: createId(),
      name: input.name.trim(),
      description: input.description.trim(),
      commandText: input.commandText.trim(),
      schedule: input.schedule,
      enabled: input.enabled,
      createdAt: new Date().toISOString(),
    };
    return this.repository.insert(automation);
  }

  update(
    id: string,
    fields: Partial<Pick<Automation, "name" | "description" | "commandText" | "schedule" | "enabled">>,
  ): Automation {
    this.repository.update(id, fields);
    const updated = this.repository.list().find((a) => a.id === id);
    if (!updated) throw new Error("Automação não encontrada.");
    return updated;
  }

  delete(id: string): void {
    this.repository.delete(id);
  }

  async run(
    id: string,
    directories: Parameters<TaskExecutionService["previewCommand"]>[1],
    preferences: AppPreferences,
  ): Promise<ExecutionResult> {
    const automation = this.repository.list().find((item) => item.id === id);

    if (!automation) {
      throw new Error("Automação não encontrada.");
    }

    const preview = await this.taskExecutionService.previewCommand(
      automation.commandText,
      directories,
      preferences,
    );

    let result: ExecutionResult;

    if (preview.parsed.intent === "unknown") {
      const historyId = createId();
      try {
        const chatResult = await this.geminiChatService.chat(
          [],
          automation.commandText,
          { directories, preferences },
          this.fileService,
          this.documentService,
          this.taskExecutionService,
        );

        let summaryStr = chatResult.assistantText;
        if (chatResult.pendingPreviews.length > 0 || chatResult.pendingFileOps.length > 0) {
          summaryStr += "\n(Requer confirmação manual no painel/chat para operações pendentes)";
        }

        result = {
          historyId,
          status: "completed",
          summary: summaryStr,
          affectedFiles: [],
          logs: ["Automação processada via inteligência artificial (Gemini)."],
          executedAt: new Date().toISOString(),
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro na automação via IA";
        result = {
          historyId,
          status: "failed",
          summary: "Falha ao processar automação avançada com Gemini.",
          affectedFiles: [],
          logs: [message],
          errorMessage: message,
          executedAt: new Date().toISOString(),
        };
      }
    } else {
      result = await this.taskExecutionService.executeDraft(preview.draftId, directories);
    }

    this.repository.updateLastRun(id, result.executedAt, result.status);
    return result;
  }
}
