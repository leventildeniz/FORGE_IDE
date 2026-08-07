export type FileNode = {
  path: string;
  name: string;
  is_dir: boolean;
  children?: FileNode[]; // This now needs to reflect Option<Vec<FileNode>>
  language?: string; // Frontend specific, will be inferred or set later
  content?: string; // This now needs to reflect Option<String>
};

export type EditorTab = {
  path: string;
  name: string;
  language: string;
  content: string;
  dirty: boolean;
};

export type ChangeSetFile = {
  path: string;
  added: number;
  removed: number;
  before: string;
  after: string;
};

export type ChangeSet = {
  id: string;
  title: string;
  files: ChangeSetFile[];
  status: "pending" | "applied" | "rejected";
};

export type TerminalInstance = {
  id: string;
  title: string;
};

export type MCPTool = {
  id: string;
  name: string;
  command: string;
  args: string[];
  description?: string;
  isEnabled: boolean;
};

export type CustomProfile = {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  icon?: string;
};

export type AIChatMode = "ask" | "plan" | "code" | "debug" | string;

export type ChatMessagePart =
  | { type: "text"; text: string }
  | { type: "code"; code: string; language: string; path?: string }
  | { type: "plan"; title: string; steps: string[] }
  | { type: "change"; changeSetId: string }
  | { type: "thinking"; text: string }
  | { type: "attachment"; name: string; attachType: string }
  | { type: "compact"; text: string };

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  parts: ChatMessagePart[];
  rawContent?: string;
};

export type RecentProject = {
  id: string;
  name: string;
  path: string;
  environment_id: string; // New: Environment connection ID
  opened_at: number; // Renamed to snake_case matching backend ProjectRecord
};

export type BottomTab = "terminal" | "problems" | "output" | "changes" | "diff";

export type WorkspaceView = "preview" | "code" | "publish" | "configure" | "telemetry";

export type PreviewDevice = "desktop" | "tablet" | "mobile";

export type EnvironmentKind = "local" | "wsl" | "ssh";

export type Environment = {
  id: string;
  name: string;
  kind: EnvironmentKind;
  detail: string; // e.g. "Ubuntu-22.04" or "user@host:port"
  status: "connected" | "disconnected";
  // Yeni SSH bağlantı detayları (kind === "ssh" ise geçerli)
  host?: string;
  username?: string;
  port?: number; // Varsayılan 22 olabilir
  password?: string; // Güvenlik nedeniyle dikkatli kullanılmalı, API'de direkt tutulmamalı
  privateKeyPath?: string; // SSH anahtar yolu
};

export type ModelConnection = "local" | "remote" | "api";

export type AIModel = {
  id: string;
  name: string;
  provider: string;
  connection: ModelConnection;
  endpoint: string;
  identifier: string;
  hasApiKey: boolean;
  apiKey?: string;
  systemPrompt?: string;
  thinkingBudget?: "none" | "low" | "medium" | "high";

  // Advanced Generation Parameters (especially for Local LLMs)
  temperature?: number;
  topP?: number;
  repetitionPenalty?: number;
  maxTokens?: number;
  contextWindow?: number;
  kvCache?: string;
  chatTemplate?: string;
  customParams?: { key: string; value: string }[];
};

export type ContextStrategy = "auto" | "prefer_history" | "prefer_codebase" | "custom";

export type ContextSettings = {
  strategy: ContextStrategy;
  customSystemBudget?: number;
  customHistoryBudget?: number;
  customCodebaseBudget?: number;
};

export type ConfigureTab = "environments" | "github" | "models" | "context" | "general";

export type GitHubRepo = {
  id: string;
  name: string;
  fullName: string;
  private: boolean;
  branch: string;
  updatedAt: string;
};
