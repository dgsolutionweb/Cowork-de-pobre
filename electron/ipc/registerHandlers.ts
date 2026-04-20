import type { BrowserWindow } from "electron";
import { ipcMain } from "electron";
import path from "node:path";
import fs from "node:fs/promises";
import type { CreateAutomationInput } from "../../shared/types";
import { getDatabase } from "../db/database";
import { AuthorizedDirectoriesRepository } from "../repositories/authorizedDirectoriesRepository";
import { AutomationsRepository } from "../repositories/automationsRepository";
import { ConversationsRepository } from "../repositories/conversationsRepository";
import { ErrorLogRepository } from "../repositories/errorLogRepository";
import { FileWatchEventsRepository } from "../repositories/fileWatchEventsRepository";
import { HistoryRepository } from "../repositories/historyRepository";
import { PermissionPoliciesRepository } from "../repositories/permissionPoliciesRepository";
import { PreferencesRepository } from "../repositories/preferencesRepository";
import { ProjectInstructionsRepository } from "../repositories/projectInstructionsRepository";
import { ProjectContextItemsRepository } from "../repositories/projectContextItemsRepository";
import { ProjectMemoriesRepository } from "../repositories/projectMemoriesRepository";
import { ProjectRunsRepository } from "../repositories/projectRunsRepository";
import { ProjectFileIndexRepository } from "../repositories/projectFileIndexRepository";
import { ProjectChunksRepository } from "../repositories/projectChunksRepository";
import { ProjectIndexingService } from "../services/projectIndexingService";
import { DeepResearchService } from "../services/deepResearchService";
import { ProjectsRepository } from "../repositories/projectsRepository";
import { VaultRepository } from "../repositories/vaultRepository";
import { ApprovalEventsRepository } from "../repositories/approvalEventsRepository";
import { AutomationService } from "../services/automationService";
import { CommandParserService } from "../services/commandParserService";
import { ConversationService } from "../services/conversationService";
import { DashboardService } from "../services/dashboardService";
import { DocumentService } from "../services/documentService";
import { ErrorLogService } from "../services/errorLogService";
import { FileService } from "../services/fileService";
import { FileWatcherService } from "../services/fileWatcherService";
import { GeminiService } from "../services/geminiService";
import { GeminiChatService } from "../services/geminiChatService";
import { HistoryService } from "../services/historyService";
import { NotificationService } from "../services/notificationService";
import { PermissionsService } from "../services/permissionsService";
import { PreferencesService } from "../services/preferencesService";
import { ProjectsService } from "../services/projectsService";
import { RuntimePolicyService } from "../services/runtimePolicyService";
import { SearchService } from "../services/searchService";
import { SchedulerService } from "../services/schedulerService";
import { TaskExecutionService } from "../services/taskExecutionService";
import { VaultService } from "../services/vaultService";
import { connectorService } from "../services/connectorService";
import { startGitHubOAuth, startGoogleOAuth } from "../services/oauthService";
import { syncConnector, syncAll, getConnectorItems } from "../services/connectorSyncService";

