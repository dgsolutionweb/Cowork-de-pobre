export type CommandIntent =
  | "organize_downloads"
  | "list_pdfs"
  | "move_images"
  | "rename_files"
  | "create_client_folder"
  | "find_duplicates"
  | "show_recent_files"
  | "unknown";

export type TaskStatus = "completed" | "failed" | "cancelled" | "preview";

export type ActionType = "move" | "rename" | "create-folder" | "analyze";

export interface AuthorizedDirectory {
  id: string;
  name: string;
  path: string;
  createdAt: string;
}

export interface FileItem {
  name: string;
  path: string;
  extension: string;
  size: number;
  modifiedAt: string;
  isDirectory: boolean;
  directoryName?: string;
  previewLabel?: string;
}

export interface ParsedCommand {
  intent: CommandIntent;
  confidence: number;
  parameters: Record<string, string | number | boolean | undefined>;
  summary: string;
  requiresConfirmation: boolean;
}

export interface PreviewAction {
  id: string;
  type: ActionType;
  label: string;
  source?: string;
  destination?: string;
  risk: string;
  fileCount: number;
}

export interface CommandPreview {
  draftId: string;
  commandText: string;
  parsed: ParsedCommand;
  headline: string;
  explanation: string;
  risks: string[];
  actions: PreviewAction[];
  files: FileItem[];
  createdAt: string;
  requiresConfirmation: boolean;
}

export interface ExecutionResult {
  historyId: string;
  status: TaskStatus;
  summary: string;
  affectedFiles: FileItem[];
  logs: string[];
  executedAt: string;
  errorMessage?: string;
}

export interface HistoryEntry {
  id: string;
  commandText: string;
  intent: CommandIntent;
  status: TaskStatus;
  confirmed: boolean;
  summary: string;
  affectedFiles: FileItem[];
  createdAt: string;
  executedAt?: string;
  errorMessage?: string;
}

export interface Automation {
  id: string;
  name: string;
  description: string;
  commandText: string;
  schedule: string;
  enabled: boolean;
  lastRunAt?: string;
  lastStatus?: TaskStatus;
  createdAt: string;
}

export interface AppPreferences {
  theme: "dark" | "system";
  deletionMode: "vault" | "confirm";
  aiReady: boolean;
  geminiApiKey: string;
  geminiModel: string;
}

export interface DashboardMetrics {
  organizedFilesCount: number;
  executedTasksCount: number;
  activeAutomationsCount: number;
  authorizedDirectoriesCount: number;
}

export interface DashboardData {
  metrics: DashboardMetrics;
  recentHistory: HistoryEntry[];
  recentDirectories: AuthorizedDirectory[];
  recentAutomations: Automation[];
}

export interface FileExplorerData {
  directories: AuthorizedDirectory[];
  files: FileItem[];
  scannedAt: string;
}

export interface CreateAutomationInput {
  name: string;
  description: string;
  commandText: string;
  schedule: string;
  enabled: boolean;
}

export interface AssistantSuggestion {
  title: string;
  prompt: string;
  intent: CommandIntent;
}

export interface PendingFileOperation {
  id: string;
  type: "rename" | "move" | "delete";
  filePath: string;
  fileName: string;
  newName?: string;
  destDirPath?: string;
  destDirName?: string;
  description: string;
}

export interface ConversationMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  toolsUsed?: string[];
  pendingPreviews?: CommandPreview[];
  pendingFileOps?: PendingFileOperation[];
  isLoading?: boolean;
  timestamp: string;
}

export interface AiChatResponse {
  assistantText: string;
  pendingPreviews: CommandPreview[];
  pendingFileOps: PendingFileOperation[];
  toolsUsed: string[];
}

export interface BrowseFilesInput {
  query?: string;
  extension?: string;
  directoryId?: string;
  limit?: number;
}

export interface DesktopAPI {
  dashboard: {
    getOverview: () => Promise<DashboardData>;
  };
  assistant: {
    getSuggestions: () => Promise<AssistantSuggestion[]>;
    previewCommand: (commandText: string) => Promise<CommandPreview>;
    executeDraft: (draftId: string) => Promise<ExecutionResult>;
    cancelDraft: (draftId: string) => Promise<void>;
    chat: (conversationId: string, message: string) => Promise<AiChatResponse>;
  };
  files: {
    browse: (input?: BrowseFilesInput) => Promise<FileExplorerData>;
    getAuthorizedDirectories: () => Promise<AuthorizedDirectory[]>;
    addAuthorizedDirectory: (path: string, name?: string) => Promise<AuthorizedDirectory>;
    pickAuthorizedDirectory: () => Promise<AuthorizedDirectory | null>;
    removeAuthorizedDirectory: (id: string) => Promise<void>;
    renameFile: (filePath: string, newName: string) => Promise<FileItem>;
    moveFile: (filePath: string, destDirPath: string) => Promise<FileItem>;
    deleteFile: (filePath: string) => Promise<void>;
  };
  history: {
    list: () => Promise<HistoryEntry[]>;
  };
  automations: {
    list: () => Promise<Automation[]>;
    toggle: (id: string, enabled: boolean) => Promise<Automation>;
    run: (id: string) => Promise<ExecutionResult>;
    create: (input: CreateAutomationInput) => Promise<Automation>;
    update: (id: string, fields: Partial<CreateAutomationInput>) => Promise<Automation>;
    delete: (id: string) => Promise<void>;
  };
  settings: {
    getPreferences: () => Promise<AppPreferences>;
    updatePreferences: (preferences: Partial<AppPreferences>) => Promise<AppPreferences>;
  };
}
