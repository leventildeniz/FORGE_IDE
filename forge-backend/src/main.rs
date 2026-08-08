use std::sync::atomic::AtomicBool;
pub static DEBUG_LOG: AtomicBool = AtomicBool::new(false);

#[macro_export]
macro_rules! debug_log {
    ($($arg:tt)*) => {
        if $crate::DEBUG_LOG.load(std::sync::atomic::Ordering::Relaxed) {
            println!($($arg)*);
        }
    };
}

use futures_util::{SinkExt, StreamExt};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::sync::{Mutex, mpsc};
use tokio::time::{Duration, interval};
use tokio_util::sync::CancellationToken;
use warp::Filter;
use warp::ws::{Message, WebSocket};

mod ai_provider;
mod db;
mod filesystem;
mod git;
mod knowledge;
mod mcp_client;
mod messages;
mod ssh;
mod terminal;

use crate::ssh::ClientHandler;
use russh::client::Handle;
use russh_sftp::client::SftpSession;

type Clients = Arc<Mutex<HashMap<usize, ClientSession>>>;

// Client session state
pub struct ClientSession {
    pub sender: mpsc::UnboundedSender<Message>,
    pub active_env_id: Option<String>,
    pub terminals: HashMap<String, Box<terminal::TerminalHandle>>,
    pub ssh_session: Option<SshSession>,
    pub active_ai_tasks: Arc<Mutex<HashMap<String, CancellationToken>>>,
}

pub struct SshSession {
    pub connection: Arc<Mutex<Handle<ClientHandler>>>,
    pub sftp_client: Arc<SftpSession>,
}

#[tokio::main]
async fn main() {
    // Initialize the database
    if let Err(e) = db::init_db() {
        eprintln!("Failed to initialize database: {}", e);
    }

    let clients = Clients::default();

    let ws_route = warp::path("ws")
        .and(warp::ws())
        .and(with_clients(clients.clone()))
        .map(|ws: warp::ws::Ws, clients| {
            ws.on_upgrade(move |socket| client_connected(socket, clients))
        });

    let routes = ws_route.with(warp::cors().allow_any_origin());

    println!("Forge Backend listening on ws://0.0.0.0:3030/ws");
    println!("Type 'cargo run --release' for smaller binaries.");
    warp::serve(routes).run(([0, 0, 0, 0], 3030)).await;
}

fn with_clients(
    clients: Clients,
) -> impl Filter<Extract = (Clients,), Error = std::convert::Infallible> + Clone {
    warp::any().map(move || clients.clone())
}

async fn client_connected(ws: WebSocket, clients: Clients) {
    let (mut client_ws_tx, mut client_ws_rx) = ws.split();
    let (tx, mut rx) = mpsc::unbounded_channel();

    let my_id = rand::random::<usize>();
    clients.lock().await.insert(
        my_id,
        ClientSession {
            sender: tx.clone(),
            active_env_id: None,
            terminals: HashMap::new(),
            ssh_session: None,
            active_ai_tasks: Arc::new(Mutex::new(HashMap::new())),
        },
    );

    crate::debug_log!("Client connected: {}", my_id);

    // Keep-alive ping interval
    tokio::task::spawn(async move {
        let mut ping_interval = interval(Duration::from_secs(30));

        loop {
            ping_interval.tick().await;
            // Send ping message (We can just send a custom ping or rely on warp's internal)
        }
    });

    // Forward messages from mpsc to the websocket
    tokio::task::spawn(async move {
        while let Some(message) = rx.recv().await {
            if let Err(e) = client_ws_tx.send(message).await {
                eprintln!("Error sending websocket message: {}", e);
                break;
            }
        }
    });

    // Handle incoming messages
    while let Some(result) = client_ws_rx.next().await {
        let msg = match result {
            Ok(msg) => msg,
            Err(e) => {
                crate::debug_log!("WebSocket error: {}", e);
                break;
            }
        };

        if msg.is_text() {
            let text_msg = msg.to_str().unwrap_or_default();
            match serde_json::from_str::<messages::BackendRequest>(text_msg) {
                Ok(request) => {
                    let response_opt = handle_websocket_message(request, my_id, &clients).await;
                    if let Some(response) = response_opt {
                        let json_response = serde_json::to_string(&response).unwrap_or_else(|e| {
                            serde_json::json!({ "type": "Error", "payload": { "message": format!("Failed to serialize response: {}", e) } }).to_string()
                        });
                        let mut clients_guard = clients.lock().await;
                        if let Some(client_session) = clients_guard.get_mut(&my_id) {
                            let _ = client_session.sender.send(Message::text(json_response));
                        }
                    }
                }
                Err(e) => {
                    eprintln!("Failed to parse message: {} - {}", e, text_msg);
                    let err_response = messages::BackendResponse::Error {
                        message: format!("Failed to parse message: {}", e),
                        request_id: None,
                    };
                    let json_response = serde_json::to_string(&err_response).unwrap_or_default();
                    let mut clients_guard = clients.lock().await;
                    if let Some(client_session) = clients_guard.get_mut(&my_id) {
                        let _ = client_session.sender.send(Message::text(json_response));
                    }
                }
            }
        }
    }

    // Client disconnected
    clients.lock().await.remove(&my_id);
    crate::debug_log!("Client disconnected: {}", my_id);
}

// Handles incoming WebSocket text messages as BackendRequests and returns BackendResponses
use futures::Future;
use std::pin::Pin;

fn sftp_list_dir_recursive(
    sftp: Arc<SftpSession>,
    path: String,
) -> Pin<Box<dyn Future<Output = Result<Vec<crate::filesystem::FileNode>, String>> + Send>> {
    Box::pin(async move {
        match sftp.read_dir(path.clone()).await {
            Ok(read_dir) => {
                let mut nodes = Vec::new();
                for entry in read_dir {
                    let file_name = entry.file_name().to_string();

                    if file_name == "."
                        || file_name == ".."
                        || file_name == ".git"
                        || file_name == "node_modules"
                        || file_name == "target"
                        || file_name == ".next"
                        || file_name == "dist"
                        || file_name == ".forge_memory"
                    {
                        continue;
                    }

                    let metadata = entry.metadata();
                    let is_dir = metadata.is_dir();
                    let entry_path = format!("{}/{}", path.trim_end_matches('/'), file_name);

                    let mut children = None;
                    if is_dir {
                        if let Ok(child_nodes) =
                            sftp_list_dir_recursive(sftp.clone(), entry_path.clone()).await
                        {
                            children = Some(child_nodes);
                        } else {
                            children = Some(Vec::new())
                        }
                    }

                    nodes.push(crate::filesystem::FileNode {
                        name: file_name,
                        path: entry_path,
                        is_dir,
                        children,
                        is_file: !is_dir,
                        size: 0,
                        content: None,
                    });
                }

                nodes.sort_by(|a, b| {
                    if a.is_dir && !b.is_dir {
                        std::cmp::Ordering::Less
                    } else if !a.is_dir && b.is_dir {
                        std::cmp::Ordering::Greater
                    } else {
                        a.name.cmp(&b.name)
                    }
                });

                Ok(nodes)
            }
            Err(e) => Err(format!("SFTP read_dir failed: {}", e)),
        }
    })
}