const AUTOMATION_TEMPLATES = [
  {
    id: "tpl-01",
    title: "Organizar Downloads Diário",
    description: "Move arquivos novos em Downloads para subpastas por tipo.",
    commandText: "Organize minha pasta Downloads por tipo de arquivo",
    defaultSchedule: "Diariamente às 09:00",
    category: "organização",
  },
  {
    id: "tpl-02",
    title: "Arquivar PDFs Antigos",
    description: "Lista PDFs para revisão e arquivamento manual.",
    commandText: "Liste todos os PDFs e me mostre os mais antigos",
    defaultSchedule: "Semanalmente · Segunda às 08:00",
    category: "limpeza",
  },
  {
    id: "tpl-03",
    title: "Buscar Duplicados Semanal",
    description: "Detecta arquivos duplicados nas pastas autorizadas.",
    commandText: "Encontre arquivos duplicados nas minhas pastas",
    defaultSchedule: "Semanalmente · Sexta às 18:00",
    category: "limpeza",
  },
  {
    id: "tpl-04",
    title: "Relatório Semanal de Produção",
    description: "Gera relatório com os arquivos criados na semana.",
    commandText: "Crie um relatório com os arquivos criados esta semana",
    defaultSchedule: "Semanalmente · Sexta às 17:00",
    category: "documentos",
  },
  {
    id: "tpl-05",
    title: "Organizar Imagens por Mês",
    description: "Agrupa imagens em subpastas por período.",
    commandText: "Mova todas as imagens para uma pasta Imagens organizada",
    defaultSchedule: "Mensalmente · Dia 1 às 10:00",
    category: "organização",
  },
  {
    id: "tpl-06",
    title: "Padronizar Nomes de Contratos",
    description: "Renomeia arquivos com padrão data + sequência.",
    commandText: "Renomeie os arquivos de contratos com padrão profissional",
    defaultSchedule: "Manual sob demanda",
    category: "produtividade",
  },
  {
    id: "tpl-07",
    title: "Criar Pasta de Cliente",
    description: "Estrutura nova pasta de cliente em Documentos.",
    commandText: "Crie uma pasta de cliente nova em Documentos",
    defaultSchedule: "Manual sob demanda",
    category: "produtividade",
  },
  {
    id: "tpl-08",
    title: "Verificar Arquivos Recentes",
    description: "Lista os arquivos modificados nas últimas 24h.",
    commandText: "Mostre os arquivos modificados mais recentemente",
    defaultSchedule: "Diariamente às 08:00",
    category: "produtividade",
  },
  {
    id: "tpl-09",
    title: "Consolidar Documentos Word",
    description: "Lista todos os .docx para revisão e organização.",
    commandText: "Liste todos os documentos Word nas pastas autorizadas",
    defaultSchedule: "Semanalmente · Segunda às 09:00",
    category: "documentos",
  },
  {
    id: "tpl-10",
    title: "Relatório Mensal de Arquivos",
    description: "Resume o volume de arquivos por tipo no mês.",
    commandText: "Crie um relatório mensal de todos os meus arquivos organizados por tipo",
    defaultSchedule: "Mensalmente · Dia 30 às 18:00",
    category: "documentos",
  },
] as const;

