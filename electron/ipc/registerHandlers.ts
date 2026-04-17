import type { BrowserWindow } from "electron";
import { ipcMain } from "electron";
import { getDatabase } from "../db/database";
import { AuthorizedDirectoriesRepository } from "../repositories/authorizedDirectoriesRepository";
import { AutomationsRepository } from "../repositories/automationsRepository";
import { HistoryRepository } from "../repositories/historyRepository";
import { PreferencesRepository } from "../repositories/preferencesRepository";
import { AutomationService } from "../services/automationService";
import { CommandParserService } from "../services/commandParserService";
import { DashboardService } from "../services/dashboardService";
import { DocumentService } from "../services/documentService";
import { FileService } from "../services/fileService";
import { GeminiService } from "../services/geminiService";
import { GeminiChatService } from "../services/geminiChatService";
import { HistoryService } from "../services/historyService";
import { PermissionsService } from "../services/permissionsService";
import { PreferencesService } from "../services/preferencesService";
import { TaskExecutionService } from "../services/taskExecutionService";
import { SchedulerService } from "../services/schedulerService";

export const registerHandlers = (window: BrowserWindow) => {
  const db = getDatabase();
  const directoriesRepository = new AuthorizedDirectoriesRepository(db);
  const historyRepository = new HistoryRepository(db);
  const automationsRepository = new AutomationsRepository(db);
  const preferencesRepository = new PreferencesRepository(db);

  const permissionsService = new PermissionsService(directoriesRepository);
  const historyService = new HistoryService(historyRepository);
  const fileService = new FileService();
  const documentService = new DocumentService();
  const preferencesService = new PreferencesService(preferencesRepository);
  const geminiService = new GeminiService();
  const geminiChatService = new GeminiChatService();
  const parserService = new CommandParserService(geminiService);
  const taskExecutionService = new TaskExecutionService(
    parserService,
    fileService,
    historyService,
  );
  const automationService = new AutomationService(
    automationsRepository,
    taskExecutionService,
    geminiChatService,
    fileService,
    documentService,
  );
  const dashboardService = new DashboardService(
    historyRepository,
    directoriesRepository,
    automationsRepository,
  );
  const schedulerService = new SchedulerService(
    automationService,
    permissionsService,
    preferencesService
  );

  permissionsService.ensureStarterDirectories();
  automationService.ensureDefaults();
  schedulerService.start();

  // In-memory conversation history per session (keyed by conversationId from renderer)
  const conversations = new Map<string, unknown[]>();

  ipcMain.handle("dashboard:get-overview", async () => dashboardService.getOverview());

  ipcMain.handle("assistant:get-suggestions", async () => [
    {
      title: "Organizar Downloads",
      prompt: "Organize minha pasta Downloads",
      intent: "organize_downloads",
    },
    {
      title: "Listar PDFs",
      prompt: "Liste todos os PDFs desta semana",
      intent: "list_pdfs",
    },
    {
      title: "Buscar duplicados",
      prompt: "Encontre arquivos duplicados e me mostre antes de excluir",
      intent: "find_duplicates",
    },
  ]);

  ipcMain.handle("assistant:preview-command", async (_event, commandText: string) => {
    const directories = permissionsService.list();
    const preferences = preferencesService.get();
    return taskExecutionService.previewCommand(commandText, directories, preferences);
  });

  ipcMain.handle("assistant:execute-draft", async (_event, draftId: string) => {
    const directories = permissionsService.list();
    return taskExecutionService.executeDraft(draftId, directories);
  });

  ipcMain.handle("assistant:cancel-draft", async (_event, draftId: string) => {
    taskExecutionService.cancelDraft(draftId);
  });

  ipcMain.handle(
    "assistant:chat",
    async (_event, conversationId: string, message: string) => {
      const history = (conversations.get(conversationId) ?? []) as Parameters<
        typeof geminiChatService.chat
      >[0];
      const directories = permissionsService.list();
      const preferences = preferencesService.get();

      const result = await geminiChatService.chat(
        history,
        message,
        { directories, preferences },
        fileService,
        documentService,
        taskExecutionService,
      );

      conversations.set(conversationId, result.updatedHistory);

      return {
        assistantText: result.assistantText,
        pendingPreviews: result.pendingPreviews,
        pendingFileOps: result.pendingFileOps,
        toolsUsed: result.toolsUsed,
      };
    },
  );

  ipcMain.handle("files:browse", async (_event, input) => {
    const directories = permissionsService.list();
    return fileService.browseAuthorizedFiles(directories, input);
  });

  ipcMain.handle("files:get-authorized-directories", async () => permissionsService.list());

  ipcMain.handle(
    "files:add-authorized-directory",
    async (_event, directoryPath: string, name?: string) =>
      permissionsService.add(directoryPath, name),
  );

  ipcMain.handle("files:pick-authorized-directory", async () =>
    permissionsService.pick(window),
  );

  ipcMain.handle("files:remove-authorized-directory", async (_event, id: string) => {
    permissionsService.remove(id);
  });

  ipcMain.handle("files:rename-file", async (_event, filePath: string, newName: string) => {
    const allowedPaths = permissionsService.list().map((d) => d.path);
    return fileService.renameSingleFile(filePath, newName, allowedPaths);
  });

  ipcMain.handle("files:move-file", async (_event, filePath: string, destDirPath: string) => {
    const allowedPaths = permissionsService.list().map((d) => d.path);
    return fileService.moveSingleFile(filePath, destDirPath, allowedPaths);
  });

  ipcMain.handle("files:delete-file", async (_event, filePath: string) => {
    const allowedPaths = permissionsService.list().map((d) => d.path);
    return fileService.deleteSingleFile(filePath, allowedPaths);
  });

  ipcMain.handle("history:list", async () => historyService.list());

  ipcMain.handle("automations:list", async () => automationService.list());

  ipcMain.handle(
    "automations:toggle",
    async (_event, id: string, enabled: boolean) =>
      automationService.toggle(id, enabled),
  );

  ipcMain.handle("automations:run", async (_event, id: string) => {
    const directories = permissionsService.list();
    const preferences = preferencesService.get();
    return automationService.run(id, directories, preferences);
  });

  ipcMain.handle("automations:create", async (_event, input) =>
    automationService.create(input),
  );

  ipcMain.handle("automations:update", async (_event, id: string, fields) =>
    automationService.update(id, fields),
  );

  ipcMain.handle("automations:delete", async (_event, id: string) => {
    automationService.delete(id);
  });

  ipcMain.handle("settings:get-preferences", async () => preferencesService.get());

  ipcMain.handle(
    "settings:update-preferences",
    async (_event, preferences) => preferencesService.update(preferences),
  );
};
