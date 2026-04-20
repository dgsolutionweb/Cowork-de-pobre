import { contextBridge, ipcRenderer } from "electron";
import type {
  BrowseFilesInput,
  CreateProjectInput,
  CreateAutomationInput,
  DesktopAPI,
  FileWatchEvent,
  PermissionPolicy,
  PersistedConversation,
  ProjectInstructionScope,
} from "../shared/types";

const api: DesktopAPI = {
  dashboard: {
    getOverview: () => ipcRenderer.invoke("dashboard:get-overview"),
  },

  projects: {
    list: () => ipcRenderer.invoke("projects:list"),
    get: (id: string) => ipcRenderer.invoke("projects:get", id),
    create: (input: CreateProjectInput) => ipcRenderer.invoke("projects:create", input),
    setActive: (id: string) => ipcRenderer.invoke("projects:set-active", id),
    archive: (id: string) => ipcRenderer.invoke("projects:archive", id),
    delete: (id: string) => ipcRenderer.invoke("projects:delete", id),
    updateInstruction: (
      projectId: string,
      instruction: { scope: ProjectInstructionScope; path?: string; content: string },
    ) => ipcRenderer.invoke("projects:update-instruction", projectId, instruction),
    updatePolicy: (
      projectId: string,
      policy: Partial<Pick<PermissionPolicy, "domainAllowlist" | "allowDestructive" | "fileRoots">>,
    ) => ipcRenderer.invoke("projects:update-policy", projectId, policy),
    addContextItem: (
      projectId: string,
      input: { type: "file" | "url" | "text"; value: string; metadata?: any },
    ) => ipcRenderer.invoke("projects:add-context-item", projectId, input),
    removeContextItem: (projectId: string, itemId: string) =>
      ipcRenderer.invoke("projects:remove-context-item", projectId, itemId),
    saveMemory: (
      projectId: string,
      input: { key: string; value: string; category: "fact" | "decision" | "preference" },
    ) => ipcRenderer.invoke("projects:save-memory", projectId, input),
    listMemories: (projectId: string) =>
      ipcRenderer.invoke("projects:list-memories", projectId),
    listApprovalEvents: (limit?: number) =>
      ipcRenderer.invoke("projects:list-approval-events", limit),
    pickRootFolder: () => ipcRenderer.invoke("projects:pick-root-folder"),
    pickParentFolder: () => ipcRenderer.invoke("projects:pick-parent-folder"),
    searchContext: (projectId: string, query: string) =>
      ipcRenderer.invoke("projects:search-context", projectId, query),
  },

  assistant: {
    getSuggestions: () => ipcRenderer.invoke("assistant:get-suggestions"),
    previewCommand: (commandText: string) =>
      ipcRenderer.invoke("assistant:preview-command", commandText),
    executeDraft: (draftId: string) =>
      ipcRenderer.invoke("assistant:execute-draft", draftId),
    cancelDraft: (draftId: string) =>
      ipcRenderer.invoke("assistant:cancel-draft", draftId),
    chat: (conversationId: string, message: string) =>
      ipcRenderer.invoke("assistant:chat", conversationId, message),
  },

  conversations: {
    list: () => ipcRenderer.invoke("conversations:list"),
    get: (id: string) => ipcRenderer.invoke("conversations:get", id),
    save: (conversation: PersistedConversation) =>
      ipcRenderer.invoke("conversations:save", conversation),
    delete: (id: string) => ipcRenderer.invoke("conversations:delete", id),
    clearAll: () => ipcRenderer.invoke("conversations:clear-all"),
  },

  files: {
    browse: (input?: BrowseFilesInput) => ipcRenderer.invoke("files:browse", input),
    getAuthorizedDirectories: () => ipcRenderer.invoke("files:get-authorized-directories"),
    addAuthorizedDirectory: (directoryPath: string, name?: string) =>
      ipcRenderer.invoke("files:add-authorized-directory", directoryPath, name),
    pickAuthorizedDirectory: () => ipcRenderer.invoke("files:pick-authorized-directory"),
    removeAuthorizedDirectory: (id: string) =>
      ipcRenderer.invoke("files:remove-authorized-directory", id),
    renameFile: (filePath: string, newName: string) =>
      ipcRenderer.invoke("files:rename-file", filePath, newName),
    moveFile: (filePath: string, destDirPath: string) =>
      ipcRenderer.invoke("files:move-file", filePath, destDirPath),
    deleteFile: (filePath: string) => ipcRenderer.invoke("files:delete-file", filePath),
    deleteMany: (filePaths: string[]) =>
      ipcRenderer.invoke("files:delete-many", filePaths),
    moveMany: (filePaths: string[], destDirPath: string) =>
      ipcRenderer.invoke("files:move-many", filePaths, destDirPath),
    renameWithPattern: (filePaths: string[], pattern: string) =>
      ipcRenderer.invoke("files:rename-pattern", filePaths, pattern),
    preview: (filePath: string) => ipcRenderer.invoke("files:preview", filePath),
  },

  history: {
    list: () => ipcRenderer.invoke("history:list"),
  },

  automations: {
    list: () => ipcRenderer.invoke("automations:list"),
    toggle: (id: string, enabled: boolean) =>
      ipcRenderer.invoke("automations:toggle", id, enabled),
    run: (id: string) => ipcRenderer.invoke("automations:run", id),
    create: (input: CreateAutomationInput) =>
      ipcRenderer.invoke("automations:create", input),
    update: (id: string, fields: Partial<CreateAutomationInput>) =>
      ipcRenderer.invoke("automations:update", id, fields),
    delete: (id: string) => ipcRenderer.invoke("automations:delete", id),
    listTemplates: () => ipcRenderer.invoke("automations:list-templates"),
  },

  vault: {
    list: () => ipcRenderer.invoke("vault:list"),
    restore: (id: string) => ipcRenderer.invoke("vault:restore", id),
    purge: (id: string) => ipcRenderer.invoke("vault:purge", id),
    purgeAll: () => ipcRenderer.invoke("vault:purge-all"),
  },

  errors: {
    list: () => ipcRenderer.invoke("errors:list"),
    clear: () => ipcRenderer.invoke("errors:clear"),
    export: () => ipcRenderer.invoke("errors:export"),
  },

  search: {
    global: (query: string) => ipcRenderer.invoke("search:global", query),
  },

  research: {
    startDeepResearch: (objective: string) => ipcRenderer.invoke("research:start", objective),
    exportArtifact: (projectId: string, title: string, content: string) => 
      ipcRenderer.invoke("research:export-artifact", projectId, title, content),
    onProgress: (callback: (msg: string) => void) => {
      const listener = (_: any, msg: string) => callback(msg);
      ipcRenderer.on("research:progress", listener);
      return () => ipcRenderer.removeListener("research:progress", listener);
    },
  },

  watcher: {
    onEvent: (callback: (event: FileWatchEvent) => void) => {
      const listener = (_: Electron.IpcRendererEvent, event: FileWatchEvent) =>
        callback(event);
      ipcRenderer.on("watcher:event", listener);
      return () => ipcRenderer.removeListener("watcher:event", listener);
    },
    recent: () => ipcRenderer.invoke("watcher:recent"),
    markSeen: () => ipcRenderer.invoke("watcher:mark-seen"),
  },

  settings: {
    getPreferences: () => ipcRenderer.invoke("settings:get-preferences"),
    updatePreferences: (preferences) =>
      ipcRenderer.invoke("settings:update-preferences", preferences),
  },

  notifications: {
    test: () => ipcRenderer.invoke("notifications:test"),
  },

  connectors: {
    list: (projectId?) => ipcRenderer.invoke("connectors:list", projectId),
    create: (input) => ipcRenderer.invoke("connectors:create", input),
    delete: (id) => ipcRenderer.invoke("connectors:delete", id),
    update: (id, config) => ipcRenderer.invoke("connectors:update", id, config),
    items: (id: string) => ipcRenderer.invoke("connectors:items", id),
    sync: (id?: string) => ipcRenderer.invoke("connectors:sync", id),
    oauth: {
      githubStart: (clientId: string, clientSecret: string, connectorName: string) =>
        ipcRenderer.invoke("connectors:oauth:github:start", clientId, clientSecret, connectorName),
      googleStart: (clientId: string, clientSecret: string, connectorName: string) =>
        ipcRenderer.invoke("connectors:oauth:google:start", clientId, clientSecret, connectorName),
    },
  },
};

contextBridge.exposeInMainWorld("cowork", api);