export const registerHandlers = (window: BrowserWindow) => {
  const db = getDatabase();

  // repositories
  const directoriesRepository = new AuthorizedDirectoriesRepository(db);
  const historyRepository = new HistoryRepository(db);
  const automationsRepository = new AutomationsRepository(db);
  const preferencesRepository = new PreferencesRepository(db);
  const projectsRepository = new ProjectsRepository(db);
  const projectInstructionsRepository = new ProjectInstructionsRepository(db);
  const projectContextItemsRepository = new ProjectContextItemsRepository(db);
  const projectMemoriesRepository = new ProjectMemoriesRepository(db);
  const projectRunsRepository = new ProjectRunsRepository(db);
  const projectFileIndexRepository = new ProjectFileIndexRepository(db);
  const projectChunksRepository = new ProjectChunksRepository(db);
  const permissionPoliciesRepository = new PermissionPoliciesRepository(db);
  const approvalEventsRepository = new ApprovalEventsRepository(db);
  const conversationsRepository = new ConversationsRepository(db);
  const vaultRepository = new VaultRepository(db);
  const errorLogRepository = new ErrorLogRepository(db);
  const fileWatchEventsRepository = new FileWatchEventsRepository(db);

  // core services
  const preferencesService = new PreferencesService(preferencesRepository);
  const historyService = new HistoryService(historyRepository);
  const notificationService = new NotificationService();
  const errorLogService = new ErrorLogService(errorLogRepository);
  const vaultService = new VaultService(vaultRepository);
  const conversationService = new ConversationService(conversationsRepository);
  const searchService = new SearchService();
  const runtimePolicyService = new RuntimePolicyService(
    approvalEventsRepository,
    permissionPoliciesRepository,
  );

  const prefs = preferencesService.get();
  notificationService.setEnabled(prefs.notificationsEnabled);

  const fileService = new FileService();
  fileService.setVaultService(vaultService);

  const fileWatcherService = new FileWatcherService(fileWatchEventsRepository, window);

  const documentService = new DocumentService();
  const projectIndexingService = new ProjectIndexingService(
    projectFileIndexRepository,
    projectChunksRepository,
    documentService,
  );
  const deepResearchService = new DeepResearchService(projectIndexingService);
  const geminiService = new GeminiService();
  const geminiChatService = new GeminiChatService();
  const permissionsService = new PermissionsService(directoriesRepository);
  const parserService = new CommandParserService(geminiService);
  const projectsService = new ProjectsService(
    projectsRepository,
    projectInstructionsRepository,
    permissionPoliciesRepository,
    projectContextItemsRepository,
    projectMemoriesRepository,
    permissionsService,
    preferencesService,
  );
  const taskExecutionService = new TaskExecutionService(parserService, fileService, historyService);
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
    preferencesService,
    notificationService,
    errorLogService,
  );

  permissionsService.ensureStarterDirectories();
  automationService.ensureDefaults();
  schedulerService.start();

  // start file watcher
  const dirs = permissionsService.list();
  fileWatcherService.startWatching(dirs);

  const conversations = new Map<string, unknown[]>();

  // ─── Dashboard ────────────────────────────────────────────────────────────────
  ipcMain.handle("dashboard:get-overview", async () => {
    const prefs = preferencesService.get();
    return dashboardService.getOverview(prefs.activeProjectId || undefined);
  });

  // ─── Projects ───────────────────────────────────────────────────────────────
  ipcMain.handle("projects:list", async () => projectsService.list());

  ipcMain.handle("projects:get", async (_event, id: string) => projectsService.get(id));

  ipcMain.handle("projects:create", async (_event, input) => projectsService.create(input));

  ipcMain.handle("projects:set-active", async (_event, id: string) => {
    const summary = projectsService.setActive(id);
    if (summary) {
      // background indexing
      projectIndexingService.indexProject(summary.id, summary.rootPath).catch(console.error);
    }
    return summary;
  });

  ipcMain.handle("projects:index", async (_event, id: string) => {
    const summary = projectsRepository.get(id);
    if (summary) {
      await projectIndexingService.indexProject(summary.id, summary.rootPath);
    }
  });

  ipcMain.handle("projects:search-context", async (_event, id: string, query: string) =>
    projectIndexingService.search(id, query),
  );

  ipcMain.handle("projects:archive", async (_event, id: string) => {
    runtimePolicyService.recordApprovedAction({
      projectId: id,
      actionType: "project.archive",
      target: id,
      details: "Archive triggered from projects UI",
    });
    return projectsService.archive(id);
  });

  ipcMain.handle("projects:delete", async (_event, id: string) => {
    runtimePolicyService.recordApprovedAction({
      projectId: id,
      actionType: "project.delete",
      target: id,
      details: "Delete triggered from projects UI",
    });
    return projectsService.delete(id);
  });

  ipcMain.handle("projects:update-instruction", async (_event, projectId: string, instruction) =>
    projectsService.updateInstruction(projectId, instruction),
  );

  ipcMain.handle("projects:update-policy", async (_event, projectId: string, policy) =>
    projectsService.updatePolicy(projectId, policy),
  );

  ipcMain.handle("projects:add-context-item", async (_event, projectId: string, input) =>
    projectsService.addContextItem(projectId, input),
  );

  ipcMain.handle("projects:remove-context-item", async (_event, projectId: string, itemId: string) =>
    projectsService.removeContextItem(projectId, itemId),
  );

  ipcMain.handle("projects:save-memory", async (_event, projectId: string, input) =>
    projectsService.saveMemory(projectId, input),
  );

  ipcMain.handle("projects:list-memories", async (_event, projectId: string) =>
    projectsService.listMemories(projectId),
  );

  ipcMain.handle("projects:list-approval-events", async (_event, limit?: number) =>
    runtimePolicyService.listApprovalEvents(limit),
  );

  ipcMain.handle("projects:pick-root-folder", async () => projectsService.pickRootFolder(window));
  ipcMain.handle("projects:pick-parent-folder", async () => projectsService.pickParentFolder(window));

  // ─── Assistant ────────────────────────────────────────────────────────────────
  ipcMain.handle("assistant:get-suggestions", async () => [
    { title: "Organizar Downloads", prompt: "Organize minha pasta Downloads", intent: "organize_downloads" },
    { title: "Listar PDFs", prompt: "Liste todos os PDFs desta semana", intent: "list_pdfs" },
    { title: "Buscar duplicados", prompt: "Encontre arquivos duplicados e me mostre antes de excluir", intent: "find_duplicates" },
  ]);

  ipcMain.handle("assistant:preview-command", async (_event, commandText: string) => {
    const directories = permissionsService.list();
    const preferences = preferencesService.get();
    return taskExecutionService.previewCommand(commandText, directories, preferences);
  });

  ipcMain.handle("assistant:execute-draft", async (_event, draftId: string) => {
    const directories = permissionsService.list();
    const prefs = preferencesService.get();
    const result = await taskExecutionService.executeDraft(
      draftId,
      directories,
      prefs.activeProjectId || undefined,
    );
    if (result.status === "completed") {
      notificationService.sendTaskCompleted(result.summary);
    }
    return result;
  });

  ipcMain.handle("assistant:cancel-draft", async (_event, draftId: string) => {
    taskExecutionService.cancelDraft(draftId);
  });

  ipcMain.handle("assistant:chat", async (_event, conversationId: string, message: string) => {
    const history = (conversations.get(conversationId) ?? []) as Parameters<
      typeof geminiChatService.chat
    >[0];
    const directories = permissionsService.list();
    const preferences = preferencesService.get();
    const project = preferences.activeProjectId
      ? await projectsService.get(preferences.activeProjectId)
      : null;

    try {
      // RAG: Search for relevant chunks if project is active
      let ragContext = "";
      if (project) {
        const chunks = await projectIndexingService.search(project.project.id, message, 3);
        if (chunks.length > 0) {
          ragContext = "\n\nCONTEXTO RELEVANTE ENCONTRADO NOS ARQUIVOS DO PROJETO:\n" + 
            chunks.map(c => `[Arquivo: ${path.basename(c.filePath)}]\n${c.content}`).join("\n---\n");
        }
      }

      const connectors = connectorService.listAll();

      const result = await geminiChatService.chat(
        history,
        message + ragContext,
        { directories, preferences, project: project ?? undefined, connectors },
        fileService,
        documentService,
        taskExecutionService,
        projectsService,
        deepResearchService,
      );

      conversations.set(conversationId, result.updatedHistory);

      return {
        assistantText: result.assistantText,
        pendingPreviews: result.pendingPreviews,
        pendingFileOps: result.pendingFileOps,
        toolsUsed: result.toolsUsed,
      };
    } catch (error) {
      errorLogService.log("gemini", error, `chat:${conversationId}`);
      throw error;
    }
  });

  // ─── Conversations ────────────────────────────────────────────────────────────
  ipcMain.handle("conversations:list", async () => {
    const prefs = preferencesService.get();
    return conversationService.list(prefs.activeProjectId || undefined);
  });
  ipcMain.handle("conversations:get", async (_event, id: string) => conversationService.get(id));
  ipcMain.handle("conversations:save", async (_event, conversation) =>
    conversationService.save(conversation),
  );
  ipcMain.handle("conversations:delete", async (_event, id: string) =>
    conversationService.delete(id),
  );
  ipcMain.handle("conversations:clear-all", async () => conversationService.clearAll());

  // ─── Files ────────────────────────────────────────────────────────────────────
  ipcMain.handle("files:browse", async (_event, input) => {
    const directories = permissionsService.list();
    return fileService.browseAuthorizedFiles(directories, input);
  });

  ipcMain.handle("files:get-authorized-directories", async () => permissionsService.list());

  ipcMain.handle("files:add-authorized-directory", async (_event, directoryPath: string, name?: string) =>
    permissionsService.add(directoryPath, name),
  );

  ipcMain.handle("files:pick-authorized-directory", async () => {
    const directory = await permissionsService.pick(window);
    if (directory) {
      fileWatcherService.startWatching(permissionsService.list());
    }
    return directory;
  });

  ipcMain.handle("files:remove-authorized-directory", async (_event, id: string) => {
    runtimePolicyService.recordApprovedAction({
      projectId: preferencesService.get().activeProjectId || undefined,
      actionType: "directory.remove.authorization",
      target: id,
      details: "Authorized directory removed",
    });
    permissionsService.remove(id);
    // restart watcher without removed dir
    fileWatcherService.startWatching(permissionsService.list());
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
    const prefs = preferencesService.get();
    runtimePolicyService.recordApprovedAction({
      projectId: prefs.activeProjectId || undefined,
      actionType: "file.delete.single",
      target: filePath,
    });
    return fileService.deleteSingleFile(filePath, allowedPaths, prefs.deletionMode === "vault");
  });

  ipcMain.handle("files:delete-many", async (_event, filePaths: string[]) => {
    const allowedPaths = permissionsService.list().map((d) => d.path);
    const prefs = preferencesService.get();
    runtimePolicyService.recordApprovedAction({
      projectId: prefs.activeProjectId || undefined,
      actionType: "file.delete.bulk",
      target: `${filePaths.length} item(ns)`,
      details: filePaths.slice(0, 10).join("\n"),
    });
    return fileService.deleteMany(filePaths, allowedPaths, prefs.deletionMode === "vault");
  });

  ipcMain.handle("files:move-many", async (_event, filePaths: string[], destDirPath: string) => {
    const allowedPaths = permissionsService.list().map((d) => d.path);
    return fileService.moveMany(filePaths, destDirPath, allowedPaths);
  });

  ipcMain.handle(
    "files:rename-pattern",
    async (_event, filePaths: string[], pattern: string) => {
      const allowedPaths = permissionsService.list().map((d) => d.path);
      return fileService.renameWithPattern(filePaths, pattern, allowedPaths);
    },
  );

  ipcMain.handle("files:preview", async (_event, filePath: string) => {
    const allowedPaths = permissionsService.list().map((d) => d.path);
    return fileService.previewFile(filePath, allowedPaths);
  });

  // ─── History ─────────────────────────────────────────────────────────────────
  ipcMain.handle("history:list", async () => {
    const prefs = preferencesService.get();
    return historyService.list(prefs.activeProjectId || undefined);
  });

  // ─── Automations ─────────────────────────────────────────────────────────────
  ipcMain.handle("automations:list", async () => {
    const prefs = preferencesService.get();
    return automationService.list(prefs.activeProjectId || undefined);
  });

  ipcMain.handle("automations:toggle", async (_event, id: string, enabled: boolean) =>
    automationService.toggle(id, enabled),
  );

  ipcMain.handle("automations:run", async (_event, id: string) => {
    const directories = permissionsService.list();
    const preferences = preferencesService.get();
    const result = await automationService.run(
      id,
      directories,
      preferences,
      preferences.activeProjectId || undefined,
    );
    if (result.status === "completed") {
      const auto = automationService.list(preferences.activeProjectId || undefined).find((a) => a.id === id);
      if (auto) notificationService.sendAutomationCompleted(auto.name, result.summary);
    }
    return result;
  });

  ipcMain.handle("automations:create", async (_event, input: CreateAutomationInput) => {
    const prefs = preferencesService.get();
    const projectId = input.projectId || prefs.activeProjectId || undefined;
    return automationService.create({ ...input, projectId });
  });

  ipcMain.handle("automations:update", async (_event, id: string, fields) =>
    automationService.update(id, fields),
  );

  ipcMain.handle("automations:delete", async (_event, id: string) => {
    automationService.delete(id);
  });

  ipcMain.handle("automations:list-templates", async () => AUTOMATION_TEMPLATES);

  // ─── Vault ───────────────────────────────────────────────────────────────────
  ipcMain.handle("vault:list", async () => vaultService.list());
  ipcMain.handle("vault:restore", async (_event, id: string) => vaultService.restore(id));
  ipcMain.handle("vault:purge", async (_event, id: string) => vaultService.purge(id));
  ipcMain.handle("vault:purge-all", async () => vaultService.purgeAll());

  // ─── Errors ──────────────────────────────────────────────────────────────────
  ipcMain.handle("errors:list", async () => errorLogService.list());
  ipcMain.handle("errors:clear", async () => errorLogService.clear());
  ipcMain.handle("errors:export", async () => errorLogService.export());

  // ─── Search ──────────────────────────────────────────────────────────────────
  ipcMain.handle("search:global", async (_event, query: string) => {
    const directories = permissionsService.list();
    const allFiles = await fileService.browseAuthorizedFiles(directories, { limit: 300 });
    const history = historyService.list();
    const automations = automationService.list();
    const projects = projectsService.list();
    return searchService.search(query, {
      files: allFiles.files,
      directories,
      history,
      automations,
      projects,
    });
  });

  // ─── Research ────────────────────────────────────────────────────────────────
  ipcMain.handle("research:start", async (_event, objective: string) => {
    const preferences = preferencesService.get();
    const project = preferences.activeProjectId
      ? await projectsService.get(preferences.activeProjectId)
      : null;

    const apiKey = preferences.geminiApiKey?.trim();
    if (!apiKey) {
      throw new Error("Chave da API do Gemini não configurada.");
    }
    const model = preferences.geminiModel || "gemini-2.5-flash";

    return deepResearchService.executeResearch(
      apiKey,
      model,
      objective,
      project ?? null,
      (msg) => {
        if (!window.isDestroyed()) {
          window.webContents.send("research:progress", msg);
        }
      }
    );
  });

  ipcMain.handle("research:export-artifact", async (_event, projectId: string, title: string, content: string) => {
    const project = await projectsService.get(projectId);
    if (!project) throw new Error("Projeto não encontrado.");

    const safeTitle = title.replace(/[^a-z0-9]/gi, '-').toLowerCase() || 'relatorio-pesquisa';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${safeTitle}-${timestamp}.md`;
    const targetPath = path.join(project.project.rootPath, fileName);

    await fs.writeFile(targetPath, content, { encoding: "utf8" });

    // Index the newly generated file into the project's RAG context automatically
    await projectIndexingService.indexProject(projectId);

    return { filePath: targetPath };
  });

  // ─── Watcher ─────────────────────────────────────────────────────────────────
  ipcMain.handle("watcher:recent", async () => fileWatcherService.recent());
  ipcMain.handle("watcher:mark-seen", async () => fileWatcherService.markSeen());

  // ─── Settings ────────────────────────────────────────────────────────────────
  ipcMain.handle("settings:get-preferences", async () => preferencesService.get());

  ipcMain.handle("settings:update-preferences", async (_event, preferences) => {
    const updated = preferencesService.update(preferences);
    notificationService.setEnabled(updated.notificationsEnabled);
    return updated;
  });

  // ─── Notifications ────────────────────────────────────────────────────────────
  ipcMain.handle("notifications:test", async () => notificationService.test());
  // ─── Connectors ──────────────────────────────────────────────────────────────
  ipcMain.handle("connectors:list", async (_event, projectId?: string) => connectorService.list(projectId));
  ipcMain.handle("connectors:create", async (_event, input: any) => connectorService.create(input));
  ipcMain.handle("connectors:delete", async (_event, id: string) => connectorService.delete(id));
  ipcMain.handle("connectors:update", async (_event, id: string, config: any) => connectorService.update(id, config));
  ipcMain.handle("connectors:items", async (_event, id: string) => getConnectorItems(id));

  ipcMain.handle("connectors:sync", async (_event, id?: string) => {
    if (id) {
      const result = await syncConnector(id);
      return [result];
    }
    return syncAll();
  });

  // ─── OAuth ───────────────────────────────────────────────────────────────────
  ipcMain.handle(
    "connectors:oauth:github:start",
    async (_event, clientId: string, clientSecret: string, connectorName: string) => {
      return startGitHubOAuth(clientId, clientSecret, connectorName);
    }
  );

  ipcMain.handle(
    "connectors:oauth:google:start",
    async (_event, clientId: string, clientSecret: string, connectorName: string) => {
      return startGoogleOAuth(clientId, clientSecret, connectorName);
    }
  );
};
