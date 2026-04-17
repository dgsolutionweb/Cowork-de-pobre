"use strict";

// electron/preload.ts
var import_electron = require("electron");
var api = {
  dashboard: {
    getOverview: () => import_electron.ipcRenderer.invoke("dashboard:get-overview")
  },
  assistant: {
    getSuggestions: () => import_electron.ipcRenderer.invoke("assistant:get-suggestions"),
    previewCommand: (commandText) => import_electron.ipcRenderer.invoke("assistant:preview-command", commandText),
    executeDraft: (draftId) => import_electron.ipcRenderer.invoke("assistant:execute-draft", draftId),
    cancelDraft: (draftId) => import_electron.ipcRenderer.invoke("assistant:cancel-draft", draftId),
    chat: (conversationId, message) => import_electron.ipcRenderer.invoke("assistant:chat", conversationId, message)
  },
  files: {
    browse: (input) => import_electron.ipcRenderer.invoke("files:browse", input),
    getAuthorizedDirectories: () => import_electron.ipcRenderer.invoke("files:get-authorized-directories"),
    addAuthorizedDirectory: (directoryPath, name) => import_electron.ipcRenderer.invoke("files:add-authorized-directory", directoryPath, name),
    pickAuthorizedDirectory: () => import_electron.ipcRenderer.invoke("files:pick-authorized-directory"),
    removeAuthorizedDirectory: (id) => import_electron.ipcRenderer.invoke("files:remove-authorized-directory", id),
    renameFile: (filePath, newName) => import_electron.ipcRenderer.invoke("files:rename-file", filePath, newName),
    moveFile: (filePath, destDirPath) => import_electron.ipcRenderer.invoke("files:move-file", filePath, destDirPath),
    deleteFile: (filePath) => import_electron.ipcRenderer.invoke("files:delete-file", filePath)
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
    delete: (id) => import_electron.ipcRenderer.invoke("automations:delete", id)
  },
  settings: {
    getPreferences: () => import_electron.ipcRenderer.invoke("settings:get-preferences"),
    updatePreferences: (preferences) => import_electron.ipcRenderer.invoke("settings:update-preferences", preferences)
  }
};
import_electron.contextBridge.exposeInMainWorld("cowork", api);
