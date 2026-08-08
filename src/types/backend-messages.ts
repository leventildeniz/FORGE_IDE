import { Environment, FileNode, RecentProject } from "./ide";

import type { ContextSettings } from "./ide";

export enum BackendRequestType {
  ListDir = "ListDir",
  ReadFile = "ReadFile",
  WriteFile = "WriteFile",
  CreateFile = "CreateFile",
  CreateDir = "CreateDir",
  DeletePath = "DeletePath",
  RenamePath = "RenamePath",
  GetSuggestedProjectRoots = "GetSuggestedProjectRoots",
  ConnectSsh = "ConnectSsh",
  GenerateSshKey = "GenerateSshKey",
  GetEnvironments = "GetEnvironments",
  SaveEnvironment = "SaveEnvironment",
  DeleteEnvironment = "DeleteEnvironment",
  GetRecentProjects = "GetRecentProjects",
  SaveRecentProject = "SaveRecentProject",
  DeleteRecentProject = "DeleteRecentProject",
  SftpListDir = "SftpListDir",
  SftpReadFile = "SftpReadFile",
  SftpWriteFile = "SftpWriteFile",
  SftpCreateDir = "SftpCreateDir",
  SftpRemoveFile = "SftpRemoveFile",
  SftpRemoveDir = "SftpRemoveDir",
  SftpRename = "SftpRename",
  SpawnTerminal = "SpawnTerminal",
  TerminalInput = "TerminalInput",
  ResizeTerminal = "ResizeTerminal",
  CloseTerminal = "CloseTerminal",
  AiChatStream = "AiChatStream",
  GetChatSessions = "GetChatSessions",
  SaveChatSession = "SaveChatSession",
  DeleteChatSession = "DeleteChatSession",
  GetChatMessages = "GetChatMessages",
  SaveChatMessage = "SaveChatMessage",
  DeleteChatMessage = "DeleteChatMessage",
  InitKnowledgeBase = "InitKnowledgeBase",
  SaveKnowledge = "SaveKnowledge",
  GetKnowledge = "GetKnowledge",
  ScrapeWeb = "ScrapeWeb",
  SearchWeb = "SearchWeb",
  StopAiGeneration = "StopAiGeneration",
  TakeScreenshot = "TakeScreenshot",
  ExportProject = "ExportProject",
  GetGitStatus = "GetGitStatus",
  GenerateCommitMessage = "GenerateCommitMessage",
  GitCommitAndPush = "GitCommitAndPush",
  GitInit = "GitInit",
  GitAddRemote = "GitAddRemote",
  GitRemoveRemote = "GitRemoveRemote",
  GitPull = "GitPull",
  SetDebugLog = "SetDebugLog",
}

