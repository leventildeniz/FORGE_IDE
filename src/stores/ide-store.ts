import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  AIModel,
  BottomTab,
  ChangeSet,
  ChatMessage,
  ConfigureTab,
  EditorTab,
  Environment,
  EnvironmentKind,
  FileNode,
  GitHubRepo,
  PreviewDevice,
  RecentProject,
  WorkspaceView,
  TerminalInstance,
  MCPTool,
  CustomProfile,
  ContextSettings,
  ContextStrategy,
} from "@/types/ide";
import {
  BackendRequest,
  BackendResponseType,
  BackendRequestType,
  BackendResponse,
} from "@/types/backend-messages";
import { getWebSocketManager } from "@/lib/backend-websocket";
import { toast } from "sonner";

const triggeredScrapes = new Set<string>();

type UISlice = {
  isAppLocked: boolean;
  appPasswordHash: string | null;
  setAppLocked: (locked: boolean) => void;
  setAppPasswordHash: (hash: string | null) => void;
  workspaceView: WorkspaceView;
  telemetry: {
    context_window: number;
    system_tokens: number;
    knowledge_tokens: number;
    history_tokens: number;
    file_tokens: number;
    free_tokens: number;
    active_model: string;
    traces: { timestamp: number; message: string }[];
  };
  addTelemetryTrace: (message: string) => void;
  explorerOpen: boolean;
  aiOpen: boolean;
  bottomOpen: boolean;
  bottomTab: BottomTab;
  minimap: boolean;
  commandOpen: boolean;
  configureTab: ConfigureTab;
  setWorkspaceView: (v: WorkspaceView) => void;
  toggleExplorer: () => void;
  toggleAi: () => void;
  toggleBottom: () => void;
  setBottomTab: (t: BottomTab) => void;
  toggleMinimap: () => void;
  setCommandOpen: (o: boolean) => void;
  setConfigureTab: (t: ConfigureTab) => void;
  isConnected: boolean;
  setIsConnected: (c: boolean) => void;
};

type ProjectSlice = {
  projectName: string;
  projectRootPath: string | null; // New: Stores the currently active project's root path
  suggestedProjectRoots: FileNode[]; // New: Stores suggested project roots from backend
  tree: FileNode[];
  // New actions for fetching file tree
  fetchFileTree: (path: string, recursive?: boolean) => void;
  setFileTree: (tree: FileNode[]) => void;
  setProjectRoot: (path: string | null) => void; // New: Action to set the project root, can be null
  createProject: (name: string, path: string) => Promise<void>; // Yeni: Yeni proje oluşturma eylemi
  // New: Promise-based directory listing
  listDirectory: (
    path: string,
    recursive?: boolean,
    envId?: string,
    envDetails?: Environment,
  ) => Promise<FileNode[]>;
  createDirectory: (
    path: string,
    recursive?: boolean,
    envId?: string,
    envDetails?: Environment,
  ) => Promise<boolean>;
  createFile: (
    path: string,
    recursive?: boolean,
    envId?: string,
    envDetails?: Environment,
  ) => Promise<boolean>;
  deletePath: (path: string, envId?: string, envDetails?: Environment) => Promise<boolean>;
  renamePath: (
    oldPath: string,
    newPath: string,
    envId?: string,
    envDetails?: Environment,
  ) => Promise<boolean>;
  duplicateFile: (path: string, envId?: string, envDetails?: Environment) => Promise<boolean>;
  sftpListDir: (path: string, envId: string, envDetails: Environment) => Promise<FileNode[]>;
  sftpCreateDir: (path: string, envId: string, envDetails: Environment) => Promise<any>;
  sftpRemoveFile: (path: string, envId: string, envDetails: Environment) => Promise<any>;
  sftpRemoveDir: (path: string, envId: string, envDetails: Environment) => Promise<any>;
  sftpRename: (
    oldPath: string,
    newPath: string,
    envId: string,
    envDetails: Environment,
  ) => Promise<any>;
};

type EditorSlice = {
  tabs: EditorTab[];
  activePath: string | null;
  openFile: (path: string) => void;
  closeTab: (path: string) => void;
  setActive: (path: string) => void;
  updateContent: (path: string, content: string) => void;
  saveFile: (path: string) => void;
  saveActive: () => void;
  // New action to update a file content from backend response
  updateFileContentFromBackend: (path: string, content: string) => void;
};

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
}

type AISlice = {
  messages: ChatMessage[];
  chatHistory: ChatSession[];
  activeChatId: string | null;
  streaming: boolean;
  isCompacting: boolean;
  changeSets: Record<string, ChangeSet>;
  chatMode: AIChatMode;

  pendingAttachments: File[];
  addPendingAttachment: (f: File) => void;
  removePendingAttachment: (index: number) => void;
  clearPendingAttachments: () => void;

  setChatMode: (mode: AIChatMode) => void;
  compactChat: () => void;
  send: (
    text: string,
    attachments?: { name: string; type: string; content: string }[],
    contextPills?: { type: string; name: string; path: string }[],
  ) => void;
  stop: () => void;
  clear: () => void;
  loadChat: (id: string) => void;
  deleteChat: (id: string) => void;
  regenerate: (id: string) => void;
  editMessage: (id: string, newText: string) => void;
  applyChangeSet: (id: string) => void;
  rejectChangeSet: (id: string) => void;
  scrapeWeb: (url: string, topic: string) => void;
  searchWeb: (query: string) => void;
};

type TerminalSlice = {
  terminals: TerminalInstance[];
  activeTerminalId: string | null;
  addTerminal: (t: TerminalInstance) => void;
  removeTerminal: (id: string) => void;
  setActiveTerminal: (id: string) => void;
};

type PreviewSlice = {
  previewUrl: string;
  previewDevice: PreviewDevice;
  previewRunning: boolean;
  previewHistory: string[];
  previewHistoryIndex: number;
  systemMessages: { id: string; level: "info" | "warn" | "error"; text: string; at: string }[];
  setPreviewUrl: (url: string) => void;
  setPreviewDevice: (d: PreviewDevice) => void;
  togglePreviewRunning: () => void;
  previewBack: () => void;
  previewForward: () => void;
  previewRefresh: () => void;
  pushSystemMessage: (level: "info" | "warn" | "error", text: string) => void;
};

type EnvSlice = {
  environments: Environment[];
  activeEnvId: string;
  setActiveEnv: (id: string) => void;
  addEnvironment: (env: Omit<Environment, "id" | "status">) => void;
  removeEnvironment: (id: string) => void;
  getEnvironments: () => Promise<Environment[]>;
  saveEnvironment: (env: Environment) => Promise<void>;
  deleteEnvironment: (id: string) => Promise<void>;
  getRecentProjects: () => Promise<RecentProject[]>;
  saveRecentProject: (proj: Omit<RecentProject, "opened_at">) => Promise<void>;
  deleteRecentProject: (id: string) => Promise<void>;
  updateSshEnvironmentDetails: (id: string, updatedEnv: Environment) => void;
  connectSsh: (environmentId: string, environmentDetails: Environment) => Promise<any>;
  generateSshKey: () => Promise<{ privateKeyPem: string; publicKeyOpenssh: string }>;
};

type ModelSlice = {
  models: AIModel[];
  activeModelId: string;
  setActiveModel: (id: string) => void;
  addModel: (m: Omit<AIModel, "id">) => void;
  updateModel: (id: string, m: Partial<AIModel>) => void;
  removeModel: (id: string) => void;
};

type MCPSlice = {
  mcpTools: MCPTool[];
  addMCPTool: (tool: Omit<MCPTool, "id">) => void;
  removeMCPTool: (id: string) => void;
  toggleMCPTool: (id: string) => void;
};

type ProfileSlice = {
  profiles: CustomProfile[];
  addProfile: (profile: Omit<CustomProfile, "id">) => void;
  removeProfile: (id: string) => void;
};

type PublishSlice = {
  githubConnected: boolean;
  githubUser: string | null;
  githubRepos: GitHubRepo[];
  activeRepoId: string | null;
  branches: string[];
  activeBranch: string;
  isGitRepo: boolean;
  remoteUrl: string;
  gitStatus: { file: string; status: string }[];
  generatedCommitMessage: string;
  isGeneratingCommit: boolean;
  isPushing: boolean;
  connectGitHub: (user: string) => void;
  disconnectGitHub: () => void;
  setActiveRepo: (id: string) => void;
  setActiveBranch: (b: string) => void;
  setGeneratedCommitMessage: (msg: string) => void;
  getGitStatus: () => void;
  generateCommitMessage: () => void;
  commitAndPush: (message: string) => void;
  pullFromRemote: () => void;
  initGitRepo: () => void;
  addGitRemote: (url: string) => void;
  removeGitRemote: () => void;
};

type ContextSlice = {
  contextSettings: ContextSettings;
  updateContextSettings: (settings: Partial<ContextSettings>) => void;
};

export type IDEStore = UISlice &
  ProjectSlice &
  EditorSlice &
  AISlice &
  TerminalSlice &
  PreviewSlice &
  EnvSlice &
  ModelSlice &
  MCPSlice &
  ProfileSlice &
  GitHubSlice &
  ContextSlice & {
    initializeBackendConnection: () => void; // New action
  };

// Helper to get language from file extension (temporary, should be from backend or more robust)
function getLanguageFromPath(path: string): string {
  const extension = path.split(".").pop();
  switch (extension) {
    case "ts":
    case "tsx":
      return "typescript";
    case "js":
    case "jsx":
      return "javascript";
    case "json":
      return "json";
    case "md":
    case "txt": // Added .txt for basic text files
      return "markdown"; // or 'plaintext' for generic text
    case "rs":
      return "rust";
    case "py":
      return "python";
    case "html":
      return "html";
    case "css":
      return "css";
    default:
      return "plaintext";
  }
}

// Map to hold pending promises for backend responses, keyed by request_id
const pendingPromises = new Map<
  string,
  { resolve: (value: any) => void; reject: (reason?: any) => void }
>();

// Buffer for throttling AI Stream updates to React UI
let streamBuffer: Record<string, string> = {};
let lastStreamUpdate = 0;

