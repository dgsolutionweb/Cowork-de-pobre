"use strict";

// electron/preload.ts
var import_electron = require("electron");
var api = {
  dashboard: {
    getOverview: () => import_electron.ipcRenderer.invoke("dashboard:get-overview")
  },
  projects: {
    list: () => import_electron.ipcRenderer.invoke("projects:list"),
    get: (id) => import_electron.ipcRenderer.invoke("projects:get", id),
    create: (input) => import_electron.ipcRenderer.invoke("projects:create", input),
    setActive: (id) => import_electron.ipcRenderer.invoke("projects:set-active", id),
    archive: (id) => import_electron.ipcRenderer.invoke("projects:archive", id),
    delete: (id) => import_electron.ipcRenderer.invoke("projects:delete", id),
    updateInstruction: (projectId, instruction) => import_electron.ipcRenderer.invoke("projects:update-instruction", projectId, instruction),
    updatePolicy: (projectId, policy) => import_electron.ipcRenderer.invoke("projects:update-policy", projectId, policy),
    addContextItem: (projectId, input) => import_electron.ipcRenderer.invoke("projects:add-context-item", projectId, input),
    removeContextItem: (projectId, itemId) => import_electron.ipcRenderer.invoke("projects:remove-context-item", projectId, itemId),
    saveMemory: (projectId, input) => import_electron.ipcRenderer.invoke("projects:save-memory", projectId, input),
    listMemories: (projectId) => import_electron.ipcRenderer.invoke("projects:list-memories", projectId),
    listApprovalEvents: (limit) => import_electron.ipcRenderer.invoke("projects:list-approval-events", limit),
    pickRootFolder: () => import_electron.ipcRenderer.invoke("projects:pick-root-folder"),
    pickParentFolder: () => import_electron.ipcRenderer.invoke("projects:pick-parent-folder"),
    searchContext: (projectId, query) => import_electron.ipcRenderer.invoke("projects:search-context", projectId, query)
  },
  assistant: {
    getSuggestions: () => import_electron.ipcRenderer.invoke("assistant:get-suggestions"),
    previewCommand: (commandText) => import_electron.ipcRenderer.invoke("assistant:preview-command", commandText),
    executeDraft: (draftId) => import_electron.ipcRenderer.invoke("assistant:execute-draft", draftId),
    cancelDraft: (draftId) => import_electron.ipcRenderer.invoke("assistant:cancel-draft", draftId),
    chat: (conversationId, message) => import_electron.ipcRenderer.invoke("assistant:chat", conversationId, message)
  },
  conversations: {
    list: () => import_electron.ipcRenderer.invoke("conversations:list"),
    get: (id) => import_electron.ipcRenderer.invoke("conversations:get", id),
    save: (conversation) => import_electron.ipcRenderer.invoke("conversations:save", conversation),
    delete: (id) => import_electron.ipcRenderer.invoke("conversations:delete", id),
    clearAll: () => import_electron.ipcRenderer.invoke("conversations:clear-all")
  },
  files: {
    browse: (input) => import_electron.ipcRenderer.invoke("files:browse", input),
    getAuthorizedDirectories: () => import_electron.ipcRenderer.invoke("files:get-authorized-directories"),
    addAuthorizedDirectory: (directoryPath, name) => import_electron.ipcRenderer.invoke("files:add-authorized-directory", directoryPath, name),
    pickAuthorizedDirectory: () => import_electron.ipcRenderer.invoke("files:pick-authorized-directory"),
    removeAuthorizedDirectory: (id) => import_electron.ipcRenderer.invoke("files:remove-authorized-directory", id),
    renameFile: (filePath, newName) => import_electron.ipcRenderer.invoke("files:rename-file", filePath, newName),
    moveFile: (filePath, destDirPath) => import_electron.ipcRenderer.invoke("files:move-file", filePath, destDirPath),
    deleteFile: (filePath) => import_electron.ipcRenderer.invoke("files:delete-file", filePath),
    deleteMany: (filePaths) => import_electron.ipcRenderer.invoke("files:delete-many", filePaths),
    moveMany: (filePaths, destDirPath) => import_electron.ipcRenderer.invoke("files:move-many", filePaths, destDirPath),
    renameWithPattern: (filePaths, pattern) => import_electron.ipcRenderer.invoke("files:rename-pattern", filePaths, pattern),
    preview: (filePath) => import_electron.ipcRenderer.invoke("files:preview", filePath)
  },
  history: {
    list: () => import_electron.ipcRenderer.invoke("history:list")
  },
  automations: {
    list: () => import_electron.ipcRenderer.invoke("automations:list"),
    toggle: (id, enabled) => import_electron.ipcRenderer.invoke("automations:toggle", id, enabled),
    run: (id) => import_electron.ipcRenderer.invoke("automations:run", id),
    create: (input) => import_electron.ipcRenderer.invoke("automations:create", input),
    update: (id, fields) => import_electron.ipcRenderer.invoke("automations:update", id, fields),
    delete: (id) => import_electron.ipcRenderer.invoke("automations:delete", id),
    listTemplates: () => import_electron.ipcRenderer.invoke("automations:list-templates")
  },
  vault: {
    list: () => import_electron.ipcRenderer.invoke("vault:list"),
    restore: (id) => import_electron.ipcRenderer.invoke("vault:restore", id),
    purge: (id) => import_electron.ipcRenderer.invoke("vault:purge", id),
    purgeAll: () => import_electron.ipcRenderer.invoke("vault:purge-all")
  },
  errors: {
    list: () => import_electron.ipcRenderer.invoke("errors:list"),
    clear: () => import_electron.ipcRenderer.invoke("errors:clear"),
    export: () => import_electron.ipcRenderer.invoke("errors:export")
  },
  search: {
    global: (query) => import_electron.ipcRenderer.invoke("search:global", query)
  },
  research: {
    startDeepResearch: (objective) => import_electron.ipcRenderer.invoke("research:start", objective),
    exportArtifact: (projectId, title, content) => import_electron.ipcRenderer.invoke("research:export-artifact", projectId, title, content),
    onProgress: (callback) => {
      const listener = (_, msg) => callback(msg);
      import_electron.ipcRenderer.on("research:progress", listener);
      return () => import_electron.ipcRenderer.removeListener("research:progress", listener);
    }
  },
  watcher: {
    onEvent: (callback) => {
      const listener = (_, event) => callback(event);
      import_electron.ipcRenderer.on("watcher:event", listener);
      return () => import_electron.ipcRenderer.removeListener("watcher:event", listener);
    },
    recent: () => import_electron.ipcRenderer.invoke("watcher:recent"),
    markSeen: () => import_electron.ipcRenderer.invoke("watcher:mark-seen")
  },
  settings: {
    getPreferences: () => import_electron.ipcRenderer.invoke("settings:get-preferences"),
    updatePreferences: (preferences) => import_electron.ipcRenderer.invoke("settings:update-preferences", preferences)
  },
  notifications: {
    test: () => import_electron.ipcRenderer.invoke("notifications:test")
  },
  connectors: {
    list: (projectId) => import_electron.ipcRenderer.invoke("connectors:list", projectId),
    create: (input) => import_electron.ipcRenderer.invoke("connectors:create", input),
    delete: (id) => import_electron.ipcRenderer.invoke("connectors:delete", id),
    update: (id, config) => import_electron.ipcRenderer.invoke("connectors:update", id, config),
    items: (id) => import_electron.ipcRenderer.invoke("connectors:items", id),
    sync: (id) => import_electron.ipcRenderer.invoke("connectors:sync", id),
    oauth: {
      githubStart: (clientId, clientSecret, connectorName) => import_electron.ipcRenderer.invoke("connectors:oauth:github:start", clientId, clientSecret, connectorName),
      googleStart: (clientId, clientSecret, connectorName) => import_electron.ipcRenderer.invoke("connectors:oauth:google:start", clientId, clientSecret, connectorName)
    }
  }
};
import_electron.contextBridge.exposeInMainWorld("cowork", api);