export type BackendRequest =
  | {
      type: BackendRequestType.ListDir;
      payload: {
        path: string;
        recursive: boolean;
        environmentId?: string;
        active_environment_details?: Environment;
        request_id?: string;
      };
    }
  | {
      type: BackendRequestType.ReadFile;
      payload: {
        path: string;
        environmentId?: string;
        active_environment_details?: Environment;
        request_id?: string;
      };
    }
  | {
      type: BackendRequestType.WriteFile;
      payload: {
        path: string;
        content: string;
        environmentId?: string;
        active_environment_details?: Environment;
        request_id?: string;
      };
    }
  | {
      type: BackendRequestType.CreateFile;
      payload: {
        path: string;
        environmentId?: string;
        active_environment_details?: Environment;
        request_id?: string;
      };
    }
  | {
      type: BackendRequestType.CreateDir;
      payload: {
        path: string;
        environmentId?: string;
        active_environment_details?: Environment;
        request_id?: string;
        is_project_root?: boolean;
      };
    }
  | {
      type: BackendRequestType.DeletePath;
      payload: {
        path: string;
        environmentId?: string;
        active_environment_details?: Environment;
        request_id?: string;
      };
    }
  | {
      type: BackendRequestType.RenamePath;
      payload: {
        old_path: string;
        new_path: string;
        environmentId?: string;
        active_environment_details?: Environment;
        request_id?: string;
      };
    }
  | {
      type: BackendRequestType.GetSuggestedProjectRoots;
      payload: {
        environmentId?: string;
        active_environment_details?: Environment;
        request_id?: string;
      };
    }
  | {
      type: BackendRequestType.ConnectSsh;
      payload: {
        environmentId: string;
        active_environment_details: Environment;
        request_id?: string;
      };
    }
  | {
      type: BackendRequestType.AiChatStream;
      payload: {
        model: AIModel;
        profile: CustomProfile | null;
        chatHistory: ChatMessage[];
        prompt: string;
        mcpServers?: MCPTool[];
        context: {
          activeFile?: { path: string; content: string };
          attachments?: any[];
          knowledgeFiles?: string[];
          projectRoot?: string;
          contextSettings?: ContextSettings;
        };
        request_id?: string;
      };
    }
  | { type: BackendRequestType.GenerateSshKey; payload: { request_id?: string } }
  | { type: BackendRequestType.GetEnvironments; payload: { request_id?: string } }
  | {
      type: BackendRequestType.SaveEnvironment;
      payload: { environment: Environment; request_id?: string };
    }
  | { type: BackendRequestType.DeleteEnvironment; payload: { id: string; request_id?: string } }
  | { type: BackendRequestType.GetRecentProjects; payload: { request_id?: string } }
  | {
      type: BackendRequestType.SaveRecentProject;
      payload: {
        id: string;
        name: string;
        path: string;
        environment_id: string;
        request_id?: string;
      };
    }
  | { type: BackendRequestType.DeleteRecentProject; payload: { id: string; request_id?: string } }
  | {
      type: BackendRequestType.SftpListDir;
      payload: {
        path: string;
        environmentId: string;
        active_environment_details: Environment;
        request_id?: string;
      };
    }
  | {
      type: BackendRequestType.SftpReadFile;
      payload: {
        path: string;
        environmentId: string;
        active_environment_details: Environment;
        request_id?: string;
      };
    }
  | {
      type: BackendRequestType.SftpWriteFile;
      payload: {
        path: string;
        content: string;
        environmentId: string;
        active_environment_details: Environment;
        request_id?: string;
      };
    }
  | {
      type: BackendRequestType.SftpCreateDir;
      payload: {
        path: string;
        environmentId: string;
        active_environment_details: Environment;
        request_id?: string;
      };
    }
  | {
      type: BackendRequestType.SftpRemoveFile;
      payload: {
        path: string;
        environmentId: string;
        active_environment_details: Environment;
        request_id?: string;
      };
    }
  | {
      type: BackendRequestType.SftpRemoveDir;
      payload: {
        path: string;
        environmentId: string;
        active_environment_details: Environment;
        request_id?: string;
      };
    }
  | {
      type: BackendRequestType.SftpRename;
      payload: {
        old_path: string;
        new_path: string;
        environmentId: string;
        active_environment_details: Environment;
        request_id?: string;
      };
    }
  | {
      type: BackendRequestType.GetChatSessions;
      payload: { project_root: string; request_id?: string };
    }
  | {
      type: BackendRequestType.SaveChatSession;
      payload: { session: any; project_root: string; request_id?: string };
    }
  | { type: BackendRequestType.DeleteChatSession; payload: { id: string; request_id?: string } }
  | {
      type: BackendRequestType.GetChatMessages;
      payload: { session_id: string; request_id?: string };
    }
  | { type: BackendRequestType.SaveChatMessage; payload: { message: any; request_id?: string } }
  | { type: BackendRequestType.DeleteChatMessage; payload: { id: string; request_id?: string } }
  | {
      type: BackendRequestType.InitKnowledgeBase;
      payload: { project_root: string; request_id?: string };
    }
  | {
      type: BackendRequestType.SaveKnowledge;
      payload: { project_root: string; topic: string; content: string; request_id?: string };
    }
  | {
      type: BackendRequestType.GetKnowledge;
      payload: { project_root: string; topic: string; request_id?: string };
    }
  | {
      type: BackendRequestType.ScrapeWeb;
      payload: {
        url: string;
        topic: string;
        project_root: string;
        environmentId?: string;
        active_environment_details?: Environment;
        request_id?: string;
      };
    }
  | {
      type: BackendRequestType.SearchWeb;
      payload: {
        query: string;
        project_root: string;
        environmentId?: string;
        active_environment_details: Environment;
        request_id?: string;
      };
    }
  | {
      type: BackendRequestType.StopAiGeneration;
      payload: {
        request_id: string;
      };
    }
  | {
      type: BackendRequestType.TakeScreenshot;
      payload: {
        url: string;
      };
    }
  | {
      type: BackendRequestType.ExportProject;
      payload: {
        project_root: string;
        request_id?: string;
      };
    }
  | {
      type: BackendRequestType.GetGitStatus;
      payload: {
        project_root: string;
        request_id?: string;
      };
    }
  | {
      type: BackendRequestType.GenerateCommitMessage;
      payload: {
        project_root: string;
        model: any;
        request_id?: string;
      };
    }
  | {
      type: BackendRequestType.GitCommitAndPush;
      payload: {
        project_root: string;
        message: string;
        request_id?: string;
      };
    }
  | {
      type: BackendRequestType.GitInit;
      payload: { project_root: string; request_id?: string };
    }
  | {
      type: BackendRequestType.GitAddRemote;
      payload: { project_root: string; remote_url: string; request_id?: string };
    }
  | {
      type: BackendRequestType.GitRemoveRemote;
      payload: { project_root: string; request_id?: string };
    }
  | {
      type: BackendRequestType.GitPull;
      payload: { project_root: string; request_id?: string };
    }
  | {
      type: BackendRequestType.SetDebugLog;
      payload: { enabled: boolean; request_id?: string };
    }
  | {
      type: BackendRequestType.SpawnTerminal;
      payload: {
        terminal_id: string;
        cwd: string;
        cols: number;
        rows: number;
        environmentId?: string;
        active_environment_details?: Environment;
        request_id?: string;
      };
    }
  | {
      type: BackendRequestType.TerminalInput;
      payload: {
        terminal_id: string;
        data: string;
        request_id?: string;
      };
    }
  | {
      type: BackendRequestType.ResizeTerminal;
      payload: {
        terminal_id: string;
        cols: number;
        rows: number;
        request_id?: string;
      };
    }
  | {
      type: BackendRequestType.CloseTerminal;
      payload: {
        terminal_id: string;
        request_id?: string;
      };
    };

