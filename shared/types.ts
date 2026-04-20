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
  projectId?: string;
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
  projectId?: string;
  name: string;
  description: string;
  commandText: string;
  schedule: string;
  enabled: boolean;
  lastRunAt?: string;
  lastStatus?: TaskStatus;
  createdAt: string;
}

export type ThemeMode = "light" | "dark" | "system";

export type ProjectStatus = "active" | "archived";

export interface ProjectSummary {
  id: string;
  name: string;
  rootPath: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt?: string;
}

export type ProjectInstructionScope = "project" | "folder";

export interface ProjectInstruction {
  id: string;
  projectId: string;
  scope: ProjectInstructionScope;
  path?: string;
  content: string;
  updatedAt: string;
}

export interface PermissionPolicy {
  id: string;
  projectId: string;
  fileRoots: string[];
  domainAllowlist: string[];
  allowDestructive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ApprovalRiskLevel = "low" | "medium" | "high";
export type ApprovalDecision = "approved" | "rejected";

export interface ApprovalEvent {
  id: string;
  projectId?: string;
  actionType: string;
  riskLevel: ApprovalRiskLevel;
  target: string;
  details?: string;
  decision: ApprovalDecision;
  createdAt: string;
}

export interface ProjectDetail {
  project: ProjectSummary;
  instructions: ProjectInstruction[];
  policy: PermissionPolicy;
}

export interface ProjectContextItem {
  id: string;
  projectId: string;
  type: "file" | "url" | "text";
  value: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface ProjectMemory {
  id: string;
  projectId: string;
  key: string;
  value: string;
  category: "fact" | "decision" | "preference";
  createdAt: string;
  updatedAt: string;
}

export interface ProjectRun {
  id: string;
  projectId: string;
  type: string;
  status: "pending" | "running" | "completed" | "failed";
  input?: string;
  output?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectFileIndex {
  id: string;
  projectId: string;
  filePath: string;
  lastIndexedAt: string;
  hash: string;
}

export interface CreateProjectInput {
  name: string;
  mode: "existing" | "new-folder";
  rootPath?: string;
  parentPath?: string;
  instructions?: string;
}

export interface AppPreferences {
  theme: ThemeMode;
  deletionMode: "vault" | "confirm";
  aiReady: boolean;
  geminiApiKey: string;
  geminiModel: string;
  customSystemPrompt: string;
  notificationsEnabled: boolean;
  onboardingCompleted: boolean;
  activeProjectId?: string;
}

export interface DashboardMetrics {
  organizedFilesCount: number;
  executedTasksCount: number;
  activeAutomationsCount: number;
  authorizedDirectoriesCount: number;
}

export interface DashboardActivityPoint {
  date: string;
  count: number;
}

export interface DashboardTypeDistribution {
  label: string;
  count: number;
}

export interface DashboardData {
  metrics: DashboardMetrics;
  recentHistory: HistoryEntry[];
  recentDirectories: AuthorizedDirectory[];
  recentAutomations: Automation[];
  activitySeries: DashboardActivityPoint[];
  typeDistribution: DashboardTypeDistribution[];
  topAutomations: Array<{ id: string; name: string; runs: number }>;
}

export interface FileExplorerData {
  directories: AuthorizedDirectory[];
  files: FileItem[];
  scannedAt: string;
}

export interface CreateAutomationInput {
  projectId?: string;
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

export interface ConversationSummary {
  id: string;
  projectId?: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export interface PersistedConversation {
  id: string;
  projectId?: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ConversationMessage[];
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

export type VaultEntryStatus = "available" | "restored" | "purged";

export interface VaultEntry {
  id: string;
  originalPath: string;
  originalName: string;
  vaultPath: string;
  size: number;
  deletedAt: string;
  status: VaultEntryStatus;
}

export type ErrorSource =
  | "scheduler"
  | "automation"
  | "ipc"
  | "gemini"
  | "filesystem"
  | "vault"
  | "watcher"
  | "unknown";

export interface ErrorLogEntry {
  id: string;
  source: ErrorSource;
  message: string;
  stack?: string;
  context?: string;
  createdAt: string;
}

export type FileWatchEventType = "added" | "changed" | "removed";

export interface FileWatchEvent {
  id: string;
  type: FileWatchEventType;
  path: string;
  name: string;
  directoryId: string;
  directoryName: string;
  detectedAt: string;
}

export interface FilePreviewResult {
  path: string;
  kind: "image" | "text" | "pdf" | "spreadsheet" | "binary";
  textPreview?: string;
  base64Image?: string;
  imageMimeType?: string;
  size: number;
  pageCount?: number;
  rowsPreview?: string[][];
}

export interface AutomationTemplate {
  id: string;
  title: string;
  description: string;
  commandText: string;
  defaultSchedule: string;
  category: "organização" | "limpeza" | "produtividade" | "documentos";
}

export type GlobalSearchHitKind = "file" | "history" | "automation" | "page" | "project";

export interface GlobalSearchHit {
  kind: GlobalSearchHitKind;
  id: string;
  title: string;
  subtitle?: string;
  hint?: string;
  payload?: Record<string, string | undefined>;
}

export interface GlobalSearchResult {
  query: string;
  hits: GlobalSearchHit[];
}

export interface ResearchResult {
  filePath: string;
  content: string;
  rank: number;
}

export interface DeepResearchResult {
  markdownReport: string;
  sources: string[];
}

export type ConnectorType = "github" | "google_drive" | "mcp" | "local_plugin";
export type ConnectorStatus = "disconnected" | "connected" | "error";

export interface ConnectorConfig {
  id: string;
  projectId?: string;
  type: ConnectorType;
  name: string;
  status: ConnectorStatus;
  config: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  lastSyncedAt?: string;
  syncError?: string;
}

export interface ConnectorSyncResult {
  connectorId: string;
  connectorName: string;
  success: boolean;
  itemsIndexed: number;
  error?: string;
}

export interface DesktopAPI {
  dashboard: {
    getOverview: () => Promise<DashboardData>;
  };
  projects: {
    list: () => Promise<ProjectSummary[]>;
    get: (id: string) => Promise<ProjectDetail | null>;
    create: (input: CreateProjectInput) => Promise<ProjectDetail>;
    setActive: (id: string) => Promise<ProjectSummary>;
    archive: (id: string) => Promise<ProjectSummary>;
    delete: (id: string) => Promise<void>;
    updateInstruction: (
      projectId: string,
      instruction: {
        scope: ProjectInstructionScope;
        path?: string;
        content: string;
      },
    ) => Promise<ProjectInstruction>;
    updatePolicy: (
      projectId: string,
      policy: Partial<Pick<PermissionPolicy, "domainAllowlist" | "allowDestructive" | "fileRoots">>,
    ) => Promise<PermissionPolicy>;
    addContextItem: (
      projectId: string,
      input: { type: "file" | "url" | "text"; value: string; metadata?: any },
    ) => Promise<ProjectContextItem>;
    removeContextItem: (projectId: string, itemId: string) => Promise<void>;
    saveMemory: (
      projectId: string,
      input: { key: string; value: string; category: ProjectMemory["category"] },
    ) => Promise<ProjectMemory>;
    listMemories: (projectId: string) => Promise<ProjectMemory[]>;
    listApprovalEvents: (limit?: number) => Promise<ApprovalEvent[]>;
    pickRootFolder: () => Promise<string | null>;
    pickParentFolder: () => Promise<string | null>;
    searchContext: (projectId: string, query: string) => Promise<ResearchResult[]>;
  };
  assistant: {
    getSuggestions: () => Promise<AssistantSuggestion[]>;
    previewCommand: (commandText: string) => Promise<CommandPreview>;
    executeDraft: (draftId: string) => Promise<ExecutionResult>;
    cancelDraft: (draftId: string) => Promise<void>;
    chat: (conversationId: string, message: string) => Promise<AiChatResponse>;
  };
  conversations: {
    list: () => Promise<ConversationSummary[]>;
    get: (id: string) => Promise<PersistedConversation | null>;
    save: (conversation: PersistedConversation) => Promise<void>;
    delete: (id: string) => Promise<void>;
    clearAll: () => Promise<void>;
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
    deleteMany: (filePaths: string[]) => Promise<{ deleted: number; vaulted: number }>;
    moveMany: (
      filePaths: string[],
      destDirPath: string,
    ) => Promise<{ moved: number; failed: number }>;
    renameWithPattern: (
      filePaths: string[],
      pattern: string,
    ) => Promise<{ renamed: number }>;
    preview: (filePath: string) => Promise<FilePreviewResult>;
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
    listTemplates: () => Promise<AutomationTemplate[]>;
  };
  vault: {
    list: () => Promise<VaultEntry[]>;
    restore: (id: string) => Promise<VaultEntry>;
    purge: (id: string) => Promise<void>;
    purgeAll: () => Promise<{ purged: number }>;
  };
  errors: {
    list: () => Promise<ErrorLogEntry[]>;
    clear: () => Promise<void>;
    export: () => Promise<string>;
  };
  search: {
    global: (query: string) => Promise<GlobalSearchResult>;
  };
  research: {
    startDeepResearch: (objective: string) => Promise<DeepResearchResult>;
    onProgress: (callback: (msg: string) => void) => () => void;
    exportArtifact: (projectId: string, title: string, content: string) => Promise<{ filePath: string }>;
  };
  watcher: {
    onEvent: (callback: (event: FileWatchEvent) => void) => () => void;
    recent: () => Promise<FileWatchEvent[]>;
    markSeen: () => Promise<void>;
  };
  settings: {
    getPreferences: () => Promise<AppPreferences>;
    updatePreferences: (preferences: Partial<AppPreferences>) => Promise<AppPreferences>;
  };
  notifications: {
    test: () => Promise<void>;
  };
  connectors: {
    list: (projectId?: string) => Promise<ConnectorConfig[]>;
    create: (input: Omit<ConnectorConfig, "id" | "status" | "createdAt" | "updatedAt">) => Promise<ConnectorConfig>;
    delete: (id: string) => Promise<void>;
    update: (id: string, config: Record<string, any>) => Promise<ConnectorConfig>;
    items: (id: string) => Promise<{ remotePath: string }[]>;
    sync: (id?: string) => Promise<ConnectorSyncResult[]>;
    oauth: {
      githubStart: (clientId: string, clientSecret: string, connectorName: string) => Promise<ConnectorConfig>;
      googleStart: (clientId: string, clientSecret: string, connectorName: string) => Promise<ConnectorConfig>;
    };
  };
}
