import { contextBridge, ipcRenderer } from "electron";
import type { BrowseFilesInput, DesktopAPI } from "../shared/types";

const api: DesktopAPI = {
  dashboard: {
    getOverview: () => ipcRenderer.invoke("dashboard:get-overview"),
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
  files: {
    browse: (input?: BrowseFilesInput) => ipcRenderer.invoke("files:browse", input),
    getAuthorizedDirectories: () =>
      ipcRenderer.invoke("files:get-authorized-directories"),
    addAuthorizedDirectory: (directoryPath: string, name?: string) =>
      ipcRenderer.invoke("files:add-authorized-directory", directoryPath, name),
    pickAuthorizedDirectory: () =>
      ipcRenderer.invoke("files:pick-authorized-directory"),
    removeAuthorizedDirectory: (id: string) =>
      ipcRenderer.invoke("files:remove-authorized-directory", id),
    renameFile: (filePath: string, newName: string) =>
      ipcRenderer.invoke("files:rename-file", filePath, newName),
    moveFile: (filePath: string, destDirPath: string) =>
      ipcRenderer.invoke("files:move-file", filePath, destDirPath),
    deleteFile: (filePath: string) =>
      ipcRenderer.invoke("files:delete-file", filePath),
  },
  history: {
    list: () => ipcRenderer.invoke("history:list"),
  },
  automations: {
    list: () => ipcRenderer.invoke("automations:list"),
    toggle: (id: string, enabled: boolean) =>
      ipcRenderer.invoke("automations:toggle", id, enabled),
    run: (id: string) => ipcRenderer.invoke("automations:run", id),
    create: (input: import("../shared/types").CreateAutomationInput) =>
      ipcRenderer.invoke("automations:create", input),
    update: (id: string, fields: Partial<import("../shared/types").CreateAutomationInput>) =>
      ipcRenderer.invoke("automations:update", id, fields),
    delete: (id: string) => ipcRenderer.invoke("automations:delete", id),
  },
  settings: {
    getPreferences: () => ipcRenderer.invoke("settings:get-preferences"),
    updatePreferences: (preferences) =>
      ipcRenderer.invoke("settings:update-preferences", preferences),
  },
};

contextBridge.exposeInMainWorld("cowork", api);