export enum BackendResponseType {
  ListDirResponse = "ListDirResponse",
  ReadFileResponse = "ReadFileResponse",
  WriteFileResponse = "WriteFileResponse",
  CreateFileResponse = "CreateFileResponse",
  CreateDirResponse = "CreateDirResponse",
  DeletePathResponse = "DeletePathResponse",
  RenamePathResponse = "RenamePathResponse",
  Error = "Error",
  SuggestedProjectRootsResponse = "SuggestedProjectRootsResponse",
  ConnectSshResponse = "ConnectSshResponse",
  AiChatStreamResponse = "AiChatStreamResponse",
  GetEnvironmentsResponse = "GetEnvironmentsResponse",
  SaveEnvironmentResponse = "SaveEnvironmentResponse",
  DeleteEnvironmentResponse = "DeleteEnvironmentResponse",
  GetRecentProjectsResponse = "GetRecentProjectsResponse",
  SaveRecentProjectResponse = "SaveRecentProjectResponse",
  DeleteRecentProjectResponse = "DeleteRecentProjectResponse",
  SftpListDirResponse = "SftpListDirResponse",
  SftpReadFileResponse = "SftpReadFileResponse",
  SftpWriteFileResponse = "SftpWriteFileResponse",
  SftpCreateDirResponse = "SftpCreateDirResponse",
  SftpRemoveFileResponse = "SftpRemoveFileResponse",
  SftpRemoveDirResponse = "SftpRemoveDirResponse",
  SftpRenameResponse = "SftpRenameResponse",
  SpawnTerminalResponse = "SpawnTerminalResponse",
  TerminalOutput = "TerminalOutput",
  TerminalClosed = "TerminalClosed",
  GetChatSessionsResponse = "GetChatSessionsResponse",
  SaveChatSessionResponse = "SaveChatSessionResponse",
  DeleteChatSessionResponse = "DeleteChatSessionResponse",
  GetChatMessagesResponse = "GetChatMessagesResponse",
  SaveChatMessageResponse = "SaveChatMessageResponse",
  DeleteChatMessageResponse = "DeleteChatMessageResponse",
  InitKnowledgeBaseResponse = "InitKnowledgeBaseResponse",
  SaveKnowledgeResponse = "SaveKnowledgeResponse",
  GetKnowledgeResponse = "GetKnowledgeResponse",
  ScrapeWebResponse = "ScrapeWebResponse",
  SearchWebResponse = "SearchWebResponse",
  TakeScreenshotResponse = "TakeScreenshotResponse",
  ExportProjectResponse = "ExportProjectResponse",
  GetGitStatusResponse = "GetGitStatusResponse",
  GenerateCommitMessageResponse = "GenerateCommitMessageResponse",
  GitCommitAndPushResponse = "GitCommitAndPushResponse",
  GitInitResponse = "GitInitResponse",
  GitAddRemoteResponse = "GitAddRemoteResponse",
  GitRemoveRemoteResponse = "GitRemoveRemoteResponse",
  GitPullResponse = "GitPullResponse",
  TelemetryUpdate = "TelemetryUpdate",
}

