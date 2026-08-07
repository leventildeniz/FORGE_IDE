use serde::{Deserialize, Serialize};

// Frontend'den gelen Environment tipinin Rust karşılığı
#[derive(Serialize, Deserialize, Clone)] // Debug kaldırıldı
pub struct Environment {
    pub id: String,
    pub name: String,
    pub kind: String,   // 'local', 'wsl', 'ssh'
    pub detail: String, // e.g. "Ubuntu-22.04" or "user@host:port"
    pub status: String, // 'connected', 'disconnected'
    // Yeni SSH bağlantı detayları (kind === "ssh" ise geçerli)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub host: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub username: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub port: Option<u16>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub password: Option<String>, // DİKKAT: Güvenlik nedeniyle dikkatli işlenmeli
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(rename = "privateKeyPath")]
    pub private_key_path: Option<String>, // YENİ: Özel anahtar yolu eklendi
}

// Environment için manuel Debug implementasyonu
impl std::fmt::Debug for Environment {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Environment")
            .field("id", &self.id)
            .field("name", &self.name)
            .field("kind", &self.kind)
            .field("detail", &self.detail)
            .field("status", &self.status)
            .field("host", &self.host)
            .field("username", &self.username)
            .field("port", &self.port)
            .field("password", &self.password.as_ref().map(|_| "<REDACTED>")) // Şifreyi gizle
            .field(
                "private_key_path",
                &self.private_key_path.as_ref().map(|_| "<REDACTED>"),
            ) // Özel anahtar yolunu gizle
            .finish()
    }
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload")] // Yeni: BackendRequest için de tag ve content ekliyoruz
pub enum BackendRequest {
    ListDir {
        path: String,
        recursive: bool,
        environment_id: Option<String>,
        active_environment_details: Option<Environment>,
        request_id: Option<String>,
    },
    ReadFile {
        path: String,
        environment_id: Option<String>,
        active_environment_details: Option<Environment>,
        request_id: Option<String>,
    },
    WriteFile {
        path: String,
        content: String,
        environment_id: Option<String>,
        active_environment_details: Option<Environment>,
        request_id: Option<String>,
    },
    CreateFile {
        path: String,
        environment_id: Option<String>,
        active_environment_details: Option<Environment>,
        request_id: Option<String>,
    },
    CreateDir {
        path: String,
        environment_id: Option<String>,
        active_environment_details: Option<Environment>,
        request_id: Option<String>,
        is_project_root: Option<bool>,
    },
    DeletePath {
        path: String,
        environment_id: Option<String>,
        active_environment_details: Option<Environment>,
        request_id: Option<String>,
    },
    RenamePath {
        old_path: String,
        new_path: String,
        environment_id: Option<String>,
        active_environment_details: Option<Environment>,
        request_id: Option<String>,
    },
    GetSuggestedProjectRoots {
        environment_id: Option<String>,
        active_environment_details: Option<Environment>,
        request_id: Option<String>,
    },
    ConnectSsh {
        #[serde(rename = "environmentId")]
        environment_id: String,
        active_environment_details: Environment,
        request_id: Option<String>,
    },
    GenerateSshKey {
        request_id: Option<String>,
    },
    // Veritabanı işlemleri
    GetEnvironments {
        request_id: Option<String>,
    },
    SaveEnvironment {
        environment: Environment,
        request_id: Option<String>,
    },
    DeleteEnvironment {
        id: String,
        request_id: Option<String>,
    },
    GetRecentProjects {
        request_id: Option<String>,
    },
    SaveRecentProject {
        id: String,
        name: String,
        path: String,
        environment_id: String,
        request_id: Option<String>,
    },
    DeleteRecentProject {
        id: String,
        request_id: Option<String>,
    },
    SftpListDir {
        path: String,
        #[serde(rename = "environmentId")]
        environment_id: String,
        active_environment_details: Environment,
        request_id: Option<String>,
    },
    SftpReadFile {
        path: String,
        #[serde(rename = "environmentId")]
        environment_id: String,
        active_environment_details: Environment,
        request_id: Option<String>,
    },
    SftpWriteFile {
        path: String,
        content: String,
        #[serde(rename = "environmentId")]
        environment_id: String,
        active_environment_details: Environment,
        request_id: Option<String>,
    },
    SftpCreateDir {
        path: String,
        #[serde(rename = "environmentId")]
        environment_id: String,
        active_environment_details: Environment,
        request_id: Option<String>,
    },
    SftpRemoveFile {
        path: String,
        #[serde(rename = "environmentId")]
        environment_id: String,
        active_environment_details: Environment,
        request_id: Option<String>,
    },
    SftpRemoveDir {
        path: String,
        #[serde(rename = "environmentId")]
        environment_id: String,
        active_environment_details: Environment,
        request_id: Option<String>,
    },
    SftpRename {
        old_path: String,
        new_path: String,
        #[serde(rename = "environmentId")]
        environment_id: String,
        active_environment_details: Environment,
        request_id: Option<String>,
    },
    SpawnTerminal {
        terminal_id: String,
        cwd: String,
        cols: u16,
        rows: u16,
        environment_id: Option<String>,
        active_environment_details: Option<Environment>,
        request_id: Option<String>,
    },
    TerminalInput {
        terminal_id: String,
        data: String,
    },
    ResizeTerminal {
        terminal_id: String,
        cols: u16,
        rows: u16,
    },
    CloseTerminal {
        terminal_id: String,
    },
    GetChatSessions {
        request_id: Option<String>,
    },
    SaveChatSession {
        session: super::db::ChatSessionRecord,
        request_id: Option<String>,
    },
    DeleteChatSession {
        id: String,
        request_id: Option<String>,
    },
    GetChatMessages {
        session_id: String,
        request_id: Option<String>,
    },
    SaveChatMessage {
        message: serde_json::Value,
        request_id: Option<String>,
    },
    DeleteChatMessage {
        id: String,
        request_id: Option<String>,
    },
    // Knowledge Base (Sub-Agent)
    InitKnowledgeBase {
        project_root: String,
        #[serde(rename = "environmentId")]
        environment_id: Option<String>,
        active_environment_details: Option<Environment>,
        request_id: Option<String>,
    },
    SaveKnowledge {
        project_root: String,
        topic: String,
        content: String,
        #[serde(rename = "environmentId")]
        environment_id: Option<String>,
        active_environment_details: Option<Environment>,
        request_id: Option<String>,
    },
    GetKnowledge {
        project_root: String,
        topic: String,
        #[serde(rename = "environmentId")]
        environment_id: Option<String>,
        active_environment_details: Option<Environment>,
        request_id: Option<String>,
    },
    ScrapeWeb {
        url: String,
        project_root: String,
        topic: String, // Which knowledge topic to save it to
        #[serde(rename = "environmentId")]
        environment_id: Option<String>,
        active_environment_details: Option<Environment>,
        request_id: Option<String>,
    },
    SearchWeb {
        query: String,
        project_root: String,
        #[serde(rename = "environmentId")]
        environment_id: Option<String>,
        active_environment_details: Option<Environment>,
        request_id: Option<String>,
    },
    RunCodeAgent {
        action: String,
        project_root: String,
        #[serde(rename = "environmentId")]
        environment_id: Option<String>,
        active_environment_details: Option<Environment>,
        request_id: Option<String>,
    },
    AiChatStream {
        model: serde_json::Value,
        profile: Option<serde_json::Value>,
        #[serde(rename = "chatHistory")]
        chat_history: Vec<serde_json::Value>,
        prompt: String,
        #[serde(rename = "mcpServers")]
        mcp_servers: Option<Vec<serde_json::Value>>,
        context: serde_json::Value,
        request_id: Option<String>,
    },
    StopAiGeneration {
        request_id: String,
    },
    TakeScreenshot {
        url: String,
        request_id: Option<String>,
    },
    ExportProject {
        project_root: String,
        request_id: Option<String>,
    },
    GetGitStatus {
        project_root: String,
        request_id: Option<String>,
    },
    GenerateCommitMessage {
        project_root: String,
        model: serde_json::Value,
        request_id: Option<String>,
    },
    GitCommitAndPush {
        project_root: String,
        message: String,
        request_id: Option<String>,
    },
    GitInit {
        project_root: String,
        request_id: Option<String>,
    },
    GitAddRemote {
        project_root: String,
        remote_url: String,
        request_id: Option<String>,
    },
    GitRemoveRemote {
        project_root: String,
        request_id: Option<String>,
    },
    GitPull {
        project_root: String,
        request_id: Option<String>,
    },
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload")] // New: This will serialize to { "type": "VariantName", "payload": { ... } }
pub enum BackendResponse {
    ListDirResponse {
        path: String,
        nodes: Vec<crate::filesystem::FileNode>,
        request_id: Option<String>,
    },
    ReadFileResponse {
        path: String,
        content: String,
        request_id: Option<String>,
    },
    WriteFileResponse {
        path: String,
        request_id: Option<String>,
    },
    CreateFileResponse {
        path: String,
        request_id: Option<String>,
    },
    CreateDirResponse {
        path: String,
        request_id: Option<String>,
    },
    DeletePathResponse {
        path: String,
        request_id: Option<String>,
    },
    RenamePathResponse {
        old_path: String,
        new_path: String,
        request_id: Option<String>,
    },
    Error {
        message: String,
        request_id: Option<String>,
    },
    SuggestedProjectRootsResponse {
        roots: Vec<super::filesystem::FileNode>,
        request_id: Option<String>,
    },
    ConnectSshResponse {
        #[serde(rename = "environmentId")]
        environment_id: String,
        status: String,
        message: Option<String>,
        request_id: Option<String>,
    },
    GenerateSshKeyResponse {
        private_key_pem: String,
        public_key_openssh: String,
        request_id: Option<String>,
    },
    GetEnvironmentsResponse {
        environments: Vec<Environment>,
        request_id: Option<String>,
    },
    SaveEnvironmentResponse {
        request_id: Option<String>,
    },
    DeleteEnvironmentResponse {
        request_id: Option<String>,
    },
    GetRecentProjectsResponse {
        projects: Vec<super::db::ProjectRecord>,
        request_id: Option<String>,
    },
    SaveRecentProjectResponse {
        request_id: Option<String>,
    },
    DeleteRecentProjectResponse {
        request_id: Option<String>,
    },
    SftpListDirResponse {
        path: String,
        nodes: Vec<super::filesystem::FileNode>,
        request_id: Option<String>,
    },
    SftpReadFileResponse {
        path: String,
        content: String,
        request_id: Option<String>,
    },
    SftpWriteFileResponse {
        path: String,
        request_id: Option<String>,
    },
    SftpCreateDirResponse {
        path: String,
        request_id: Option<String>,
    },
    SftpRemoveFileResponse {
        path: String,
        request_id: Option<String>,
    },
    SftpRemoveDirResponse {
        path: String,
        request_id: Option<String>,
    },
    SftpRenameResponse {
        old_path: String,
        new_path: String,
        request_id: Option<String>,
    },
    SpawnTerminalResponse {
        terminal_id: String,
        request_id: Option<String>,
    },
    TerminalOutput {
        terminal_id: String,
        data: String,
    },
    TerminalClosed {
        terminal_id: String,
    },
    GetChatSessionsResponse {
        sessions: Vec<super::db::ChatSessionRecord>,
        request_id: Option<String>,
    },
    SaveChatSessionResponse {
        request_id: Option<String>,
    },
    DeleteChatSessionResponse {
        request_id: Option<String>,
    },
    GetChatMessagesResponse {
        messages: Vec<super::db::ChatMessageRecord>,
        request_id: Option<String>,
    },
    SaveChatMessageResponse {
        request_id: Option<String>,
    },
    DeleteChatMessageResponse {
        request_id: Option<String>,
    },
    AiChatStreamResponse {
        message_id: String,
        chunk: Option<String>,
        done: bool,
        request_id: Option<String>,
    },
    // Knowledge Base Responses
    InitKnowledgeBaseResponse {
        success: bool,
        request_id: Option<String>,
    },
    SaveKnowledgeResponse {
        success: bool,
        request_id: Option<String>,
    },
    GetKnowledgeResponse {
        content: String,
        request_id: Option<String>,
    },
    ScrapeWebResponse {
        success: bool,
        message: String,
        request_id: Option<String>,
    },
    SearchWebResponse {
        success: bool,
        message: String,
        topic: Option<String>,
        request_id: Option<String>,
    },
    RunCodeAgentResponse {
        success: bool,
        message: String,
        action: String,
        request_id: Option<String>,
    },
    TakeScreenshotResponse {
        url: String,
        base64: String,
        request_id: Option<String>,
    },
    ExportProjectResponse {
        success: bool,
        zip_path: Option<String>,
        error: Option<String>,
        request_id: Option<String>,
    },
    GetGitStatusResponse {
        is_repo: bool,
        branch: String,
        files: Vec<serde_json::Value>,
        remote_url: Option<String>,
        request_id: Option<String>,
    },
    GenerateCommitMessageResponse {
        message: String,
        request_id: Option<String>,
    },
    GitCommitAndPushResponse {
        success: bool,
        output: String,
        request_id: Option<String>,
    },
    // Git Responses
    GitInitResponse {
        success: bool,
        error: Option<String>,
        request_id: Option<String>,
    },
    GitAddRemoteResponse {
        success: bool,
        error: Option<String>,
        request_id: Option<String>,
    },
    GitRemoveRemoteResponse {
        success: bool,
        error: Option<String>,
        request_id: Option<String>,
    },
    GitPullResponse {
        success: bool,
        output: String,
        request_id: Option<String>,
    },
    TelemetryUpdate {
        context_window: usize,
        system_tokens: usize,
        knowledge_tokens: usize,
        history_tokens: usize,
        file_tokens: usize,
        free_tokens: usize,
        active_model: Option<String>,
    },
}