async fn handle_websocket_message(
    request: messages::BackendRequest,
    client_id: usize,
    clients: &Clients,
) -> Option<messages::BackendResponse> {
    let mut clients_guard = clients.lock().await;
    let client_session = clients_guard.get_mut(&client_id)?;

    Some(match request {
        messages::BackendRequest::ListDir {
            path,
            recursive,
            environment_id,
            active_environment_details,
            request_id,
        } => match filesystem::list_dir_contents(
            &path,
            recursive,
            environment_id,
            active_environment_details,
        )
        .await
        {
            Ok(nodes) => messages::BackendResponse::ListDirResponse {
                path,
                nodes,
                request_id,
            },
            Err(e) => {
                eprintln!("Error listing directory {}: {}", path, e);
                messages::BackendResponse::Error {
                    message: e,
                    request_id,
                }
            }
        },
        messages::BackendRequest::ReadFile {
            path,
            environment_id,
            active_environment_details,
            request_id,
        } => match filesystem::read_file_content(&path, environment_id, active_environment_details)
            .await
        {
            Ok(content) => messages::BackendResponse::ReadFileResponse {
                path,
                content,
                request_id,
            },
            Err(e) => {
                eprintln!("Error reading file {}: {}", path, e);
                messages::BackendResponse::Error {
                    message: e,
                    request_id,
                }
            }
        },
        messages::BackendRequest::WriteFile {
            path,
            content,
            environment_id,
            active_environment_details,
            request_id,
        } => match filesystem::write_file_content(
            &path,
            &content,
            environment_id,
            active_environment_details,
        )
        .await
        {
            Ok(_) => messages::BackendResponse::WriteFileResponse { path, request_id },
            Err(e) => {
                eprintln!("Error writing file {}: {}", path, e);
                messages::BackendResponse::Error {
                    message: e,
                    request_id,
                }
            }
        },
        messages::BackendRequest::CreateFile {
            path,
            environment_id,
            active_environment_details,
            request_id,
        } => match filesystem::create_file(&path, environment_id, active_environment_details).await
        {
            Ok(_) => messages::BackendResponse::CreateFileResponse { path, request_id },
            Err(e) => {
                eprintln!("Error creating file {}: {}", path, e);
                messages::BackendResponse::Error {
                    message: e,
                    request_id,
                }
            }
        },
        messages::BackendRequest::CreateDir {
            path,
            environment_id,
            active_environment_details,
            request_id,
            is_project_root: _,
        } => match filesystem::create_dir(&path, false, environment_id, active_environment_details)
            .await
        {
            Ok(_) => messages::BackendResponse::CreateDirResponse { path, request_id },
            Err(e) => {
                eprintln!("Error creating directory {}: {}", path, e);
                messages::BackendResponse::Error {
                    message: e,
                    request_id,
                }
            }
        },
        messages::BackendRequest::DeletePath {
            path,
            environment_id,
            active_environment_details,
            request_id,
        } => match filesystem::delete_path(&path, environment_id, active_environment_details).await
        {
            Ok(_) => messages::BackendResponse::DeletePathResponse { path, request_id },
            Err(e) => {
                eprintln!("Error deleting path {}: {}", path, e);
                messages::BackendResponse::Error {
                    message: e,
                    request_id,
                }
            }
        },
        messages::BackendRequest::RenamePath {
            old_path,
            new_path,
            environment_id,
            active_environment_details,
            request_id,
        } => match filesystem::rename_path(
            &old_path,
            &new_path,
            environment_id,
            active_environment_details,
        )
        .await
        {
            Ok(_) => messages::BackendResponse::RenamePathResponse {
                old_path,
                new_path,
                request_id,
            },
            Err(e) => {
                eprintln!("Error renaming path {} to {}: {}", old_path, new_path, e);
                messages::BackendResponse::Error {
                    message: e,
                    request_id,
                }
            }
        },
        messages::BackendRequest::GetSuggestedProjectRoots {
            environment_id,
            active_environment_details,
            request_id,
        } => match filesystem::get_suggested_project_roots(
            environment_id,
            active_environment_details,
        )
        .await
        {
            Ok(roots) => {
                messages::BackendResponse::SuggestedProjectRootsResponse { roots, request_id }
            }
            Err(e) => messages::BackendResponse::Error {
                message: e,
                request_id,
            },
        },
        messages::BackendRequest::ConnectSsh {
            environment_id,
            active_environment_details,
            request_id,
        } => {
            let host = active_environment_details.host.clone().unwrap_or_default();
            let port = active_environment_details.port.unwrap_or(22);
            let username = active_environment_details
                .username
                .clone()
                .unwrap_or_default();

            let private_key_pem = active_environment_details
                .private_key_path
                .clone()
                .unwrap_or_default();

            match ssh::connect_and_authenticate(&host, port, username, private_key_pem).await {
                Ok(mut conn_handle) => match ssh::start_sftp_client(&mut conn_handle).await {
                    Ok(sftp_client) => {
                        crate::debug_log!(
                            "Successfully connected to SSH and initialized SFTP for {}",
                            host
                        );
                        client_session.ssh_session = Some(SshSession {
                            connection: Arc::new(Mutex::new(conn_handle)),
                            sftp_client: Arc::new(sftp_client),
                        });
                        messages::BackendResponse::ConnectSshResponse {
                            environment_id,
                            status: "connected".to_string(),
                            message: Some("Connected".to_string()),
                            request_id,
                        }
                    }
                    Err(e) => messages::BackendResponse::Error {
                        message: format!("Failed to start sftp: {}", e),
                        request_id,
                    },
                },
                Err(e) => {
                    eprintln!("Error connecting to SSH: {}", e);
                    messages::BackendResponse::Error {
                        message: format!("Failed to connect to SSH: {}", e),
                        request_id,
                    }
                }
            }
        }
        messages::BackendRequest::GenerateSshKey { request_id } => {
            match ssh::generate_ssh_key_pem() {
                Ok((private_key_pem, public_key_openssh)) => {
                    messages::BackendResponse::GenerateSshKeyResponse {
                        private_key_pem,
                        public_key_openssh,
                        request_id,
                    }
                }
                Err(e) => messages::BackendResponse::Error {
                    message: format!("Failed to generate SSH key: {}", e),
                    request_id,
                },
            }
        }
        messages::BackendRequest::GetEnvironments { request_id } => match db::get_environments() {
            Ok(envs) => messages::BackendResponse::GetEnvironmentsResponse {
                environments: envs,
                request_id,
            },
            Err(e) => messages::BackendResponse::Error {
                message: format!("Failed to fetch environments: {}", e),
                request_id,
            },
        },
        messages::BackendRequest::SaveEnvironment {
            environment,
            request_id,
        } => match db::save_environment(&environment) {
            Ok(_) => messages::BackendResponse::SaveEnvironmentResponse { request_id },
            Err(e) => messages::BackendResponse::Error {
                message: format!("Failed to save environment: {}", e),
                request_id,
            },
        },
        messages::BackendRequest::DeleteEnvironment { id, request_id } => {
            match db::delete_environment(&id) {
                Ok(_) => messages::BackendResponse::DeleteEnvironmentResponse { request_id },
                Err(e) => messages::BackendResponse::Error {
                    message: format!("Failed to delete environment: {}", e),
                    request_id,
                },
            }
        }
        messages::BackendRequest::GetRecentProjects { request_id } => {
            match db::get_recent_projects() {
                Ok(projects) => messages::BackendResponse::GetRecentProjectsResponse {
                    projects,
                    request_id,
                },
                Err(e) => messages::BackendResponse::Error {
                    message: format!("Failed to fetch recent projects: {}", e),
                    request_id,
                },
            }
        }
        messages::BackendRequest::SaveRecentProject {
            id,
            name,
            path,
            environment_id,
            request_id,
        } => {
            let proj = db::ProjectRecord {
                id,
                name,
                path,
                environment_id,
                opened_at: std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_millis() as i64,
            };
            match db::save_recent_project(&proj) {
                Ok(_) => messages::BackendResponse::SaveRecentProjectResponse { request_id },
                Err(e) => messages::BackendResponse::Error {
                    message: format!("Failed to save recent project: {}", e),
                    request_id,
                },
            }
        }
        messages::BackendRequest::DeleteRecentProject { id, request_id } => {
            match db::delete_recent_project(&id) {
                Ok(_) => messages::BackendResponse::DeleteRecentProjectResponse { request_id },
                Err(e) => messages::BackendResponse::Error {
                    message: format!("Failed to delete recent project: {}", e),
                    request_id,
                },
            }
        }
        messages::BackendRequest::SftpListDir {
            path,
            environment_id: _,
            active_environment_details: _,
            request_id,
        } => {
            if let Some(ssh_session) = &mut client_session.ssh_session {
                match sftp_list_dir_recursive(ssh_session.sftp_client.clone(), path.clone()).await {
                    Ok(nodes) => messages::BackendResponse::SftpListDirResponse {
                        path,
                        nodes,
                        request_id,
                    },
                    Err(e) => messages::BackendResponse::Error {
                        message: format!("SFTP list dir failed: {}", e),
                        request_id,
                    },
                }
            } else {
                messages::BackendResponse::Error {
                    message: "SSH session not established.".to_string(),
                    request_id,
                }
            }
        }
        messages::BackendRequest::SftpReadFile {
            path,
            environment_id: _,
            active_environment_details: _,
            request_id,
        } => {
            if let Some(ssh_session) = &mut client_session.ssh_session {
                use tokio::io::AsyncReadExt;
                match ssh_session.sftp_client.open(path.clone()).await {
                    Ok(mut file) => {
                        let mut content_bytes_vec = Vec::new();
                        match file.read_to_end(&mut content_bytes_vec).await {
                            Ok(_) => {
                                let content =
                                    String::from_utf8_lossy(&content_bytes_vec).into_owned();
                                messages::BackendResponse::SftpReadFileResponse {
                                    path,
                                    content,
                                    request_id,
                                }
                            }
                            Err(e) => messages::BackendResponse::Error {
                                message: format!("SFTP read file contents failed: {}", e),
                                request_id,
                            },
                        }
                    }
                    Err(e) => messages::BackendResponse::Error {
                        message: format!("SFTP open file failed: {}", e),
                        request_id,
                    },
                }
            } else {
                messages::BackendResponse::Error {
                    message: "SSH session not established.".to_string(),
                    request_id,
                }
            }
        }
        messages::BackendRequest::SftpWriteFile {
            path,
            content,
            environment_id: _,
            active_environment_details: _,
            request_id,
        } => {
            if let Some(ssh_session) = &mut client_session.ssh_session {
                if let Some(last_slash) = path.rfind('/') {
                    let parent_dir = &path[..last_slash];
                    if !parent_dir.is_empty() {
                        let _ = ssh_session
                            .sftp_client
                            .create_dir(parent_dir.to_string())
                            .await;
                        let mut current_path = String::new();
                        for part in parent_dir.split('/') {
                            if part.is_empty() && current_path.is_empty() {
                                current_path.push('/');
                                continue;
                            }
                            if !current_path.ends_with('/') && !current_path.is_empty() {
                                current_path.push('/');
                            }
                            current_path.push_str(part);
                            let _ = ssh_session
                                .sftp_client
                                .create_dir(current_path.clone())
                                .await;
                        }
                    }
                }

                use russh_sftp::protocol::OpenFlags;
                use tokio::io::AsyncWriteExt;
                let flags = OpenFlags::WRITE | OpenFlags::CREATE | OpenFlags::TRUNCATE;
                match ssh_session
                    .sftp_client
                    .open_with_flags(path.clone(), flags)
                    .await
                {
                    Ok(mut file) => match file.write_all(content.as_bytes()).await {
                        Ok(_) => {
                            messages::BackendResponse::SftpWriteFileResponse { path, request_id }
                        }
                        Err(e) => messages::BackendResponse::Error {
                            message: format!("SFTP write data failed: {}", e),
                            request_id,
                        },
                    },
                    Err(e) => messages::BackendResponse::Error {
                        message: format!("SFTP open file failed: {}", e),
                        request_id,
                    },
                }
            } else {
                messages::BackendResponse::Error {
                    message: "SSH session not established.".to_string(),
                    request_id,
                }
            }
        }
        messages::BackendRequest::SftpCreateDir {
            path,
            environment_id: _,
            active_environment_details: _,
            request_id,
        } => {
            if let Some(ssh_session) = &mut client_session.ssh_session {
                match ssh_session.sftp_client.create_dir(path.clone()).await {
                    Ok(_) => messages::BackendResponse::SftpCreateDirResponse { path, request_id },
                    Err(e) => messages::BackendResponse::Error {
                        message: format!("SFTP create dir failed: {}", e),
                        request_id,
                    },
                }
            } else {
                messages::BackendResponse::Error {
                    message: "SSH session not established.".to_string(),
                    request_id,
                }
            }
        }
        messages::BackendRequest::SftpRemoveFile {
            path,
            environment_id: _,
            active_environment_details: _,
            request_id,
        } => {
            if let Some(ssh_session) = &mut client_session.ssh_session {
                match ssh_session.sftp_client.remove_file(path.clone()).await {
                    Ok(_) => messages::BackendResponse::SftpRemoveFileResponse { path, request_id },
                    Err(e) => messages::BackendResponse::Error {
                        message: format!("SFTP remove file failed: {}", e),
                        request_id,
                    },
                }
            } else {
                messages::BackendResponse::Error {
                    message: "SSH session not established.".to_string(),
                    request_id,
                }
            }
        }
        messages::BackendRequest::SftpRemoveDir {
            path,
            environment_id: _,
            active_environment_details: _,
            request_id,
        } => {
            if let Some(ssh_session) = &mut client_session.ssh_session {
                match ssh_session.sftp_client.remove_dir(path.clone()).await {
                    Ok(_) => messages::BackendResponse::SftpRemoveDirResponse { path, request_id },
                    Err(e) => messages::BackendResponse::Error {
                        message: format!("SFTP remove dir failed: {}", e),
                        request_id,
                    },
                }
            } else {
                messages::BackendResponse::Error {
                    message: "SSH session not established.".to_string(),
                    request_id,
                }
            }
        }
        messages::BackendRequest::SftpRename {
            old_path,
            new_path,
            environment_id: _,
            active_environment_details: _,
            request_id,
        } => {
            if let Some(ssh_session) = &mut client_session.ssh_session {
                match ssh_session
                    .sftp_client
                    .rename(old_path.clone(), new_path.clone())
                    .await
                {
                    Ok(_) => messages::BackendResponse::SftpRenameResponse {
                        old_path,
                        new_path,
                        request_id,
                    },
                    Err(e) => messages::BackendResponse::Error {
                        message: format!("SFTP rename failed: {}", e),
                        request_id,
                    },
                }
            } else {
                messages::BackendResponse::Error {
                    message: "SSH session not established.".to_string(),
                    request_id,
                }
            }
        }
        messages::BackendRequest::SpawnTerminal {
            terminal_id,
            cwd,
            cols: _,
            rows: _,
            environment_id: _,
            active_environment_details,
            request_id,
        } => {
            let is_ssh = active_environment_details
                .as_ref()
                .map(|e| e.kind == "ssh")
                .unwrap_or(false);

            if is_ssh {
                let conn_handle = {
                    if let Some(ssh_session) = &client_session.ssh_session {
                        Some(ssh_session.connection.clone())
                    } else {
                        None
                    }
                };

                if let Some(conn) = conn_handle {
                    let handle = conn.lock().await;
                    match handle.channel_open_session().await {
                        Ok(channel) => {
                            if let Err(e) =
                                channel.request_pty(true, "xterm", 80, 24, 0, 0, &[]).await
                            {
                                messages::BackendResponse::Error {
                                    message: format!("SSH PTY request failed: {}", e),
                                    request_id,
                                }
                            } else if let Err(e) = channel.request_shell(true).await {
                                messages::BackendResponse::Error {
                                    message: format!("SSH shell request failed: {}", e),
                                    request_id,
                                }
                            } else {
                                let sender = client_session.sender.clone();
                                let term_handle = terminal::spawn_ssh_terminal(
                                    terminal_id.clone(),
                                    channel,
                                    sender,
                                );
                                client_session
                                    .terminals
                                    .insert(terminal_id.clone(), Box::new(term_handle));

                                messages::BackendResponse::SpawnTerminalResponse {
                                    terminal_id,
                                    request_id,
                                }
                            }
                        }
                        Err(e) => messages::BackendResponse::Error {
                            message: format!("Failed to open SSH channel: {}", e),
                            request_id,
                        },
                    }
                } else {
                    messages::BackendResponse::Error {
                        message: "SSH session not established.".to_string(),
                        request_id,
                    }
                }
            } else {
                let is_wsl = active_environment_details
                    .as_ref()
                    .map(|e| e.kind == "wsl")
                    .unwrap_or(false);

                let sender = client_session.sender.clone();
                match terminal::spawn_local_terminal(
                    terminal_id.clone(),
                    cwd,
                    80,
                    24,
                    is_wsl,
                    sender,
                    None,
                ) {
                    Ok(handle) => {
                        client_session
                            .terminals
                            .insert(terminal_id.clone(), Box::new(handle));

                        messages::BackendResponse::SpawnTerminalResponse {
                            terminal_id,
                            request_id,
                        }
                    }
                    Err(e) => messages::BackendResponse::Error {
                        message: format!("Failed to spawn local terminal: {}", e),
                        request_id,
                    },
                }
            }
        }
        messages::BackendRequest::TerminalInput { terminal_id, data } => {
            if let Some(term) = client_session.terminals.get_mut(&terminal_id) {
                term.write_input(data);
            }
            return None;
        }
        messages::BackendRequest::ResizeTerminal {
            terminal_id,
            cols,
            rows,
        } => {
            if let Some(term) = client_session.terminals.get_mut(&terminal_id) {
                term.resize(cols, rows);
            }
            return None;
        }
        messages::BackendRequest::CloseTerminal { terminal_id } => {
            client_session.terminals.remove(&terminal_id);
            return None;
        }
        messages::BackendRequest::GetChatSessions {
            project_root,
            request_id,
        } => match db::get_chat_sessions(&project_root) {
            Ok(sessions) => messages::BackendResponse::GetChatSessionsResponse {
                sessions,
                request_id,
            },
            Err(e) => messages::BackendResponse::Error {
                message: format!("Failed to fetch chat sessions: {}", e),
                request_id,
            },
        },
        messages::BackendRequest::SaveChatSession {
            session,
            project_root,
            request_id,
        } => match db::save_chat_session(&session, &project_root) {
            Ok(_) => messages::BackendResponse::SaveChatSessionResponse { request_id },
            Err(e) => messages::BackendResponse::Error {
                message: format!("Failed to save chat session: {}", e),
                request_id,
            },
        },
        messages::BackendRequest::DeleteChatSession { id, request_id } => {
            match db::delete_chat_session(&id) {
                Ok(_) => messages::BackendResponse::DeleteChatSessionResponse { request_id },
                Err(e) => messages::BackendResponse::Error {
                    message: format!("Failed to delete chat session: {}", e),
                    request_id,
                },
            }
        }
        messages::BackendRequest::GetChatMessages {
            session_id,
            request_id,
        } => match db::get_chat_messages(&session_id) {
            Ok(messages) => messages::BackendResponse::GetChatMessagesResponse {
                messages,
                request_id,
            },
            Err(e) => messages::BackendResponse::Error {
                message: format!("Failed to fetch chat messages: {}", e),
                request_id,
            },
        },
        messages::BackendRequest::SaveChatMessage {
            message,
            request_id,
        } => {
            if let Ok(record) = serde_json::from_value::<db::ChatMessageRecord>(message.clone()) {
                match db::save_chat_message(&record) {
                    Ok(_) => messages::BackendResponse::SaveChatMessageResponse { request_id },
                    Err(e) => messages::BackendResponse::Error {
                        message: format!("Failed to save chat message: {}", e),
                        request_id,
                    },
                }
            } else {
                messages::BackendResponse::Error {
                    message: "Failed to parse chat message".to_string(),
                    request_id,
                }
            }
        }
        messages::BackendRequest::DeleteChatMessage { id, request_id } => {
            match db::delete_chat_message(&id) {
                Ok(_) => messages::BackendResponse::DeleteChatMessageResponse { request_id },
                Err(e) => messages::BackendResponse::Error {
                    message: format!("Failed to delete chat message: {}", e),
                    request_id,
                },
            }
        }
        messages::BackendRequest::InitKnowledgeBase {
            project_root,
            environment_id,
            active_environment_details,
            request_id,
        } => {
            let is_ssh = active_environment_details
                .as_ref()
                .map(|e| e.kind == "ssh")
                .unwrap_or(false);

            if is_ssh {
                let conn_handle = {
                    if let Some(ssh_session) = &client_session.ssh_session {
                        Some(ssh_session.connection.clone())
                    } else {
                        None
                    }
                };

                if let Some(conn) = conn_handle {
                    let handle = conn.lock().await;
                    if let Ok(mut channel) = handle.channel_open_session().await {
                        let base = project_root.trim_end_matches('/');
                        let cmd = format!(
                            "mkdir -p '{0}/.forge/knowledge' && \
                            if [ ! -f '{0}/.forge/knowledge/context.md' ]; then echo \"# Project Context\n\nThis file contains the high-level context, goals, and state of the project. It is automatically loaded into the AI's memory.\n\" > '{0}/.forge/knowledge/context.md'; fi && \
                            if [ ! -f '{0}/.forge/knowledge/decisions.md' ]; then echo \"# Decision Log\n\nThis file tracks critical architectural decisions and rules for this project.\n\" > '{0}/.forge/knowledge/decisions.md'; fi",
                            base
                        );
                        let _ = channel.exec(true, cmd).await;
                        while let Some(msg) = channel.wait().await {
                            match msg {
                                russh::ChannelMsg::Eof
                                | russh::ChannelMsg::ExitStatus { .. }
                                | russh::ChannelMsg::Close => break,
                                _ => {}
                            }
                        }
                    }
                    messages::BackendResponse::InitKnowledgeBaseResponse {
                        success: true,
                        request_id,
                    }
                } else {
                    messages::BackendResponse::Error {
                        message: "SSH session not established.".to_string(),
                        request_id,
                    }
                }
            } else {
                let target_path = knowledge::get_knowledge_base_path(&project_root, None);
                let _ = filesystem::create_dir(
                    &target_path,
                    false,
                    environment_id.clone(),
                    active_environment_details.clone(),
                )
                .await;

                let context_path = format!("{}/context.md", target_path);
                if filesystem::read_file_content(
                    &context_path,
                    environment_id.clone(),
                    active_environment_details.clone(),
                )
                .await
                .is_err()
                {
                    let _ = filesystem::write_file_content(
                        &context_path,
                        "# Project Context\n\nThis file contains the high-level context, goals, and state of the project. It is automatically loaded into the AI's memory.\n",
                        environment_id.clone(),
                        active_environment_details.clone()
                    ).await;
                }

                let decisions_path = format!("{}/decisions.md", target_path);
                if filesystem::read_file_content(
                    &decisions_path,
                    environment_id.clone(),
                    active_environment_details.clone(),
                )
                .await
                .is_err()
                {
                    let _ = filesystem::write_file_content(
                        &decisions_path,
                        "# Decision Log\n\nThis file tracks critical architectural decisions and rules for this project.\n",
                        environment_id.clone(),
                        active_environment_details.clone()
                    ).await;
                }

                messages::BackendResponse::InitKnowledgeBaseResponse {
                    success: true,
                    request_id,
                }
            }
        }
        messages::BackendRequest::SaveKnowledge {
            project_root,
            topic,
            content,
            environment_id,
            active_environment_details,
            request_id,
        } => {
            let is_ssh = active_environment_details
                .as_ref()
                .map(|e| e.kind == "ssh")
                .unwrap_or(false);

            if is_ssh {
                let conn_handle = {
                    if let Some(ssh_session) = &client_session.ssh_session {
                        Some(ssh_session.connection.clone())
                    } else {
                        None
                    }
                };
                let sftp = {
                    if let Some(ssh_session) = &client_session.ssh_session {
                        Some(ssh_session.sftp_client.clone())
                    } else {
                        None
                    }
                };
                if let (Some(conn), Some(sftp)) = (conn_handle, sftp) {
                    // Pre-create the directory safely via shell
                    let handle = conn.lock().await;
                    if let Ok(mut channel) = handle.channel_open_session().await {
                        let cmd = format!(
                            "mkdir -p '{}/.forge/knowledge'",
                            project_root.trim_end_matches('/')
                        );
                        let _ = channel.exec(true, cmd).await;
                        while let Some(msg) = channel.wait().await {
                            match msg {
                                russh::ChannelMsg::Eof
                                | russh::ChannelMsg::ExitStatus { .. }
                                | russh::ChannelMsg::Close => break,
                                _ => {}
                            }
                        }
                    }

                    let target_path =
                        knowledge::get_knowledge_base_path(&project_root, Some(&topic));

                    match sftp.create(target_path.clone()).await {
                        Ok(mut file) => {
                            if let Err(e) = file.write_all(content.as_bytes()).await {
                                messages::BackendResponse::Error {
                                    message: format!("SFTP save knowledge failed: {}", e),
                                    request_id,
                                }
                            } else {
                                messages::BackendResponse::SaveKnowledgeResponse {
                                    success: true,
                                    request_id,
                                }
                            }
                        }
                        Err(e) => messages::BackendResponse::Error {
                            message: format!("SFTP file creation failed: {}", e),
                            request_id,
                        },
                    }
                } else {
                    messages::BackendResponse::Error {
                        message: "SSH session not established.".to_string(),
                        request_id,
                    }
                }
            } else {
                let target_path = knowledge::get_knowledge_base_path(&project_root, Some(&topic));

                match filesystem::write_file_content(
                    &target_path,
                    &content,
                    environment_id,
                    active_environment_details,
                )
                .await
                {
                    Ok(_) => messages::BackendResponse::SaveKnowledgeResponse {
                        success: true,
                        request_id,
                    },
                    Err(e) => messages::BackendResponse::Error {
                        message: e,
                        request_id,
                    },
                }
            }
        }
        messages::BackendRequest::GetKnowledge {
            project_root,
            topic,
            environment_id,
            active_environment_details,
            request_id,
        } => {
            let is_ssh = active_environment_details
                .as_ref()
                .map(|e| e.kind == "ssh")
                .unwrap_or(false);

            if is_ssh {
                let sftp = {
                    if true {
                        if let Some(ssh_session) = &client_session.ssh_session {
                            Some(ssh_session.sftp_client.clone())
                        } else {
                            None
                        }
                    } else {
                        None
                    }
                };
                if let Some(sftp) = sftp {
                    let target_path =
                        knowledge::get_knowledge_base_path(&project_root, Some(&topic));

                    match sftp.open(target_path).await {
                        Ok(mut file) => {
                            let mut contents = String::new();
                            if let Err(e) = file.read_to_string(&mut contents).await {
                                messages::BackendResponse::Error {
                                    message: format!("SFTP read knowledge failed: {}", e),
                                    request_id,
                                }
                            } else {
                                messages::BackendResponse::GetKnowledgeResponse {
                                    content: contents,
                                    request_id,
                                }
                            }
                        }
                        Err(e) => messages::BackendResponse::Error {
                            message: format!("SFTP open knowledge failed: {}", e),
                            request_id,
                        },
                    }
                } else {
                    messages::BackendResponse::Error {
                        message: "SSH session not established.".to_string(),
                        request_id,
                    }
                }
            } else {
                let target_path = knowledge::get_knowledge_base_path(&project_root, Some(&topic));

                match filesystem::read_file_content(
                    &target_path,
                    environment_id,
                    active_environment_details,
                )
                .await
                {
                    Ok(content) => messages::BackendResponse::GetKnowledgeResponse {
                        content,
                        request_id,
                    },
                    Err(e) => messages::BackendResponse::Error {
                        message: e,
                        request_id,
                    },
                }
            }
        }
        messages::BackendRequest::SearchWeb {
            query,
            project_root,
            environment_id,
            active_environment_details,
            request_id,
        } => {
            let is_ssh = active_environment_details
                .as_ref()
                .map(|e| e.kind == "ssh")
                .unwrap_or(false);

            match knowledge::search_web(&query).await {
                Ok(content) => {
                    let safe_query = query.replace(|c: char| !c.is_alphanumeric(), "_");
                    let topic = format!("search_results_{}", safe_query)
                        .chars()
                        .take(40)
                        .collect::<String>();

                    if is_ssh {
                        let conn_handle = {
                            if let Some(ssh_session) = &client_session.ssh_session {
                                Some(ssh_session.connection.clone())
                            } else {
                                None
                            }
                        };
                        let sftp = {
                            if let Some(ssh_session) = &client_session.ssh_session {
                                Some(ssh_session.sftp_client.clone())
                            } else {
                                None
                            }
                        };

                        if let (Some(conn), Some(sftp)) = (conn_handle, sftp) {
                            let handle = conn.lock().await;
                            if let Ok(mut channel) = handle.channel_open_session().await {
                                let cmd = format!(
                                    "mkdir -p '{}/.forge/knowledge'",
                                    project_root.trim_end_matches('/')
                                );
                                let _ = channel.exec(true, cmd).await;
                                while let Some(msg) = channel.wait().await {
                                    match msg {
                                        russh::ChannelMsg::Eof
                                        | russh::ChannelMsg::ExitStatus { .. }
                                        | russh::ChannelMsg::Close => break,
                                        _ => {}
                                    }
                                }
                            }

                            let target_path =
                                knowledge::get_knowledge_base_path(&project_root, Some(&topic));

                            match sftp.create(target_path.clone()).await {
                                Ok(mut file) => {
                                    if let Err(e) = file.write_all(content.as_bytes()).await {
                                        let err_resp = messages::BackendResponse::Error {
                                            message: format!("SFTP search save failed: {}", e),
                                            request_id: request_id.clone(),
                                        };
                                        err_resp
                                    } else {
                                        let ok_resp =
                                            messages::BackendResponse::SearchWebResponse {
                                                success: true,
                                                message: format!(
                                                    "Successfully searched web for '{}'",
                                                    query
                                                ),
                                                topic: Some(topic),
                                                request_id: request_id.clone(),
                                            };
                                        ok_resp
                                    }
                                }
                                Err(e) => {
                                    let err_resp = messages::BackendResponse::Error {
                                        message: format!("SFTP file creation failed: {}", e),
                                        request_id: request_id.clone(),
                                    };
                                    err_resp
                                }
                            }
                        } else {
                            let err_resp = messages::BackendResponse::Error {
                                message: "SSH session not established.".to_string(),
                                request_id: request_id.clone(),
                            };
                            err_resp
                        }
                    } else {
                        // Local/WSL Flow
                        let target_path =
                            knowledge::get_knowledge_base_path(&project_root, Some(&topic));

                        match filesystem::write_file_content(
                            &target_path,
                            &content,
                            environment_id,
                            active_environment_details,
                        )
                        .await
                        {
                            Ok(_) => {
                                let ok_resp = messages::BackendResponse::SearchWebResponse {
                                    success: true,
                                    message: format!("Successfully searched web for '{}'", query),
                                    topic: Some(topic),
                                    request_id: request_id.clone(),
                                };
                                ok_resp
                            }
                            Err(e) => {
                                let err_resp = messages::BackendResponse::Error {
                                    message: e,
                                    request_id: request_id.clone(),
                                };
                                err_resp
                            }
                        }
                    }
                }
                Err(e) => {
                    let err_resp = messages::BackendResponse::Error {
                        message: format!("Search failed: {}", e),
                        request_id: request_id.clone(),
                    };
                    err_resp
                }
            }
        }
        messages::BackendRequest::ScrapeWeb {
            url,
            project_root,
            topic,
            environment_id,
            active_environment_details,
            request_id,
        } => {
            let is_ssh = active_environment_details
                .as_ref()
                .map(|e| e.kind == "ssh")
                .unwrap_or(false);

            match knowledge::scrape_url(&url).await {
                Ok(content) => {
                    if is_ssh {
                        let conn_handle = {
                            if let Some(ssh_session) = &client_session.ssh_session {
                                Some(ssh_session.connection.clone())
                            } else {
                                None
                            }
                        };
                        let sftp = {
                            if let Some(ssh_session) = &client_session.ssh_session {
                                Some(ssh_session.sftp_client.clone())
                            } else {
                                None
                            }
                        };

                        if let (Some(conn), Some(sftp)) = (conn_handle, sftp) {
                            let handle = conn.lock().await;
                            if let Ok(mut channel) = handle.channel_open_session().await {
                                let cmd = format!(
                                    "mkdir -p '{}/.forge/knowledge'",
                                    project_root.trim_end_matches('/')
                                );
                                let _ = channel.exec(true, cmd).await;
                                while let Some(msg) = channel.wait().await {
                                    match msg {
                                        russh::ChannelMsg::Eof
                                        | russh::ChannelMsg::ExitStatus { .. }
                                        | russh::ChannelMsg::Close => break,
                                        _ => {}
                                    }
                                }
                            }

                            let target_path =
                                knowledge::get_knowledge_base_path(&project_root, Some(&topic));

                            match sftp.create(target_path.clone()).await {
                                Ok(mut file) => {
                                    if let Err(e) = file.write_all(content.as_bytes()).await {
                                        let err_resp = messages::BackendResponse::Error {
                                            message: format!("SFTP search save failed: {}", e),
                                            request_id: request_id.clone(),
                                        };
                                        err_resp
                                    } else {
                                        let ok_resp =
                                            messages::BackendResponse::ScrapeWebResponse {
                                                success: true,
                                                message: format!(
                                                    "Successfully scraped {} and saved as topic '{}'",
                                                    url, topic
                                                ),
                                                request_id: request_id.clone(),
                                            };
                                        ok_resp
                                    }
                                }
                                Err(e) => {
                                    let err_resp = messages::BackendResponse::Error {
                                        message: format!("SFTP file creation failed: {}", e),
                                        request_id: request_id.clone(),
                                    };
                                    err_resp
                                }
                            }
                        } else {
                            let err_resp = messages::BackendResponse::Error {
                                message: "SSH session not established.".to_string(),
                                request_id: request_id.clone(),
                            };
                            err_resp
                        }
                    } else {
                        // Local/WSL Flow
                        let target_path =
                            knowledge::get_knowledge_base_path(&project_root, Some(&topic));

                        match filesystem::write_file_content(
                            &target_path,
                            &content,
                            environment_id,
                            active_environment_details,
                        )
                        .await
                        {
                            Ok(_) => {
                                let ok_resp = messages::BackendResponse::ScrapeWebResponse {
                                    success: true,
                                    message: format!(
                                        "Successfully scraped {} and saved as topic '{}'",
                                        url, topic
                                    ),
                                    request_id: request_id.clone(),
                                };
                                ok_resp
                            }
                            Err(e) => {
                                let err_resp = messages::BackendResponse::Error {
                                    message: e,
                                    request_id: request_id.clone(),
                                };
                                err_resp
                            }
                        }
                    }
                }
                Err(e) => {
                    let err_resp = messages::BackendResponse::Error {
                        message: format!("Scraping failed: {}", e),
                        request_id: request_id.clone(),
                    };
                    err_resp
                }
            }
        }
        messages::BackendRequest::RunCodeAgent {
            action,
            project_root,
            environment_id: _,
            active_environment_details: _,
            request_id,
        } => {
            let response = match knowledge::run_code_agent(&action, &project_root).await {
                Ok(content) => messages::BackendResponse::RunCodeAgentResponse {
                    success: true,
                    message: content,
                    action,
                    request_id: request_id.clone(),
                },
                Err(e) => messages::BackendResponse::RunCodeAgentResponse {
                    success: false,
                    message: format!("Code Agent Failed: {}", e),
                    action,
                    request_id: request_id.clone(),
                },
            };

            response
        }
        messages::BackendRequest::StopAiGeneration { request_id } => {
            if let Some(tasks) = client_session.active_ai_tasks.lock().await.get(&request_id) {
                tasks.cancel();
                crate::debug_log!("Backend: Cancelled AI task {}", request_id);
            }
            return Some(messages::BackendResponse::Error {
                message: format!("AI generation stopped for task {}", request_id),
                request_id: Some(request_id),
            });
        }
        messages::BackendRequest::TakeScreenshot { url, request_id } => {
            let url_clone = url.clone();
            let req_id_clone = request_id.clone();
            let sender = client_session.sender.clone();

            tokio::spawn(async move {
                let uuid_str = uuid::Uuid::new_v4().to_string();
                let output_file = format!("/tmp/forge_screenshot_{}.png", uuid_str);

                #[cfg(not(target_os = "windows"))]
                let mut cmd = {
                    let mut c = tokio::process::Command::new("bash");
                    c.arg("-c");
                    c.arg(format!("source ~/.bashrc 2>/dev/null; npx -y capture-website-cli \"{}\" --output={}", url_clone, output_file));
                    c
                };

                #[cfg(target_os = "windows")]
                let mut cmd = {
                    let mut c = tokio::process::Command::new("cmd");
                    c.arg("/C");
                    c.arg(format!(
                        "npx -y capture-website-cli \"{}\" --output={}",
                        url_clone, output_file
                    ));
                    c
                };

                let mut success = false;
                let mut base64_result = String::new();

                if let Ok(status) = cmd.status().await {
                    if status.success() {
                        if let Ok(bytes) = tokio::fs::read(&output_file).await {
                            use base64::{Engine as _, engine::general_purpose};
                            base64_result = general_purpose::STANDARD.encode(bytes);
                            success = true;
                            let _ = tokio::fs::remove_file(&output_file).await;
                        }
                    }
                }

                let res = if success {
                    messages::BackendResponse::TakeScreenshotResponse {
                        url: url_clone,
                        base64: format!("data:image/png;base64,{}", base64_result),
                        request_id: req_id_clone,
                    }
                } else {
                    messages::BackendResponse::Error {
                        message: format!("Failed to capture screenshot of {}", url_clone),
                        request_id: req_id_clone,
                    }
                };

                let json_response = serde_json::to_string(&res).unwrap_or_else(|e| {
                    serde_json::json!({ "type": "Error", "payload": { "message": format!("Failed to serialize response: {}", e) } }).to_string()
                });
                let _ = sender.send(warp::ws::Message::text(json_response));
            });
            return None;
        }
        messages::BackendRequest::ExportProject {
            project_root,
            request_id,
        } => {
            let env_id = None;
            let env_details = None;

            match filesystem::export_project_to_zip(&project_root, env_id, env_details).await {
                Ok(zip_path) => messages::BackendResponse::ExportProjectResponse {
                    success: true,
                    zip_path: Some(zip_path),
                    error: None,
                    request_id,
                },
                Err(e) => messages::BackendResponse::ExportProjectResponse {
                    success: false,
                    zip_path: None,
                    error: Some(e),
                    request_id,
                },
            }
        }
        messages::BackendRequest::GetGitStatus {
            project_root,
            request_id,
        } => match git::get_git_status(&project_root).await {
            Ok((branch, files, remote_url)) => messages::BackendResponse::GetGitStatusResponse {
                is_repo: true,
                branch,
                files,
                remote_url,
                request_id,
            },
            Err(e) => {
                if e == "Not a git repository" {
                    messages::BackendResponse::GetGitStatusResponse {
                        is_repo: false,
                        branch: "".into(),
                        files: vec![],
                        remote_url: None,
                        request_id,
                    }
                } else {
                    messages::BackendResponse::Error {
                        message: format!("Failed to get git status: {}", e),
                        request_id,
                    }
                }
            }
        },
        messages::BackendRequest::GitInit {
            project_root,
            request_id,
        } => match git::init_repo(&project_root).await {
            Ok(_) => messages::BackendResponse::GitInitResponse {
                success: true,
                error: None,
                request_id,
            },
            Err(e) => messages::BackendResponse::GitInitResponse {
                success: false,
                error: Some(e),
                request_id,
            },
        },
        messages::BackendRequest::GitAddRemote {
            project_root,
            remote_url,
            request_id,
        } => match git::add_remote(&project_root, &remote_url).await {
            Ok(_) => messages::BackendResponse::GitAddRemoteResponse {
                success: true,
                error: None,
                request_id,
            },
            Err(e) => messages::BackendResponse::GitAddRemoteResponse {
                success: false,
                error: Some(e),
                request_id,
            },
        },
        messages::BackendRequest::GitRemoveRemote {
            project_root,
            request_id,
        } => match git::remove_remote(&project_root).await {
            Ok(_) => messages::BackendResponse::GitRemoveRemoteResponse {
                success: true,
                error: None,
                request_id,
            },
            Err(e) => messages::BackendResponse::GitRemoveRemoteResponse {
                success: false,
                error: Some(e),
                request_id,
            },
        },
        messages::BackendRequest::GenerateCommitMessage {
            project_root,
            model,
            request_id,
        } => {
            let sender = client_session.sender.clone();
            tokio::spawn(async move {
                match git::get_git_diff(&project_root).await {
                    Ok(diff) => {
                        match crate::ai_provider::generate_commit_message(
                            model,
                            diff,
                            &project_root,
                        )
                        .await
                        {
                            Ok(message) => {
                                let _ = sender.send(warp::ws::Message::text(
                                    serde_json::to_string(
                                        &messages::BackendResponse::GenerateCommitMessageResponse {
                                            message,
                                            request_id: request_id.clone(),
                                        },
                                    )
                                    .unwrap(),
                                ));
                            }
                            Err(e) => {
                                let _ = sender.send(warp::ws::Message::text(
                                    serde_json::to_string(&messages::BackendResponse::Error {
                                        message: format!(
                                            "Failed to generate commit message: {}",
                                            e
                                        ),
                                        request_id: request_id.clone(),
                                    })
                                    .unwrap(),
                                ));
                            }
                        }
                    }
                    Err(e) => {
                        let _ = sender.send(warp::ws::Message::text(
                            serde_json::to_string(&messages::BackendResponse::Error {
                                message: format!("Failed to get git diff: {}", e),
                                request_id: request_id.clone(),
                            })
                            .unwrap(),
                        ));
                    }
                }
            });
            return None;
        }
        messages::BackendRequest::GitCommitAndPush {
            project_root,
            message,
            request_id,
        } => match git::commit_and_push(&project_root, &message).await {
            Ok(output) => messages::BackendResponse::GitCommitAndPushResponse {
                success: true,
                output,
                request_id,
            },
            Err(e) => messages::BackendResponse::GitCommitAndPushResponse {
                success: false,
                output: e,
                request_id,
            },
        },
        messages::BackendRequest::GitPull {
            project_root,
            request_id,
        } => match git::pull(&project_root).await {
            Ok(output) => messages::BackendResponse::GitPullResponse {
                success: true,
                output,
                request_id,
            },
            Err(e) => messages::BackendResponse::GitPullResponse {
                success: false,
                output: e,
                request_id,
            },
        },
        messages::BackendRequest::AiChatStream {
            model,
            profile,
            chat_history,
            prompt,
            mcp_servers,
            context,
            request_id,
        } => {
            crate::debug_log!(
                "Backend: Routing AI Chat Stream to Provider for prompt: {}",
                prompt
            );
            let sender = client_session.sender.clone();
            let token = CancellationToken::new();
            let token_clone = token.clone();
            let request_id_clone = request_id.clone();
            let tasks_clone = client_session.active_ai_tasks.clone();

            if let Some(rid) = &request_id {
                tasks_clone.lock().await.insert(rid.clone(), token.clone());
            }

            let is_wsl = false;

            let clients_clone = clients.clone();
            tokio::spawn(async move {
                crate::ai_provider::handle_ai_chat_stream(
                    model,
                    profile,
                    chat_history,
                    prompt,
                    mcp_servers,
                    context,
                    request_id_clone.clone(),
                    sender,
                    token_clone,
                    clients_clone,
                    client_id,
                    is_wsl,
                )
                .await;
                if let Some(rid) = request_id_clone {
                    tasks_clone.lock().await.remove(&rid);
                }
            });
            return None;
        }
        messages::BackendRequest::SetDebugLog { enabled } => {
            crate::DEBUG_LOG.store(enabled, std::sync::atomic::Ordering::Relaxed);
            crate::debug_log!(
                "Backend debug logging is now {}",
                if enabled { "enabled" } else { "disabled" }
            );
            return None;
        }
    })
}