export type BackendResponse =
  | {
      type: BackendResponseType.ListDirResponse;
      payload: { path: string; nodes: FileNode[]; request_id?: string };
    }
  | {
      type: BackendResponseType.ReadFileResponse;
      payload: { path: string; content: string; request_id?: string };
    }
  | { type: BackendResponseType.WriteFileResponse; payload: { path: string; request_id?: string } }
  | { type: BackendResponseType.CreateFileResponse; payload: { path: string; request_id?: string } }
  | { type: BackendResponseType.CreateDirResponse; payload: { path: string; request_id?: string } }
  | { type: BackendResponseType.DeletePathResponse; payload: { path: string; request_id?: string } }
  | {
      type: BackendResponseType.RenamePathResponse;
      payload: { old_path: string; new_path: string; request_id?: string };
    }
  | { type: BackendResponseType.Error; payload: { message: string; request_id?: string } }
  | {
      type: BackendResponseType.SuggestedProjectRootsResponse;
      payload: { roots: FileNode[]; request_id?: string };
    }
  | {
      type: BackendResponseType.ConnectSshResponse;
      payload: { environmentId: string; status: string; message?: string; request_id?: string };
    }
  | {
      type: BackendResponseType.GenerateSshKeyResponse;
      payload: { private_key_pem: string; public_key_openssh: string; request_id?: string };
    }
  | {
      type: BackendResponseType.GetEnvironmentsResponse;
      payload: { environments: Environment[]; request_id?: string };
    }
  | { type: BackendResponseType.SaveEnvironmentResponse; payload: { request_id?: string } }
  | { type: BackendResponseType.DeleteEnvironmentResponse; payload: { request_id?: string } }
  | {
      type: BackendResponseType.GetRecentProjectsResponse;
      payload: { projects: RecentProject[]; request_id?: string };
    }
  | { type: BackendResponseType.SaveRecentProjectResponse; payload: { request_id?: string } }
  | { type: BackendResponseType.DeleteRecentProjectResponse; payload: { request_id?: string } }
  | {
      type: BackendResponseType.SftpListDirResponse;
      payload: { path: string; nodes: FileNode[]; request_id?: string };
    }
  | {
      type: BackendResponseType.SftpReadFileResponse;
      payload: { path: string; content: string; request_id?: string };
    }
  | {
      type: BackendResponseType.SftpWriteFileResponse;
      payload: { path: string; request_id?: string };
    }
  | {
      type: BackendResponseType.SftpCreateDirResponse;
      payload: { path: string; request_id?: string };
    }
  | {
      type: BackendResponseType.SftpRemoveFileResponse;
      payload: { path: string; request_id?: string };
    }
  | {
      type: BackendResponseType.SftpRemoveDirResponse;
      payload: { path: string; request_id?: string };
    }
  | {
      type: BackendResponseType.SftpRenameResponse;
      payload: { old_path: string; new_path: string; request_id?: string };
    }
  | {
      type: BackendResponseType.AiChatStreamResponse;
      payload: { message_id: string; chunk?: string; done: boolean; request_id?: string };
    }
  | {
      type: BackendResponseType.GetChatSessionsResponse;
      payload: { sessions: any[]; request_id?: string };
    }
  | { type: BackendResponseType.SaveChatSessionResponse; payload: { request_id?: string } }
  | { type: BackendResponseType.DeleteChatSessionResponse; payload: { request_id?: string } }
  | {
      type: BackendResponseType.GetChatMessagesResponse;
      payload: { messages: any[]; request_id?: string };
    }
  | { type: BackendResponseType.SaveChatMessageResponse; payload: { request_id?: string } }
  | { type: BackendResponseType.DeleteChatMessageResponse; payload: { request_id?: string } }
  | {
      type: BackendResponseType.InitKnowledgeBaseResponse;
      payload: { success: boolean; request_id?: string };
    }
  | {
      type: BackendResponseType.SaveKnowledgeResponse;
      payload: { success: boolean; request_id?: string };
    }
  | {
      type: BackendResponseType.GetKnowledgeResponse;
      payload: { content: string; request_id?: string };
    }
  | {
      type: BackendResponseType.ScrapeWebResponse;
      payload: { success: boolean; message: string; request_id?: string };
    }
  | {
      type: BackendResponseType.SearchWebResponse;
      payload: { success: boolean; message: string; topic?: string; request_id?: string };
    }
  | {
      type: BackendResponseType.TakeScreenshotResponse;
      payload: { url: string; base64: string; request_id?: string };
    }
  | {
      type: BackendResponseType.ExportProjectResponse;
      payload: { success: boolean; zip_path?: string; error?: string; request_id?: string };
    }
  | {
      type: BackendResponseType.GetGitStatusResponse;
      payload: { branch: string; files: { file: string; status: string }[]; request_id?: string };
    }
  | {
      type: BackendResponseType.GenerateCommitMessageResponse;
      payload: { message: string; request_id?: string };
    }
  | {
      type: BackendResponseType.GitCommitAndPushResponse;
      payload: { success: boolean; output: string; request_id?: string };
    }
  | {
      type: BackendResponseType.GitInitResponse;
      payload: { success: boolean; error?: string; request_id?: string };
    }
  | {
      type: BackendResponseType.GitAddRemoteResponse;
      payload: { success: boolean; error?: string; request_id?: string };
    }
  | {
      type: BackendResponseType.GitRemoveRemoteResponse;
      payload: { success: boolean; error?: string; request_id?: string };
    }
  | {
      type: BackendResponseType.GitPullResponse;
      payload: { success: boolean; output: string; request_id?: string };
    }
  | {
      type: BackendResponseType.TelemetryUpdate;
      payload: {
        context_window: number;
        system_tokens: number;
        knowledge_tokens: number;
        history_tokens: number;
        file_tokens: number;
        free_tokens: number;
        active_model?: string;
      };
    };