export const useIDEStore = create<IDEState>()(
  persist(
    (set, get) => {
      // Initialize WebSocketManager
      const wsManager = getWebSocketManager({
        onOpen: () => {
          console.log("Frontend: WebSocket to Backend opened.");
          get().addTelemetryTrace("WebSocket connected to Rust Backend.");

          // Always ensure we fetch environments on connect so they are available
          wsManager.sendRequest({
            type: BackendRequestType.GetEnvironments,
            payload: {},
          });

          // Get suggested project roots on connection open
          const activeEnv = get().environments.find((env) => env.id === get().activeEnvId);
          wsManager.sendRequest({
            type: BackendRequestType.GetSuggestedProjectRoots,
            payload: {
              environmentId: get().activeEnvId,
              active_environment_details: activeEnv || undefined,
            },
          });

          // Fetch chat sessions
          wsManager.sendRequest({
            type: BackendRequestType.GetChatSessions,
            payload: {},
          });

          // If a project is already open, refresh its tree
          if (get().projectRootPath) {
            get().fetchFileTree(get().projectRootPath as string);
          }
        },
        onClose: () => {
          console.log("Frontend: WebSocket to Backend closed.");
        },
        onError: (event) => {
          console.error("Frontend: WebSocket to Backend error:", event);
        },
        onMessage: (response) => {
          // console.log("Frontend: Received message from backend:", response);

          // Geri kalan switch case bloğu, doğrudan global state güncellemeleri için kalır.
          // Backend-websocket.ts kendi promise yönetimini yaptığı için burada sadece global state güncellemeleri yapılmalıdır.
          switch (response.type) {
            case BackendResponseType.ListDirResponse:
            case BackendResponseType.SftpListDirResponse:
              // console.log("ListDirResponse payload nodes:", response.payload.nodes);
              set((state) => {
                const newTree = response.payload.nodes;
                // console.log("Frontend: Updating tree state with:", newTree);
                return {
                  tree: newTree,
                };
              });
              break;
            case BackendResponseType.SuggestedProjectRootsResponse:
              set((state) => {
                const roots = response.payload.roots;
                // console.log("Frontend: Suggested Project Roots received:", roots);
                // console.log("Frontend: SuggestedProjectRootsResponse handled. projectRootPath remains:", state.projectRootPath);
                return { suggestedProjectRoots: roots };
              });
              break;
            case BackendResponseType.ReadFileResponse:
            case BackendResponseType.SftpReadFileResponse:
              set((state) => {
                const existingTab = state.tabs.find((t) => t.path === response.payload.path);
                if (!existingTab) {
                  const newTab: EditorTab = {
                    path: response.payload.path,
                    name: response.payload.path.split("/").pop() || response.payload.path,
                    language: getLanguageFromPath(response.payload.path),
                    content: response.payload.content,
                    dirty: false,
                  };
                  return { tabs: [...state.tabs, newTab], activePath: response.payload.path };
                } else if (state.activePath !== response.payload.path) {
                  return { activePath: response.payload.path };
                } else if (existingTab.content !== response.payload.content) {
                  return {
                    tabs: state.tabs.map((t) =>
                      t.path === response.payload.path
                        ? { ...t, content: response.payload.content, dirty: false }
                        : t,
                    ),
                  };
                }
                return {};
              });
              break;
            case BackendResponseType.WriteFileResponse:
            case BackendResponseType.SftpWriteFileResponse:
              toast.success(`File saved: ${response.payload.path}`);
              set((state) => ({
                tabs: state.tabs.map((t) =>
                  t.path === response.payload.path ? { ...t, dirty: false } : t,
                ),
              }));
              if (get().projectRootPath) {
                if (get().projectRootPath) {
                  get().fetchFileTree(get().projectRootPath as string);
                }
              }
              break;
            case BackendResponseType.CreateDirResponse:
            case BackendResponseType.SftpCreateDirResponse:
              // Just let the Promise resolve, do not auto-set project root here!
              // toast.success(`Folder created: ${response.payload.path}`);
              break;
            case BackendResponseType.ConnectSshResponse:
              if (response.payload.status === "connected") {
                // Because Rust serializes it as environmentId via serde rename
                const envId =
                  (response.payload as any).environmentId ||
                  (response.payload as any).environment_id;
                toast.success(`SSH Connected to ${envId}`);
                set((state) => ({
                  environments: state.environments.map((env) =>
                    env.id === envId ? { ...env, status: "connected" } : env,
                  ),
                }));
              } else {
                toast.error(`SSH Connection Failed: ${response.payload.message}`);
                set((state) => ({
                  environments: state.environments.map((env) =>
                    env.id === response.payload.environmentId
                      ? { ...env, status: "disconnected" }
                      : env,
                  ),
                }));
              }
              break;
            case BackendResponseType.GenerateSshKeyResponse:
              toast.success("SSH Key Generated Successfully!");
              // You might want to store these keys in a more secure way or display them to the user
              console.log("Private Key PEM:", response.payload.private_key_pem);
              console.log("Public Key OpenSSH:", response.payload.public_key_openssh);
              set({
                // Optionally store keys in a temporary state or trigger a download/save action
              });
              break;
            case BackendResponseType.SftpListDirResponse:
              set((state) => {
                const nodes: FileNode[] = response.payload.nodes;
                // Assuming the SFTP list dir should update the main file tree for the active environment
                // This might need refinement based on how you want to display remote directories
                return { tree: nodes };
              });
              break;
            case BackendResponseType.SftpReadFileResponse:
              set((state) => {
                const existingTab = state.tabs.find((t) => t.path === response.payload.path);
                if (!existingTab) {
                  const newTab: EditorTab = {
                    path: response.payload.path,
                    name: response.payload.path.split("/").pop() || response.payload.path,
                    language: getLanguageFromPath(response.payload.path),
                    content: response.payload.content,
                    dirty: false,
                  };
                  return { tabs: [...state.tabs, newTab], activePath: response.payload.path };
                } else if (state.activePath !== response.payload.path) {
                  return { activePath: response.payload.path };
                } else if (existingTab.content !== response.payload.content) {
                  return {
                    tabs: state.tabs.map((t) =>
                      t.path === response.payload.path
                        ? { ...t, content: response.payload.content, dirty: false }
                        : t,
                    ),
                  };
                }
                return {};
              });
              break;

            case BackendResponseType.SftpCreateDirResponse:
              toast.success(`SFTP Directory created: ${response.payload.path}`);
              // Refresh file tree if necessary
              // if (get().projectRootPath) { get().projectRootPath; }
              break;
            case BackendResponseType.SftpRemoveFileResponse:
              toast.success(`SFTP File removed: ${response.payload.path}`);
              // Refresh file tree if necessary
              // if (get().projectRootPath) { get().projectRootPath; }
              break;
            case BackendResponseType.SftpRemoveDirResponse:
              toast.success(`SFTP Directory removed: ${response.payload.path}`);
              // Refresh file tree if necessary
              // if (get().projectRootPath) { get().projectRootPath; }
              break;
            case BackendResponseType.SftpRenameResponse:
              toast.success(
                `SFTP Renamed ${response.payload.old_path} to ${response.payload.new_path}`,
              );
              // Refresh file tree if necessary
              // if (get().projectRootPath) { get().projectRootPath; }
              break;
            case BackendResponseType.SpawnTerminalResponse: {
              break;
            }
            case BackendResponseType.TerminalOutput: {
              const event = new CustomEvent("forge-terminal-output", {
                detail: {
                  terminalId: response.payload.terminal_id,
                  data: response.payload.data,
                },
              });
              window.dispatchEvent(event);
              break;
            }
            case BackendResponseType.TerminalClosed: {
              get().removeTerminal(response.payload.terminal_id);
              break;
            }
            case BackendResponseType.GetChatSessionsResponse: {
              set({ chatHistory: response.payload.sessions || [] });
              break;
            }
            case BackendResponseType.GetChatMessagesResponse: {
              if (response.payload.request_id === get().activeChatId) {
                set({
                  messages: response.payload.messages.map((m: any) => {
                    let parsedParts = [{ type: "text", text: m.content }];
                    try {
                      if (m.content.trim().startsWith("[")) {
                        parsedParts = JSON.parse(m.content);
                      }
                    } catch (e) {
                      // Ignore parsing error, fallback to raw text
                    }
                    return {
                      id: m.id,
                      role: m.role,
                      parts: parsedParts,
                    };
                  }),
                });
              }
              break;
            }
            case BackendResponseType.AiChatStreamResponse: {
              // Accumulate chunks and throttle Zustand set() calls
              const msgId = response.payload.request_id || response.payload.message_id;
              const chunk = response.payload.chunk || "";
              const isDone = response.payload.done;

              if (!streamBuffer[msgId]) {
                streamBuffer[msgId] = "";
              }
              streamBuffer[msgId] += chunk;

              const now = Date.now();
              if (now - lastStreamUpdate > 100 || isDone) {
                lastStreamUpdate = now;
                if (isDone) set({ activeAiRequestId: null });

                set((state) => {
                  if (!state.streaming) return state; // If stopped manually, ignore chunks

                  const newMessages = state.messages.map((m) => {
                    const bufferChunk = streamBuffer[msgId];
                    if (m.id === msgId && bufferChunk) {
                      // Determine current raw text
                      const textPart = m.parts.find((p) => p.type === "text") as any;
                      let currentText =
                        m.rawContent !== undefined ? m.rawContent : textPart ? textPart.text : "";
                      const newText = currentText + bufferChunk;

                      // Parse newText for <think>, <thought>, <reasoning>, or <|think|> blocks so they stream live
                      // Only match if the tag appears at the start of a line (to prevent matching <think> inside inline code)
                      const thinkRegex =
                        /(?:^|\n)\s*<\|?(?:think|thought|reasoning)\|?>([\s\S]*?)(?:<\|?\/(?:think|thought|reasoning)\|?>|$)/gi;
                      let thinkMatch;
                      let thinkLastIndex = 0;
                      const newParts: any[] = [];

                      // Sub-Agent detection via Frontend is removed.
                      // All sub-agent interception (@@CODE, @@RUN, @@WEB, @@MEMORY, @@MCP)
                      // is now natively handled by the Rust Backend Interceptor loop.

                      while ((thinkMatch = thinkRegex.exec(newText)) !== null) {
                        // The regex includes the preceding newline/spaces in the match.
                        // We need to carefully preserve whatever came before the <think> tag.
                        const matchStart = thinkMatch.index;
                        const matchText = thinkMatch[0];
                        const innerText = thinkMatch[1];

                        // Find where the actual <think> tag starts within the match (to keep the \n\s* in the text part)
                        const tagStartOffset = matchText.search(
                          /<\|?(?:think|thought|reasoning)\|?>/i,
                        );
                        const actualTagIndex = matchStart + tagStartOffset;

                        if (actualTagIndex > thinkLastIndex) {
                          newParts.push({
                            type: "text",
                            text: newText.slice(thinkLastIndex, actualTagIndex),
                          });
                        }
                        newParts.push({ type: "thinking", text: innerText });
                        thinkLastIndex = matchStart + matchText.length;
                      }
                      if (thinkLastIndex < newText.length) {
                        newParts.push({ type: "text", text: newText.slice(thinkLastIndex) });
                      }
                      if (newParts.length === 0 && newText.length > 0) {
                        newParts.push({ type: "text", text: newText });
                      }

                      return {
                        ...m,
                        rawContent: newText,
                        parts: [
                          ...newParts,
                          ...m.parts.filter((p) => p.type !== "text" && p.type !== "thinking"),
                        ],
                      };
                    }
                    return m;
                  });

                  // Clear the buffer since we applied it
                  streamBuffer[msgId] = "";

                  // Save user message to backend occasionally if streaming is done
                  if (isDone) {
                    const finalMsg = newMessages.find((m) => m.id === msgId);
                    if (finalMsg && state.activeChatId) {
                      wsManager.sendRequest({
                        type: BackendRequestType.SaveChatMessage,
                        payload: {
                          message: {
                            id: finalMsg.id,
                            session_id: state.activeChatId,
                            role: finalMsg.role,
                            content: JSON.stringify(finalMsg.parts),
                            created_at: Date.now(),
                          },
                        },
                      });
                    }
                  }

                  // Basic Markdown Code Block parsing into ChangeSets
                  let parsedMessages = newMessages;
                  if (isDone) {
                    parsedMessages = newMessages.map((m) => {
                      if (m.id === msgId) {
                        let hasChanges = false;
                        const newParts: any[] = [];
                        let csCount = 0;

                        // We need to parse from m.rawContent now
                        const rawContentToParse = m.rawContent || "";

                        // Let's just create a single text part for the raw content to simplify
                        // Normally we map over parts, but we can do it against a fake single part
                        // or just the newly updated `m.parts` as before
                        for (const part of m.parts) {
                          if (part.type !== "text") {
                            newParts.push(part);
                            continue;
                          }

                          const chunkText = part.text;
                          const codeBlockRegex = /```([a-zA-Z0-9_-]*)[ \t]*\r?\n([\s\S]*?)```/g;
                          let match;
                          let lastIndex = 0;

                          while ((match = codeBlockRegex.exec(chunkText)) !== null) {
                            const [fullMatch, lang, code] = match;

                            // Push text before code block
                            if (match.index > lastIndex) {
                              newParts.push({
                                type: "text",
                                text: chunkText.slice(lastIndex, match.index),
                              });
                            }

                            const beforeText = chunkText.slice(lastIndex, match.index);
                            lastIndex = match.index + fullMatch.length;

                            // Check first line of code for a path comment
                            const firstLine = code.split("\n")[0].trim();
                            const pathCommentMatch = firstLine.match(
                              /^(?:\/\/|#|\/\*|<!--)\s*(?:File:\s*)?([\w\-./\\]+\.\w+)\s*(?:\*\/|-->)?$/i,
                            );

                            // If it is a terminal log or plain text AND it doesn't have a file path comment, do NOT make it a changeset.
                            const ignoreLangs = ["bash", "sh", "plaintext", "text", "log", "terminal", "powershell", "cmd"];
                            const isIgnoredLang = ignoreLangs.includes(lang.toLowerCase().trim());
                            
                            if ((isIgnoredLang || !lang.trim()) && !pathCommentMatch) {
                              newParts.push({ type: "code", code, language: lang || "text" }); // Push as a simple view-only code block instead of text
                              continue;
                            }

                            // If it looks like code, let's make it a changeset
                            csCount++;
                            const changeSetId = `cs_${msgId}_${csCount}`;
                            hasChanges = true;

                            // Register changeset in the store
                            set((state) => {
                              let guessedPath = "";

                              if (pathCommentMatch) {
                                guessedPath = pathCommentMatch[1];
                              }

                              // Check text before code block
                              if (!guessedPath) {
                                const pathMatch = beforeText.match(/`([\w\-./]+\.\w+)`[^`]*$/);
                                if (pathMatch) {
                                  guessedPath = pathMatch[1];
                                }
                              }

                              let targetPath = "";
                              let targetName = "";
                              let oldContent = "";

                              if (guessedPath) {
                                targetName = guessedPath.split("/").pop() || guessedPath;
                                if (state.projectRootPath) {
                                  if (
                                    guessedPath.startsWith("/") ||
                                    /^[a-zA-Z]:\\/.test(guessedPath)
                                  ) {
                                    targetPath = guessedPath;
                                  } else {
                                    targetPath =
                                      state.projectRootPath +
                                      (state.projectRootPath.endsWith("/") ? "" : "/") +
                                      guessedPath;
                                  }
                                } else {
                                  targetPath = guessedPath;
                                }
                                const existingTab = state.tabs.find((t) => t.path === targetPath);
                                if (existingTab) {
                                  oldContent = existingTab.content;
                                }
                              } else {
                                const activeTab = state.tabs.find(
                                  (t) => t.path === state.activePath,
                                );
                                // Default to a snippet path to ensure it passes 'untitled' checks and can be saved safely.
                                const ext = lang || "txt";
                                targetPath =
                                  activeTab?.path ||
                                  `snippet_${Math.random().toString(36).slice(2, 8)}.${ext}`;
                                targetName = activeTab?.name || `snippet.${ext}`;
                                oldContent = activeTab?.content || "";
                              }

                              const newFiles = [
                                {
                                  path: targetPath,
                                  name: targetName,
                                  added: code.split("\n").length,
                                  removed: oldContent.split("\n").length,
                                  before: oldContent,
                                  after: code,
                                },
                              ];

                              return {
                                changeSets: {
                                  ...state.changeSets,
                                  [changeSetId]: {
                                    id: changeSetId,
                                    title: `Update ${targetName}`,
                                    files: newFiles,
                                    status: "pending",
                                  },
                                },
                              };
                            });

                            newParts.push({ type: "change", changeSetId });
                          }

                          // Push remaining text
                          if (lastIndex < chunkText.length) {
                            newParts.push({ type: "text", text: chunkText.slice(lastIndex) });
                          }
                        }

                        if (hasChanges) {
                          return { ...m, parts: newParts };
                        }
                      }
                      return m;
                    });
                  }

                  if (isDone && state.activeChatId) {
                    const aiMsg = parsedMessages.find((m) => m.id === msgId);
                    if (aiMsg) {
                      // If we are compacting, change all 'text' parts of the AI's response to 'compact'
                      let partsToSave = aiMsg.parts.filter((p: any) => p.type !== "thinking");
                      
                      if (state.isCompacting) {
                        partsToSave = partsToSave.map(p => 
                          p.type === "text" ? { type: "compact", text: p.text } : p
                        );
                        // Also update the local state to match
                        parsedMessages = parsedMessages.map(m => 
                          m.id === msgId ? { ...m, parts: partsToSave } : m
                        );
                      }

                      wsManager.sendRequest({
                        type: BackendRequestType.SaveChatMessage,
                        payload: {
                          message: {
                            id: aiMsg.id,
                            session_id: state.activeChatId,
                            role: aiMsg.role,
                            content: JSON.stringify(partsToSave),
                            created_at: Date.now(),
                          },
                        },
                      });
                    }
                  }

                  return {
                    messages: parsedMessages,
                    streaming: !isDone,
                    isCompacting: isDone ? false : state.isCompacting,
                  };
                });
              }
              break;
            }
            case "ScrapeWebResponse": {
              if (response.payload.success) {
                toast.success("Scrape completed successfully!");
                // Append a system message to chat to let user/model know it succeeded
                set((state) => {
                  if (!state.activeChatId) return state;
                  const sysMsg: ChatMessage = {
                    id: crypto.randomUUID(),
                    role: "system",
                    parts: [{ type: "text", text: `Sub-Agent: ${response.payload.message}` }],
                  };

                  // Also save this system message to backend
                  wsManager.sendRequest({
                    type: BackendRequestType.SaveChatMessage,
                    payload: {
                      message: {
                        id: sysMsg.id,
                        session_id: state.activeChatId,
                        role: sysMsg.role,
                        content: JSON.stringify(sysMsg.parts),
                        created_at: Date.now(),
                      },
                    },
                  });

                  // Auto-continue the main agent
                  setTimeout(() => {
                    const store = get();
                    if (store.activeChatId) {
                      store.send(
                        `The sub-agent successfully fetched the requested URL. Please continue your task using the new information from the knowledge base.`,
                        [],
                        [{ type: "knowledge", name: `${response.payload.topic}.md`, path: "" }],
                      );
                    }
                  }, 500);

                  return {
                    messages: [...state.messages, sysMsg],
                  };
                });
              } else {
                toast.error(`Sub-Agent Failed: ${response.payload.message}`);

                // If it fails, also let the model know so it doesn't wait forever!
                set((state) => {
                  if (!state.activeChatId) return state;
                  const sysMsg: ChatMessage = {
                    id: crypto.randomUUID(),
                    role: "system",
                    parts: [{ type: "text", text: `Sub-Agent Error: ${response.payload.message}` }],
                  };
                  setTimeout(() => {
                    get().send(
                      `The sub-agent failed to fetch the URL: ${response.payload.message}. Please adjust your plan or continue without it.`,
                      [],
                      [],
                    );
                  }, 500);
                  return {
                    messages: [...state.messages, sysMsg],
                  };
                });
              }
              break;
            }
            case "SearchWebResponse": {
              if (response.payload.success) {
                toast.success("Web search completed successfully!");
                set((state) => {
                  if (!state.activeChatId) return state;
                  const sysMsg: ChatMessage = {
                    id: crypto.randomUUID(),
                    role: "system",
                    parts: [{ type: "text", text: `Sub-Agent: ${response.payload.message}` }],
                  };

                  wsManager.sendRequest({
                    type: BackendRequestType.SaveChatMessage,
                    payload: {
                      message: {
                        id: sysMsg.id,
                        session_id: state.activeChatId,
                        role: sysMsg.role,
                        content: JSON.stringify(sysMsg.parts),
                        created_at: Date.now(),
                      },
                    },
                  });

                  setTimeout(() => {
                    const store = get();
                    if (store.activeChatId) {
                      store.send(
                        `The sub-agent successfully searched the web. Please continue your task using the new information from the knowledge base.`,
                        [],
                        [{ type: "knowledge", name: `${response.payload.topic}.md`, path: "" }],
                      );
                    }
                  }, 500);

                  return {
                    messages: [...state.messages, sysMsg],
                  };
                });
              } else {
                toast.error(`Search Failed: ${response.payload.message}`);
                set((state) => {
                  if (!state.activeChatId) return state;
                  const sysMsg: ChatMessage = {
                    id: crypto.randomUUID(),
                    role: "system",
                    parts: [{ type: "text", text: `Sub-Agent Error: ${response.payload.message}` }],
                  };
                  setTimeout(() => {
                    get().send(
                      `The sub-agent failed to search the web: ${response.payload.message}. Please adjust your plan or continue without it.`,
                      [],
                      [],
                    );
                  }, 500);
                  return {
                    messages: [...state.messages, sysMsg],
                  };
                });
              }
              break;
            }
            case BackendResponseType.ExportProjectResponse: {
              if (response.payload.success && response.payload.zip_path) {
                // zip_path is now returning format "filename.zip|base64string"
                const parts = response.payload.zip_path.split("|");
                const filename = parts[0] || "export.zip";
                const b64 = parts[1] || "";
                
                toast.success(`Project bundled successfully. Downloading...`);
                
                const link = document.createElement("a");
                link.href = `data:application/zip;base64,${b64}`;
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              } else {
                toast.error(`Export failed: ${response.payload.error}`);
              }
              break;
            }
            case BackendResponseType.GetGitStatusResponse: {
              set({
                isGitRepo: response.payload.is_repo,
                gitStatus: response.payload.files,
                activeBranch: response.payload.branch,
                remoteUrl: response.payload.remote_url || "",
              });
              break;
            }
            case BackendResponseType.GitInitResponse: {
              if (response.payload.success) {
                toast.success("Git repository initialized successfully!");
                get().getGitStatus();
              } else {
                toast.error(`Failed to init Git: ${response.payload.error}`);
              }
              break;
            }
            case BackendResponseType.GitAddRemoteResponse: {
              if (response.payload.success) {
                toast.success("Remote URL added successfully!");
                get().getGitStatus();
              } else {
                toast.error(`Failed to add remote: ${response.payload.error}`);
              }
              break;
            }
            case BackendResponseType.GitRemoveRemoteResponse: {
              if (response.payload.success) {
                toast.success("Remote URL removed.");
                get().getGitStatus();
              } else {
                toast.error(`Failed to remove remote: ${response.payload.error}`);
              }
              break;
            }
            case BackendResponseType.GenerateCommitMessageResponse: {
              set({
                generatedCommitMessage: response.payload.message,
                isGeneratingCommit: false,
              });
              break;
            }
            case BackendResponseType.GitCommitAndPushResponse: {
              set({ isPushing: false });
              if (response.payload.success) {
                toast.success("Code committed and pushed successfully!");
                // Refresh status
                const projectRoot = get().projectRootPath;
                if (projectRoot) {
                  getWebSocketManager().sendRequest({
                    type: BackendRequestType.GetGitStatus as any,
                    payload: { project_root: projectRoot },
                  });
                }
              } else {
                toast.error(`Git Push Failed:\n${response.payload.output}`);
              }
              break;
            }
            case BackendResponseType.GitPullResponse: {
              if (response.payload.success) {
                toast.success("Pulled from remote successfully!");
                const projectRoot = get().projectRootPath;
                if (projectRoot) {
                  getWebSocketManager().sendRequest({
                    type: BackendRequestType.GetGitStatus as any,
                    payload: { project_root: projectRoot },
                  });
                }
              } else {
                toast.error(`Git Pull Failed:\n${response.payload.output}`);
              }
              break;
            }
            case BackendResponseType.TelemetryUpdate: {
              if (response.payload) {
                set((state) => ({
                  telemetry: {
                    ...state.telemetry,
                    ...response.payload,
                  }
                }));
              }
              break;
            }
            case BackendResponseType.Error:
              if (
                typeof response.payload.message === "string" && (
                  response.payload.message === "Generation stopped" ||
                  response.payload.message.includes("AI generation stopped for task") ||
                  response.payload.message.includes("cancelled")
                )
              ) {
                console.log("Frontend: Generation stopped by user, ignoring error toast.");
                break;
              }
              toast.error(`Backend Error: ${response.payload?.message || "Unknown error"}`);
              console.error(
                "Frontend: Received Backend Error:",
                JSON.stringify(response.payload, null, 2),
              );
              break;
          }
        },
      });

      return {
        // UI
        isAppLocked: false,
        appPasswordHash: null,
        setAppLocked: (locked: boolean) => set({ isAppLocked: locked }),
        setAppPasswordHash: (hash: string | null) => set({ appPasswordHash: hash }),
        workspaceView: "code",
        isConnected: false,
        telemetry: {
          context_window: 32000,
          system_tokens: 0,
          knowledge_tokens: 0,
          history_tokens: 0,
          file_tokens: 0,
          free_tokens: 32000,
          active_model: "Waiting for inference...",
          traces: [],
        },
        addTelemetryTrace: (message: string) => {
          set((state) => {
            const newTraces = [
              { timestamp: Date.now(), message },
              ...(state.telemetry.traces || []),
            ].slice(0, 50); // Keep last 50
            return {
              telemetry: {
                ...state.telemetry,
                traces: newTraces,
              },
            };
          });
        },
        bottomOpen: true,
        bottomTab: "terminal",
        minimap: false,
        commandOpen: false,
        configureTab: "environments",
        setWorkspaceView: (v) => set({ workspaceView: v }),
        toggleExplorer: () => set((s) => ({ explorerOpen: !s.explorerOpen })),
        toggleAi: () => set((s) => ({ aiOpen: !s.aiOpen })),
        toggleBottom: () => set((s) => ({ bottomOpen: !s.bottomOpen })),
        setBottomTab: (t) => set({ bottomTab: t, bottomOpen: true }),
        toggleMinimap: () => set((s) => ({ minimap: !s.minimap })),
        setCommandOpen: (o) => set({ commandOpen: o }),
        setConfigureTab: (t) => set({ configureTab: t }),
        setIsConnected: (c) => set({ isConnected: c }),

        // Project - Updated to use backend for file tree
        projectName: "forge-ide-project", // A default name, could be loaded from backend later
        projectRootPath: null, // Initial project root is null - BU KESİNLİKLE NULL OLMALI
        suggestedProjectRoots: [], // Initially empty
        tree: [], // Initially empty, will be populated by backend
        fetchFileTree: (path: string, recursive: boolean = true) => {
          // console.log("Frontend: fetchFileTree called with path:", path, "recursive:", recursive);
          const activeEnv = get().environments.find((env) => env.id === get().activeEnvId);
          if (activeEnv?.kind === "ssh") {
            wsManager.sendRequest({
              type: BackendRequestType.SftpListDir,
              payload: {
                path,
                environmentId: get().activeEnvId,
                active_environment_details: activeEnv,
              },
            });
          } else {
            wsManager.sendRequest({
              type: BackendRequestType.ListDir,
              payload: {
                path,
                recursive,
                environmentId: get().activeEnvId,
                active_environment_details: activeEnv || undefined,
              },
            });
          }
        },
        setFileTree: (newTree) => set({ tree: newTree }),
        // KRİTİK DEĞİŞİKLİK: setProjectRoot artık fetchFileTree'yi otomatik olarak çağırmaz.
        // Sadece state'i günceller. fetchFileTree'nin çağrılması, bu fonksiyonu çağıranın sorumluluğundadır.
        setProjectRoot: (path) =>
          set((state) => {
            // Eğer path null ise tree ve activePath'i de temizle.

            // Initialize Knowledge Base silently
            if (path) {
              const activeEnvId = state.activeEnvId;
              const activeEnv = state.environments.find((env) => env.id === activeEnvId);
              getWebSocketManager()
                .sendRequest({
                  type: BackendRequestType.InitKnowledgeBase,
                  payload: {
                    project_root: path,
                    environmentId: activeEnvId,
                    active_environment_details: activeEnv || undefined,
                  },
                })
                .catch(console.error);
            }

            return {
              projectRootPath: path,
              tree: path === null ? [] : state.tree,
              activePath: path === null ? null : state.activePath,
            };
          }),
        createProject: async (name, path) => {
          const activeEnv = get().environments.find((env) => env.id === get().activeEnvId);
          // More robust path cleaning to fix double slashes anywhere, particularly at the start
          let cleanPath = path;
          while (cleanPath.startsWith("//")) {
            cleanPath = cleanPath.substring(1);
          }
          if (cleanPath.endsWith("/")) {
            cleanPath = cleanPath.slice(0, -1);
          }
          const fullPath = cleanPath === "" ? `/${name}` : `${cleanPath}/${name}`;

          let promise;
          if (activeEnv?.kind === "ssh") {
            promise = wsManager.sendRequest({
              type: BackendRequestType.SftpCreateDir,
              payload: {
                path: fullPath,
                environmentId: get().activeEnvId,
                active_environment_details: activeEnv,
              },
            });
          } else {
            promise = wsManager.sendRequest({
              type: BackendRequestType.CreateDir,
              payload: {
                path: fullPath,
                environmentId: get().activeEnvId,
                active_environment_details: activeEnv || undefined,
                is_project_root: true,
              },
            });
          }

          return promise.then(() => {
            get().setProjectRoot(fullPath);
            get().fetchFileTree(fullPath);

            // Save to recent projects automatically when created
            get()
              .saveRecentProject({
                id: `${get().activeEnvId}_${fullPath}`,
                name: name,
                path: fullPath,
                environment_id: get().activeEnvId,
              })
              .catch(console.error);
          });
        },
        listDirectory: (path, recursive = false, envId, envDetails) => {
          const activeEnvId = envId || get().activeEnvId;
          const activeEnv = envDetails || get().environments.find((env) => env.id === activeEnvId);
          return wsManager
            .sendRequest({
              type: BackendRequestType.ListDir,
              payload: {
                path,
                recursive,
                environmentId: activeEnvId,
                active_environment_details: activeEnv || undefined,
              },
            })
            .then((response) => {
              if (response.type === BackendResponseType.ListDirResponse) {
                return response.payload.nodes;
              } else {
                throw new Error(`Unexpected response type for listDirectory: ${response.type}`);
              }
            });
        },
        createDirectory: (path, recursive, envId, envDetails) => {
          console.log("createDirectory called", { path, recursive, envId, envDetails });
          const activeEnvId = envId || get().activeEnvId;
          const activeEnv = envDetails || get().environments.find((env) => env.id === activeEnvId);
          console.log("createDirectory activeEnv", activeEnv);
          return wsManager
            .sendRequest({
              type: BackendRequestType.CreateDir,
              payload: {
                path: path,
                environmentId: activeEnvId,
                active_environment_details: activeEnv || undefined,
                is_project_root: false,
              },
            })
            .then((response) => {
              if (response.type === BackendResponseType.CreateDirResponse) {
                get().fetchFileTree(get().projectRootPath as string); // Refresh tree
                return true;
              } else if (response.type === BackendResponseType.Error) {
                throw new Error(response.payload.message);
              } else {
                throw new Error(`Unexpected response type for createDirectory: ${response.type}`);
              }
            });
        },
        createFile: (path, recursive, envId, envDetails) => {
          console.log("createFile called", { path, recursive, envId, envDetails });
          const activeEnvId = envId || get().activeEnvId;
          const activeEnv = envDetails || get().environments.find((env) => env.id === activeEnvId);
          console.log("createFile activeEnv", activeEnv);
          if (activeEnv?.kind === "ssh") {
            // Since there is no SftpCreateFile, we can create an empty file by writing empty string
            return wsManager
              .sendRequest({
                type: BackendRequestType.SftpWriteFile,
                payload: {
                  path: path,
                  content: "",
                  environmentId: activeEnvId,
                  active_environment_details: activeEnv || undefined,
                },
              })
              .then((response) => {
                if (response.type === BackendResponseType.SftpWriteFileResponse) {
                  get().fetchFileTree(get().projectRootPath as string); // Refresh tree
                  return true;
                } else if (response.type === BackendResponseType.Error) {
                  throw new Error(response.payload.message);
                } else {
                  throw new Error(`Unexpected response type for createFile: ${response.type}`);
                }
              });
          } else {
            return wsManager
              .sendRequest({
                type: BackendRequestType.CreateFile,
                payload: {
                  path: path,
                  environmentId: activeEnvId,
                  active_environment_details: activeEnv || undefined,
                },
              })
              .then((response) => {
                if (response.type === BackendResponseType.CreateFileResponse) {
                  get().fetchFileTree(get().projectRootPath as string); // Refresh tree
                  return true;
                } else if (response.type === BackendResponseType.Error) {
                  throw new Error(response.payload.message);
                } else {
                  throw new Error(`Unexpected response type for createFile: ${response.type}`);
                }
              });
          }
        },
        renamePath: (oldPath, newPath, envId, envDetails) => {
          const activeEnvId = envId || get().activeEnvId;
          const activeEnv = envDetails || get().environments.find((env) => env.id === activeEnvId);

          return wsManager
            .sendRequest({
              type: BackendRequestType.RenamePath,
              payload: {
                old_path: oldPath,
                new_path: newPath,
                environmentId: activeEnvId,
                active_environment_details: activeEnv || undefined,
              },
            })
            .then((response) => {
              if (response.type === BackendResponseType.RenamePathResponse) {
                if (get().projectRootPath) {
                  get().fetchFileTree(get().projectRootPath as string); // Refresh tree
                }
                return true;
              } else if (response.type === BackendResponseType.Error) {
                throw new Error(response.payload.message);
              } else {
                throw new Error(`Unexpected response type for renamePath: ${response.type}`);
              }
            });
        },
        duplicateFile: async (path, envId, envDetails) => {
          const activeEnvId = envId || get().activeEnvId;
          const activeEnv = envDetails || get().environments.find((env) => env.id === activeEnvId);

          const newPath = path.includes(".")
            ? path.replace(/(\.[^.]+)$/, " Copy$1")
            : path + " Copy";

          if (activeEnv?.kind === "ssh") {
            // Read SFTP file
            const readResp = await wsManager.sendRequest({
              type: BackendRequestType.SftpReadFile,
              payload: {
                path,
                environmentId: activeEnvId,
                active_environment_details: activeEnv || undefined,
              },
            });
            if (readResp.type !== BackendResponseType.SftpReadFileResponse) {
              throw new Error("Failed to read original file for duplicate.");
            }

            // Write SFTP file
            const writeResp = await wsManager.sendRequest({
              type: BackendRequestType.SftpWriteFile,
              payload: {
                path: newPath,
                content: readResp.payload.content,
                environmentId: activeEnvId,
                active_environment_details: activeEnv || undefined,
              },
            });
            if (writeResp.type !== BackendResponseType.SftpWriteFileResponse) {
              throw new Error("Failed to write duplicate file.");
            }
            if (get().projectRootPath) get().fetchFileTree(get().projectRootPath as string);
            return true;
          } else {
            // Read local file
            const readResp = await wsManager.sendRequest({
              type: BackendRequestType.ReadFile,
              payload: {
                path,
                environmentId: activeEnvId,
                active_environment_details: activeEnv || undefined,
              },
            });
            if (readResp.type !== BackendResponseType.ReadFileResponse) {
              throw new Error("Failed to read original file for duplicate.");
            }

            // Write local file
            const writeResp = await wsManager.sendRequest({
              type: BackendRequestType.WriteFile,
              payload: {
                path: newPath,
                content: readResp.payload.content,
                environmentId: activeEnvId,
                active_environment_details: activeEnv || undefined,
              },
            });
            if (writeResp.type !== BackendResponseType.WriteFileResponse) {
              throw new Error("Failed to write duplicate file.");
            }
            if (get().projectRootPath) get().fetchFileTree(get().projectRootPath as string);
            return true;
          }
        },
        deletePath: (path, envId, envDetails) => {
          const activeEnvId = envId || get().activeEnvId;
          const activeEnv = envDetails || get().environments.find((env) => env.id === activeEnvId);
          if (activeEnv?.kind === "ssh") {
            // Assuming it's a file for now based on UI action
            return wsManager
              .sendRequest({
                type: BackendRequestType.SftpRemoveFile,
                payload: {
                  path: path,
                  environmentId: get().activeEnvId,
                  active_environment_details: activeEnv,
                },
              })
              .then((response) => {
                if (response.type === BackendResponseType.SftpRemoveFileResponse) {
                  get().fetchFileTree(get().projectRootPath!); // Refresh tree
                  return true;
                } else if (response.type === BackendResponseType.Error) {
                  throw new Error(response.payload.message);
                } else {
                  throw new Error(`Unexpected response type for deletePath: ${response.type}`);
                }
              });
          } else {
            return wsManager
              .sendRequest({
                type: BackendRequestType.DeletePath,
                payload: {
                  path: path,
                  environmentId: activeEnvId,
                  active_environment_details: activeEnv || undefined,
                },
              })
              .then((response) => {
                if (response.type === BackendResponseType.DeletePathResponse) {
                  get().fetchFileTree(get().projectRootPath!); // Refresh tree
                  return true;
                } else if (response.type === BackendResponseType.Error) {
                  throw new Error(response.payload.message);
                } else {
                  throw new Error(`Unexpected response type for deletePath: ${response.type}`);
                }
              });
          }
        },
        // Editor - Updated to use backend for file content
        tabs: [], // Initially empty
        activePath: null,
        openFile: (path) => {
          const state = get();
          const existingTab = state.tabs.find((t) => t.path === path);

          if (existingTab) {
            set({ activePath: path });
            return;
          }
          // Request file content from backend
          const activeEnv = get().environments.find((env) => env.id === get().activeEnvId);
          if (activeEnv?.kind === "ssh") {
            wsManager.sendRequest({
              type: BackendRequestType.SftpReadFile,
              payload: {
                path,
                environmentId: get().activeEnvId,
                active_environment_details: activeEnv,
              },
            });
          } else {
            wsManager.sendRequest({
              type: BackendRequestType.ReadFile,
              payload: {
                path,
                environmentId: get().activeEnvId,
                active_environment_details: activeEnv || undefined,
              },
            });
          }
        },
        closeTab: (path) => {
          const state = get();
          const tabToClose = state.tabs.find((t) => t.path === path);

          if (tabToClose && tabToClose.dirty) {
            if (
              window.confirm(
                `Do you want to save changes to ${tabToClose.name}? Click OK to save and close, Cancel to close and discard changes.`,
              )
            ) {
              get().saveFile(path);
            }
          }

          const remaining = state.tabs.filter((t) => t.path !== path);
          const nextActive =
            state.activePath === path
              ? remaining[remaining.length - 1]?.path || null
              : state.activePath;
          set({ tabs: remaining, activePath: nextActive });
        },
        setActive: (path) => set({ activePath: path }),
        updateContent: (path, content) =>
          set((s) => ({
            tabs: s.tabs.map((t) => (t.path === path ? { ...t, content, dirty: true } : t)),
          })),
        saveFile: (path) => {
          const state = get();
          const tab = state.tabs.find((t) => t.path === path);
          console.log("saveFile called for path:", path, "tab:", tab);
          if (tab && tab.dirty) {
            const activeEnv = get().environments.find((env) => env.id === get().activeEnvId);
            console.log("saveFile activeEnv:", activeEnv);
            let promise;
            if (activeEnv?.kind === "ssh") {
              promise = wsManager.sendRequest({
                type: BackendRequestType.SftpWriteFile,
                payload: {
                  path: tab.path,
                  content: tab.content,
                  environmentId: get().activeEnvId,
                  active_environment_details: activeEnv,
                },
              });
            } else {
              promise = wsManager.sendRequest({
                type: BackendRequestType.WriteFile,
                payload: {
                  path: tab.path,
                  content: tab.content,
                  environmentId: get().activeEnvId,
                  active_environment_details: activeEnv || undefined,
                },
              });
            }

            promise
              .then((response) => {
                if (
                  response.type === BackendResponseType.WriteFileResponse ||
                  response.type === BackendResponseType.SftpWriteFileResponse
                ) {
                  toast.success(`File saved: ${response.payload.path}`);
                  set((s) => ({
                    tabs: s.tabs.map((t) =>
                      t.path === response.payload.path ? { ...t, dirty: false } : t,
                    ),
                  }));
                } else if (response.type === BackendResponseType.Error) {
                  toast.error(`Error saving file: ${response.payload.message}`);
                }
              })
              .catch((err) => {
                console.error("Failed to save file", err);
                toast.error(`Error saving file`);
              });
          }
        },
        saveActive: () => {
          const state = get();
          if (state.activePath) {
            get().saveFile(state.activePath);
          }
        },

        // Connect SSH
        connectSsh: async (environmentId: string, environmentDetails: Environment) => {
          return wsManager.sendRequest({
            type: BackendRequestType.ConnectSsh,
            payload: {
              environmentId,
              active_environment_details: environmentDetails,
            },
          });
        },

        // Generate SSH Key
        generateSshKey: async () => {
          return wsManager.sendRequest({
            type: BackendRequestType.GenerateSshKey,
            payload: {},
          });
        },

        // SFTP File Operations
        sftpListDir: async (
          path: string,
          environmentId: string,
          environmentDetails: Environment,
        ) => {
          return wsManager
            .sendRequest({
              type: BackendRequestType.SftpListDir,
              payload: {
                path,
                environmentId,
                active_environment_details: environmentDetails,
              },
            })
            .then((response: any) => {
              if (response.type === BackendResponseType.SftpListDirResponse) {
                return response.payload.nodes;
              } else if (response.type === BackendResponseType.Error) {
                throw new Error(response.payload.message);
              }
              throw new Error(`Unexpected response type: ${response.type}`);
            });
        },
        sftpReadFile: async (
          path: string,
          environmentId: string,
          environmentDetails: Environment,
        ) => {
          return wsManager.sendRequest({
            type: BackendRequestType.SftpReadFile,
            payload: {
              path,
              environmentId,
              active_environment_details: environmentDetails,
            },
          });
        },
        sftpWriteFile: async (
          path: string,
          content: string,
          environmentId: string,
          environmentDetails: Environment,
        ) => {
          return wsManager.sendRequest({
            type: BackendRequestType.SftpWriteFile,
            payload: {
              path,
              content,
              environmentId,
              active_environment_details: environmentDetails,
            },
          });
        },
        sftpCreateDir: async (
          path: string,
          environmentId: string,
          environmentDetails: Environment,
        ) => {
          return wsManager
            .sendRequest({
              type: BackendRequestType.SftpCreateDir,
              payload: {
                path,
                environmentId,
                active_environment_details: environmentDetails,
              },
            })
            .then((response: any) => {
              if (response.type === BackendResponseType.Error) {
                throw new Error(response.payload.message);
              }
              return response;
            });
        },
        sftpRemoveFile: async (
          path: string,
          environmentId: string,
          environmentDetails: Environment,
        ) => {
          return wsManager.sendRequest({
            type: BackendRequestType.SftpRemoveFile,
            payload: {
              path,
              environmentId,
              active_environment_details: environmentDetails,
            },
          });
        },
        sftpRemoveDir: async (
          path: string,
          environmentId: string,
          environmentDetails: Environment,
        ) => {
          return wsManager.sendRequest({
            type: BackendRequestType.SftpRemoveDir,
            payload: {
              path,
              environmentId,
              active_environment_details: environmentDetails,
            },
          });
        },
        sftpRename: async (
          oldPath: string,
          newPath: string,
          environmentId: string,
          environmentDetails: Environment,
        ) => {
          return wsManager.sendRequest({
            type: BackendRequestType.SftpRename,
            payload: {
              old_path: oldPath,
              new_path: newPath,
              environmentId,
              active_environment_details: environmentDetails,
            },
          });
        },
        updateFileContentFromBackend: (path, content) => {
          set((state) => ({
            tabs: state.tabs.map((t) => (t.path === path ? { ...t, content, dirty: false } : t)),
          }));
        },

        // AI
        chatHistory: [],
        activeChatId: null,
        chatMode: "code",
        setChatMode: (mode) => set({ chatMode: mode }),
        
        // AI State
        messages: [],
        streaming: false,
        activeAiRequestId: null,
        changeSets: {},
        pendingAttachments: [],
        addPendingAttachment: (f: File) =>
          set((s) => ({ pendingAttachments: [...s.pendingAttachments, f] })),
        removePendingAttachment: (index: number) =>
          set((s) => ({
            pendingAttachments: s.pendingAttachments.filter((_, i) => i !== index),
          })),
        clearPendingAttachments: () => set({ pendingAttachments: [] }),
        compactChat: () => {
          const state = get();
          if (state.streaming || state.messages.length === 0) return;
          
          set({ isCompacting: true });
          get().send(
            "[SYSTEM COMMAND] Summarize our entire conversation history above into a dense technical summary. Include all key architectural decisions, the current state of the code, and immediate next steps. Do not include pleasantries. Start directly with the summary. This will serve as our compacted memory.",
          );
        },

        send: (text, attachments = [], contextPills = []) => {
          const state = get();

          let sessionId = state.activeChatId;
          if (!sessionId) {
            sessionId = `c_${Math.random().toString(36).slice(2, 9)}`;
            const title = text.slice(0, 30) + (text.length > 30 ? "..." : "");
            set({ activeChatId: sessionId });

            wsManager.sendRequest({
              type: BackendRequestType.SaveChatSession,
              payload: {
                session: {
                  id: sessionId,
                  title,
                  updated_at: Date.now(),
                },
              },
            });

            // Optimistically update chat history UI
            set({
              chatHistory: [
                { id: sessionId, title, messages: [], updatedAt: Date.now() },
                ...state.chatHistory,
              ],
            });
          }

          const userId = `m_u_${Math.random().toString(36).slice(2, 9)}`;
          const assistantId = `m_a_${Math.random().toString(36).slice(2, 9)}`;

          const userParts: any[] = [{ type: "text", text }];

          if (attachments && attachments.length > 0) {
            attachments.forEach((att) => {
              userParts.push({ type: "attachment", name: att.name, attachType: "file" });
            });
          }
          if (contextPills && contextPills.length > 0) {
            contextPills.forEach((pill) => {
              userParts.push({ type: "attachment", name: pill.name, attachType: pill.type });
            });
          }

          const newMessages: ChatMessage[] = [
            ...state.messages,
            { id: userId, role: "user", parts: userParts },
            { id: assistantId, role: "assistant", parts: [{ type: "text", text: "" }] },
          ];

          // Handle @scrape shortcut
          if (text.startsWith("@scrape ")) {
            const parts = text.split(" ");
            if (parts.length >= 3) {
              const url = parts[1];
              const topic = parts.slice(2).join("_"); // E.g., @scrape https://docs.rs/reqwest reqwest_docs

              set({ messages: newMessages, streaming: false }); // Stop fake streaming

              // Save user message
              wsManager.sendRequest({
                type: BackendRequestType.SaveChatMessage,
                payload: {
                  message: {
                    id: userId,
                    session_id: sessionId,
                    role: "user",
                    content: JSON.stringify(userParts), // Store full parts array as JSON
                    created_at: Date.now(),
                  },
                },
              });

              get().scrapeWeb(url, topic);
              return;
            }
          }

          set({ messages: newMessages, streaming: true, activeAiRequestId: assistantId });

          // Save user message to backend
          wsManager.sendRequest({
            type: BackendRequestType.SaveChatMessage,
            payload: {
              message: {
                id: userId,
                session_id: sessionId,
                role: "user",
                content: JSON.stringify(userParts), // Store full parts array as JSON
                created_at: Date.now(),
              },
            },
          });

          // Build context package
          const activeTab = state.tabs.find((t) => t.path === state.activePath);
          const activeModel = state.models.find((m) => m.id === state.activeModelId);
          const activeProfile = state.profiles.find((p) => p.id === state.chatMode) || null;
          const currentContextSettings = state.contextSettings;

          get().addTelemetryTrace(`AI Stream requested (Model: ${activeModel?.name})`);
          wsManager.sendRequest({
            type: BackendRequestType.AiChatStream,
            payload: {
              model: activeModel,
              profile: activeProfile,
              chatHistory: state.messages, // We send state.messages here, which is BEFORE the new user message. The backend appends the new prompt manually.
              prompt: text,
              mcpServers: state.mcpTools.filter((t) => t.isEnabled),
              context: {
                activeFile: activeTab
                  ? { path: activeTab.path, content: activeTab.content }
                  : undefined,
                attachments: attachments,
                knowledgeFiles: contextPills
                  .filter((p) => p.type === "knowledge")
                  .map((p) => p.name),
                projectRoot: state.projectRootPath || undefined,
                contextSettings: currentContextSettings,
              },
              request_id: assistantId, // Use assistantId as request_id so we can stream into it
            },
          }).catch((err) => {
            console.log("Frontend: AiChatStream promise rejected (likely stopped by user):", err);
          });
        },
        stop: () => {
          const requestId = get().activeAiRequestId;
          if (requestId) {
            get().addTelemetryTrace(`AI generation stopped by user for task: ${requestId.substring(0, 8)}...`);
            wsManager.sendRequest({
              type: BackendRequestType.StopAiGeneration,
              payload: { request_id: requestId },
            });
          }
          set({ streaming: false, activeAiRequestId: null });
        },
        clear: () => {
          // Just clear local state, the DB has everything
          set({ messages: [], activeChatId: null });
        },
        loadChat: (id) => {
          set({ activeChatId: id, messages: [] }); // Reset while loading
          const wsManager = getWebSocketManager();
          wsManager.sendRequest({
            type: BackendRequestType.GetChatMessages,
            payload: {
              session_id: id,
              request_id: id, // Used to correlate the response
            },
          });
        },
        deleteChat: (id) => {
          const state = get();
          const wsManager = getWebSocketManager();
          wsManager.sendRequest({
            type: BackendRequestType.DeleteChatSession,
            payload: { id },
          });

          const chatHistory = state.chatHistory.filter((c) => c.id !== id);
          if (state.activeChatId === id) {
            set({ chatHistory, messages: [], activeChatId: null });
          } else {
            set({ chatHistory });
          }
        },
        regenerate: (id) => {
          const state = get();
          const realIdx = state.messages.findIndex((m) => m.id === id);
          if (realIdx < 0) return;

          const next = [...state.messages];
          const userMsg = next[realIdx - 1];
          if (!userMsg || userMsg.role !== "user") return;

          // Delete the cut messages from DB
          const wsManager = getWebSocketManager();
          const dropped = next.splice(realIdx - 1);
          for (const msg of dropped) {
            wsManager.sendRequest({
              type: BackendRequestType.DeleteChatMessage,
              payload: { id: msg.id },
            });
          }

          set({ messages: next });

          const textPart = userMsg.parts.find((p) => p.type === "text");
          if (textPart && "text" in textPart) {
            get().send(textPart.text);
          }
        },
        editMessage: (id, newText) => {
          const state = get();
          const idx = state.messages.findIndex((m) => m.id === id);
          if (idx < 0) return;
          const userMsg = state.messages[idx];
          if (userMsg.role !== "user") return;

          const wsManager = getWebSocketManager();
          const dropped = state.messages.slice(idx);
          for (const msg of dropped) {
            wsManager.sendRequest({
              type: BackendRequestType.DeleteChatMessage,
              payload: { id: msg.id },
            });
          }

          const next = state.messages.slice(0, idx);
          set({ messages: next });
          get().send(newText);
        },
        applyChangeSet: (id) =>
          set((s) => {
            const cs = s.changeSets[id];
            if (!cs) return s;
            // Apply to open tabs
            const updatedTabs = s.tabs.map((t) => {
              const file = cs.files.find(
                (f) => f.path === t.path || "untitled." + f.path.split(".").pop() === t.path,
              );
              if (file) {
                // Also write to backend if it's a real path
                const isUntitled =
                  t.path.split("/").pop()?.startsWith("untitled.") ||
                  t.path.startsWith("untitled.");
                if (!isUntitled) {
                  const activeEnv = s.environments.find((env) => env.id === s.activeEnvId);
                  if (activeEnv?.kind === "ssh") {
                    getWebSocketManager()
                      .sendRequest({
                        type: BackendRequestType.SftpWriteFile,
                        payload: {
                          path: t.path,
                          content: file.after,
                          environmentId: s.activeEnvId,
                          active_environment_details: activeEnv,
                        },
                      })
                      .then((resp) => {
                        if (resp.type === BackendResponseType.Error)
                          toast.error("SFTP Save failed: " + resp.payload.message);
                        else toast.success(`Saved to SSH: ${t.path}`);
                      })
                      .catch((err) => toast.error("SFTP Request failed: " + err));
                  } else {
                    getWebSocketManager()
                      .sendRequest({
                        type: BackendRequestType.WriteFile,
                        payload: {
                          path: t.path,
                          content: file.after,
                          environmentId: s.activeEnvId,
                          active_environment_details: activeEnv || undefined,
                        },
                      })
                      .then((resp) => {
                        if (resp.type === BackendResponseType.Error)
                          toast.error("Save failed: " + resp.payload.message);
                        else toast.success(`Saved locally: ${t.path}`);
                      })
                      .catch((err) => toast.error("Write Request failed: " + err));
                  }
                } else {
                  toast.warning(
                    `Cannot save ${t.path} to disk automatically. Please rename or save manually.`,
                  );
                }
                return { ...t, content: file.after, dirty: false }; // Since we saved it, it's not dirty anymore
              }
              return t;
            });

            // If file wasn't open, we should open it or write it
            for (const f of cs.files) {
              if (!updatedTabs.find((t) => t.path === f.path)) {
                // Not in tabs
                const activeEnv = s.environments.find((env) => env.id === s.activeEnvId);
                const isUntitled =
                  f.path.split("/").pop()?.startsWith("untitled.") ||
                  f.path.startsWith("untitled.");
                if (!isUntitled) {
                  if (activeEnv?.kind === "ssh") {
                    getWebSocketManager()
                      .sendRequest({
                        type: BackendRequestType.SftpWriteFile,
                        payload: {
                          path: f.path,
                          content: f.after,
                          environmentId: s.activeEnvId,
                          active_environment_details: activeEnv,
                        },
                      })
                      .then((resp) => {
                        if (resp.type === BackendResponseType.Error)
                          toast.error("SFTP Save failed: " + resp.payload.message);
                        else toast.success(`Saved to SSH: ${f.path}`);
                      })
                      .catch((err) => toast.error("SFTP Request failed: " + err));
                  } else {
                    getWebSocketManager()
                      .sendRequest({
                        type: BackendRequestType.WriteFile,
                        payload: {
                          path: f.path,
                          content: f.after,
                          environmentId: s.activeEnvId,
                          active_environment_details: activeEnv || undefined,
                        },
                      })
                      .then((resp) => {
                        if (resp.type === BackendResponseType.Error)
                          toast.error("Save failed: " + resp.payload.message);
                        else toast.success(`Saved locally: ${f.path}`);
                      })
                      .catch((err) => toast.error("Write Request failed: " + err));
                  }
                } else {
                  toast.warning(
                    `Cannot save ${f.path} to disk automatically. Please rename or save manually.`,
                  );
                }

                // Auto-open it as a new tab so the user can see it
                updatedTabs.push({
                  path: f.path,
                  name: f.name,
                  language: getLanguageFromPath(f.path),
                  content: f.after,
                  dirty: false,
                });
              }
            }

            return {
              tabs: updatedTabs,
              activePath: updatedTabs.length > 0 ? updatedTabs[0].path : s.activePath,
              changeSets: { ...s.changeSets, [id]: { ...cs, status: "applied" } },
            };
          }),
        rejectChangeSet: (id) =>
          set((s) => {
            const cs = s.changeSets[id];
            if (!cs) return s;
            return { changeSets: { ...s.changeSets, [id]: { ...cs, status: "rejected" } } };
          }),
        scrapeWeb: (url, topic) => {
          const state = get();
          if (!state.projectRootPath) {
            toast.error("No active project. Cannot save knowledge.");
            return;
          }

          const activeEnvId = state.activeEnvId;
          const activeEnv = state.environments.find((e) => e.id === activeEnvId);

          wsManager.sendRequest({
            type: BackendRequestType.ScrapeWeb,
            payload: {
              url,
              topic,
              project_root: state.projectRootPath,
              environmentId: activeEnvId,
              active_environment_details: activeEnv || undefined,
            },
          });
        },

        searchWeb: (query) => {
          const state = get();
          if (!state.projectRootPath) {
            toast.error("No active project. Cannot perform search.");
            return;
          }

          const activeEnvId = state.activeEnvId;
          const activeEnv = state.environments.find((e) => e.id === activeEnvId);

          wsManager.sendRequest({
            type: BackendRequestType.SearchWeb,
            payload: {
              query,
              project_root: state.projectRootPath,
              environmentId: activeEnvId,
              active_environment_details: activeEnv || undefined,
            },
          });
        },

        // Terminal
        terminals: [],
        activeTerminalId: null,
        addTerminal: (t) =>
          set((s) => ({ terminals: [...s.terminals, t], activeTerminalId: t.id })),
        removeTerminal: (id) =>
          set((s) => {
            const remaining = s.terminals.filter((t) => t.id !== id);
            const active =
              s.activeTerminalId === id
                ? (remaining[remaining.length - 1]?.id ?? null)
                : s.activeTerminalId;
            return { terminals: remaining, activeTerminalId: active };
          }),
        setActiveTerminal: (id) => set({ activeTerminalId: id }),

        // Preview State
        previewUrl: "http://localhost:5173/",
        previewDevice: "desktop",
        previewRunning: true,
        previewHistory: ["http://localhost:5173/"],
        previewHistoryIndex: 0,
        systemMessages: [
          {
            id: "s1",
            level: "info",
            text: "Dev server started on http://localhost:5173",
            at: "12:04:11",
          },
          { id: "s2", level: "info", text: "Compiled successfully in 842ms", at: "12:04:12" },
          { id: "s3", level: "warn", text: "React Fast Refresh: 1 module updated", at: "12:04:22" },
        ],
        setPreviewUrl: (url) =>
          set((s) => {
            const trimmed = s.previewHistory.slice(0, s.previewHistoryIndex + 1);
            const nextHistory = [...trimmed, url];
            return {
              previewUrl: url,
              previewHistory: nextHistory,
              previewHistoryIndex: nextHistory.length - 1,
            };
          }),
        setPreviewDevice: (d) => set({ previewDevice: d }),
        togglePreviewRunning: () => set((s) => ({ previewRunning: !s.previewRunning })),
        previewBack: () =>
          set((s) => {
            if (s.previewHistoryIndex <= 0) return s;
            const i = s.previewHistoryIndex - 1;
            return { previewHistoryIndex: i, previewUrl: s.previewHistory[i] };
          }),
        previewForward: () =>
          set((s) => {
            if (s.previewHistoryIndex >= s.previewHistory.length - 1) return s;
            const i = s.previewHistoryIndex + 1;
            return { previewHistoryIndex: i, previewUrl: s.previewHistory[i] };
          }),
        previewRefresh: () =>
          set((s) => ({
            systemMessages: [
              ...s.systemMessages,
              {
                id: `s_${Math.random().toString(36).slice(2, 8)}`,
                level: "info",
                text: `Reloaded ${s.previewUrl}`,
                at: new Date().toLocaleTimeString(),
              },
            ],
          })),
        pushSystemMessage: (level, text) =>
          set((s) => ({
            systemMessages: [
              ...s.systemMessages,
              {
                id: `s_${Math.random().toString(36).slice(2, 8)}`,
                level,
                text,
                at: new Date().toLocaleTimeString(),
              },
            ],
          })),

        // Environments
        environments: (() => {
          const isWindowAvailable = typeof window !== "undefined";
          const isWindows =
            isWindowAvailable && window.navigator.userAgent.toLowerCase().includes("win");
          const isMac =
            isWindowAvailable && window.navigator.userAgent.toLowerCase().includes("mac");
          const localOsName = isWindows ? "This Windows PC" : isMac ? "This Mac" : "Local Machine";

          const envs: Environment[] = [
            {
              id: "env_local",
              name: localOsName,
              kind: "local",
              detail: "Local Filesystem",
              status: "connected",
            },
          ];

          if (isWindows) {
            envs.push({
              id: "env_wsl",
              name: "WSL Ubuntu",
              kind: "wsl",
              detail: "Ubuntu-22.04",
              status: "disconnected",
            });
          }

          envs.push({
            id: "env_ssh",
            name: "Remote SSH",
            kind: "ssh",
            detail: "user@host:22",
            status: "disconnected",
          });

          return envs;
        })(),
        activeEnvId: "env_local",
        setActiveEnv: (id) =>
          set((state) => {
            const newActiveEnv = state.environments.find((env) => env.id === id);
            if (newActiveEnv) {
              wsManager.sendRequest({
                type: BackendRequestType.GetSuggestedProjectRoots,
                payload: {
                  environmentId: id,
                  active_environment_details: newActiveEnv,
                },
              });
            }
            return { activeEnvId: id };
          }),
        getEnvironments: async () => {
          return wsManager
            .sendRequest({
              type: BackendRequestType.GetEnvironments,
              payload: {},
            })
            .then((response: any) => {
              if (response.type === BackendResponseType.GetEnvironmentsResponse) {
                set((state) => {
                  // Merge built-in with fetched environments
                  const fetched = response.payload.environments;
                  const current = state.environments;
                  const builtIn = current.filter((e) => e.id === "env_local" || e.id === "env_wsl");
                  const combined = [...builtIn];
                  for (const env of fetched) {
                    if (env.id !== "env_local" && env.id !== "env_wsl") {
                      combined.push(env);
                    }
                  }
                  // Always ensure env_ssh default exists if no ssh env is in fetched
                  if (!combined.some((e) => e.kind === "ssh")) {
                    const defaultSsh: Environment = {
                      id: "env_ssh",
                      name: "Remote SSH",
                      kind: "ssh" as EnvironmentKind,
                      detail: "user@host:22",
                      status: "disconnected",
                    };
                    combined.push(defaultSsh);
                    // Let's actually save this default SSH environment back to the DB
                    // so the Foreign Key constraint for projects isn't broken!
                    get().saveEnvironment(defaultSsh).catch(console.error);
                  }

                  // Also save env_local and env_wsl to DB if they don't exist to prevent foreign key errors
                  for (const env of builtIn) {
                    get().saveEnvironment(env).catch(console.error);
                  }

                  return { environments: combined };
                });
                return response.payload.environments;
              } else if (response.type === BackendResponseType.Error) {
                throw new Error(response.payload.message);
              }
              throw new Error(`Unexpected response type: ${response.type}`);
            });
        },
        saveEnvironment: async (env) => {
          return wsManager
            .sendRequest({
              type: BackendRequestType.SaveEnvironment,
              payload: { environment: env },
            })
            .then((response: any) => {
              if (response.type === BackendResponseType.SaveEnvironmentResponse) {
                set((s) => {
                  const exists = s.environments.some((e) => e.id === env.id);
                  if (exists) {
                    return { environments: s.environments.map((e) => (e.id === env.id ? env : e)) };
                  } else {
                    return { environments: [...s.environments, env] };
                  }
                });
              } else if (response.type === BackendResponseType.Error) {
                throw new Error(response.payload.message);
              } else {
                throw new Error(`Unexpected response type: ${response.type}`);
              }
            });
        },
        deleteEnvironment: async (id) => {
          return wsManager
            .sendRequest({
              type: BackendRequestType.DeleteEnvironment,
              payload: { id },
            })
            .then((response: any) => {
              if (response.type === BackendResponseType.DeleteEnvironmentResponse) {
                set((s) => ({ environments: s.environments.filter((e) => e.id !== id) }));
              } else if (response.type === BackendResponseType.Error) {
                throw new Error(response.payload.message);
              } else {
                throw new Error(`Unexpected response type: ${response.type}`);
              }
            });
        },
        getRecentProjects: async () => {
          return wsManager
            .sendRequest({
              type: BackendRequestType.GetRecentProjects,
              payload: {},
            })
            .then((response: any) => {
              if (response.type === BackendResponseType.GetRecentProjectsResponse) {
                console.log("Recent projects fetched:", response.payload.projects);
                return response.payload.projects;
              } else if (response.type === BackendResponseType.Error) {
                throw new Error(response.payload.message);
              }
              throw new Error(`Unexpected response type: ${response.type}`);
            });
        },
        saveRecentProject: async (proj) => {
          return wsManager
            .sendRequest({
              type: BackendRequestType.SaveRecentProject,
              payload: {
                id: proj.id,
                name: proj.name,
                path: proj.path,
                environment_id: proj.environment_id,
              },
            })
            .then((response: any) => {
              if (response.type === BackendResponseType.Error) {
                throw new Error(response.payload.message);
              }
            });
        },
        deleteRecentProject: async (id) => {
          return wsManager
            .sendRequest({
              type: BackendRequestType.DeleteRecentProject,
              payload: { id },
            })
            .then((response: any) => {
              if (response.type === BackendResponseType.Error) {
                throw new Error(response.payload.message);
              }
            });
        },

        updateSshEnvironmentDetails: (id: string, updatedEnv: Environment) => {
          set((s) => ({
            environments: s.environments.map((env) => (env.id === id ? updatedEnv : env)),
          }));
          // Async save
          get().saveEnvironment(updatedEnv).catch(console.error);
        },
        addEnvironment: (env) => {
          const newEnv: Environment = {
            ...env,
            id: `env_${Math.random().toString(36).slice(2, 8)}`,
            status: "disconnected",
          };
          set((s) => ({ environments: [...s.environments, newEnv] }));
          get().saveEnvironment(newEnv).catch(console.error);
        },
        removeEnvironment: (id) => {
          set((s) => ({ environments: s.environments.filter((e) => e.id !== id) }));
          get().deleteEnvironment(id).catch(console.error);
        },

        // Models
        models: [
          {
            id: "m_gemini_3_1",
            name: "Gemini 3.1 Pro",
            provider: "Google",
            connection: "api",
            endpoint: "https://generativelanguage.googleapis.com/v1beta",
            identifier: "gemini-3.1-pro",
            hasApiKey: true,
            thinkingBudget: "medium",
            systemPrompt: "You are an expert AI programming assistant running in ELARA OS.",
            temperature: 0.7,
            contextWindow: 128000,
            maxTokens: 8192,
          },
          {
            id: "m_gemma4_31b",
            name: "Gemma 4 31B",
            provider: "Local",
            connection: "local",
            endpoint: "http://localhost:11434/v1",
            identifier: "gemma4:31b",
            hasApiKey: false,
            thinkingBudget: "none",
            systemPrompt: "You are an expert AI programming assistant.",
            temperature: 0.6,
            repetitionPenalty: 1.15,
            contextWindow: 32768,
            maxTokens: 8192,
            kvCache: "q8_0",
            chatTemplate:
              "{{ bos_token }}{% if messages[0]['role'] == 'system' %}{% set loop_messages = messages[1:] %}{% set system_message = messages[0]['content'] | trim + '\\n\\n' %}{% else %}{% set loop_messages = messages %}{% set system_message = '' %}{% endif %}{% for message in loop_messages %}{% if loop.index0 == 0 %}{% set content = system_message + message['content'] %}{% else %}{% set content = message['content'] %}{% endif %}{% if message['role'] == 'user' %}{{ '<start_of_turn>user\\n' + content | trim + '<end_of_turn>\\n' }}{% elif message['role'] == 'model' %}{{ '<start_of_turn>model\\n' + content | trim + '<end_of_turn>\\n' }}{% endif %}{% endfor %}{% if add_generation_prompt %}{{ '<start_of_turn>model\\n' }}{% endif %}",
            customParams: [{ key: "stop", value: '["<end_of_turn>", "<eos>"]' }],
          },
          {
            id: "m_gemma4_26b",
            name: "Gemma 4 26B",
            provider: "Local",
            connection: "local",
            endpoint: "http://localhost:11434/v1",
            identifier: "gemma4:26b",
            hasApiKey: false,
            thinkingBudget: "none",
            systemPrompt: "You are an expert AI programming assistant.",
            temperature: 0.6,
            repetitionPenalty: 1.15,
            contextWindow: 32768,
            maxTokens: 8192,
            kvCache: "q8_0",
            chatTemplate:
              "{{ bos_token }}{% if messages[0]['role'] == 'system' %}{% set loop_messages = messages[1:] %}{% set system_message = messages[0]['content'] | trim + '\\n\\n' %}{% else %}{% set loop_messages = messages %}{% set system_message = '' %}{% endif %}{% for message in loop_messages %}{% if loop.index0 == 0 %}{% set content = system_message + message['content'] %}{% else %}{% set content = message['content'] %}{% endif %}{% if message['role'] == 'user' %}{{ '<start_of_turn>user\\n' + content | trim + '<end_of_turn>\\n' }}{% elif message['role'] == 'model' %}{{ '<start_of_turn>model\\n' + content | trim + '<end_of_turn>\\n' }}{% endif %}{% endfor %}{% if add_generation_prompt %}{{ '<start_of_turn>model\\n' }}{% endif %}",
            customParams: [{ key: "stop", value: '["<end_of_turn>", "<eos>"]' }],
          },
          {
            id: "m_gemma3_27b",
            name: "Gemma 3 27B",
            provider: "Local",
            connection: "local",
            endpoint: "http://localhost:11434/v1",
            identifier: "gemma3:27b",
            hasApiKey: false,
            thinkingBudget: "none",
            systemPrompt: "You are an expert AI programming assistant.",
            temperature: 0.5,
            repetitionPenalty: 1.1,
            contextWindow: 32768,
            maxTokens: 8192,
            kvCache: "fp16",
            chatTemplate:
              "{{ bos_token }}{% if messages[0]['role'] == 'system' %}{% set loop_messages = messages[1:] %}{% set system_message = messages[0]['content'] | trim + '\\n\\n' %}{% else %}{% set loop_messages = messages %}{% set system_message = '' %}{% endif %}{% for message in loop_messages %}{% if loop.index0 == 0 %}{% set content = system_message + message['content'] %}{% else %}{% set content = message['content'] %}{% endif %}{% if message['role'] == 'user' %}{{ '<start_of_turn>user\\n' + content | trim + '<end_of_turn>\\n' }}{% elif message['role'] == 'model' %}{{ '<start_of_turn>model\\n' + content | trim + '<end_of_turn>\\n' }}{% endif %}{% endfor %}{% if add_generation_prompt %}{{ '<start_of_turn>model\\n' }}{% endif %}",
            customParams: [{ key: "stop", value: '["<end_of_turn>", "<eos>"]' }],
          },
        ],
        activeModelId: "m_gemini_3_1",
        setActiveModel: (id) => set({ activeModelId: id }),
        addModel: (m) =>
          set((s) => ({
            models: [...s.models, { ...m, id: `m_${Math.random().toString(36).slice(2, 8)}` }],
          })),
        updateModel: (id, updatedFields) =>
          set((s) => ({
            models: s.models.map((m) => (m.id === id ? { ...m, ...updatedFields } : m)),
          })),
        removeModel: (id) =>
          set((s) => {
            const models = s.models.filter((m) => m.id !== id);
            const activeModelId = s.activeModelId === id ? (models[0]?.id ?? "") : s.activeModelId;
            return { models, activeModelId };
          }),

        // MCP
        mcpTools: [],
        addMCPTool: (tool) =>
          set((s) => ({
            mcpTools: [
              ...s.mcpTools,
              { ...tool, id: `mcp_${Math.random().toString(36).slice(2, 8)}` },
            ],
          })),
        removeMCPTool: (id) =>
          set((s) => ({
            mcpTools: s.mcpTools.filter((t) => t.id !== id),
          })),
        toggleMCPTool: (id) =>
          set((s) => ({
            mcpTools: s.mcpTools.map((t) => (t.id === id ? { ...t, isEnabled: !t.isEnabled } : t)),
          })),

        // Profiles
        profiles: [],
        addProfile: (profile) =>
          set((s) => ({
            profiles: [
              ...s.profiles,
              { ...profile, id: `prof_${Math.random().toString(36).slice(2, 8)}` },
            ],
          })),
        removeProfile: (id) =>
          set((s) => ({
            profiles: s.profiles.filter((p) => p.id !== id),
          })),

        // Context Manager
        contextSettings: {
          strategy: "auto",
        },
        updateContextSettings: (settings) =>
          set((s) => ({
            contextSettings: { ...s.contextSettings, ...settings },
          })),

        // GitHub Integration
        githubConnected: false,
        githubUser: null,
        githubRepos: [],
        activeRepoId: null,
        branches: ["main", "develop"],
        activeBranch: "main",
        isGitRepo: false,
        remoteUrl: "",
        gitStatus: [],
        generatedCommitMessage: "",
        isGeneratingCommit: false,
        isPushing: false,
        setGeneratedCommitMessage: (msg) => set({ generatedCommitMessage: msg }),
        getGitStatus: () => {
          const root = get().projectRootPath;
          if (!root) return;
          getWebSocketManager().sendRequest({
            type: BackendRequestType.GetGitStatus as any,
            payload: { project_root: root }
          });
        },
        generateCommitMessage: () => {
          const root = get().projectRootPath;
          const activeModel = get().models.find(m => m.id === get().activeModelId);
          if (!root || !activeModel) {
             toast.error("Project root or active model not found.");
             return;
          }
          set({ isGeneratingCommit: true, generatedCommitMessage: "" });
          getWebSocketManager().sendRequest({
            type: BackendRequestType.GenerateCommitMessage as any,
            payload: { project_root: root, model: activeModel }
          });
        },
        commitAndPush: (message: string) => {
          const root = get().projectRootPath;
          if (!root) return;
          if (!message.trim()) {
             toast.error("Commit message cannot be empty.");
             return;
          }
          set({ isPushing: true });
          get().addTelemetryTrace(`Git Commit & Push initiated: "${message}"`);
          getWebSocketManager().sendRequest({
            type: BackendRequestType.GitCommitAndPush as any,
            payload: { project_root: root, message }
          });
        },
        pullFromRemote: () => {
          const root = get().projectRootPath;
          if (!root) return;

          toast.info("Pulling from remote...");
          get().addTelemetryTrace(`Git Pull from remote initiated.`);
          getWebSocketManager().sendRequest({
            type: BackendRequestType.GitPull as any,
            payload: { project_root: root }
          });
        },
        initGitRepo: () => {
          const root = get().projectRootPath;
          if (!root) return;
          getWebSocketManager().sendRequest({
            type: BackendRequestType.GitInit as any,
            payload: { project_root: root }
          });
        },
        addGitRemote: (url: string) => {
          const root = get().projectRootPath;
          if (!root) return;
          getWebSocketManager().sendRequest({
            type: BackendRequestType.GitAddRemote as any,
            payload: { project_root: root, remote_url: url }
          });
        },
        removeGitRemote: () => {
          const root = get().projectRootPath;
          if (!root) return;
          getWebSocketManager().sendRequest({
            type: BackendRequestType.GitRemoveRemote as any,
            payload: { project_root: root }
          });
        },
        connectGitHub: (user) =>
          set({
            githubConnected: true,
            githubUser: user,
            githubRepos: [
              {
                id: "r1",
                name: "forge",
                fullName: `${user}/forge`,
                private: false,
                branch: "main",
                updatedAt: "2 hours ago",
              },
              {
                id: "r2",
                name: "notes-app",
                fullName: `${user}/notes-app`,
                private: true,
                branch: "main",
                updatedAt: "yesterday",
              },
              {
                id: "r3",
                name: "rust-core",
                fullName: `${user}/rust-core`,
                private: true,
                branch: "develop",
                updatedAt: "3 days ago",
              },
            ],
          }),
        disconnectGitHub: () =>
          set({ githubConnected: false, githubUser: null, githubRepos: [], activeRepoId: null }),
        setActiveRepo: (id) => set({ activeRepoId: id }),
        setActiveBranch: (b) => set({ activeBranch: b }),

        // New action to initialize WebSocket connection
        initializeBackendConnection: () => {
          wsManager.connect();
        },
      };
    },
    {
      name: "forge-ide-store",
      partialize: (state) => ({
        models: state.models,
        activeModelId: state.activeModelId,
        mcpTools: state.mcpTools,
        profiles: state.profiles,
        appPasswordHash: state.appPasswordHash,
        isAppLocked: !!state.appPasswordHash, // if there is a password, lock on reload
      }),
      merge: (persistedState: any, currentState) => {
        // If the persisted state has models, check if it's the old single mock model
        // If so, replace it with the new comprehensive default models.
        if (persistedState?.models && persistedState.models.length <= 1) {
          persistedState.models = currentState.models;
          persistedState.activeModelId = currentState.activeModelId;
        }
        return { ...currentState, ...persistedState };
      },
    },
  ),
);
