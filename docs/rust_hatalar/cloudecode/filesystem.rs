use std::path::{Path, PathBuf};
use tokio::fs;
use futures::Future;
use std::pin::Pin;

#[cfg(target_os = "windows")]
use wsl_path::convert_to_wsl_path;

use crate::messages;
use russh_sftp::protocol::FileType;

#[cfg(target_os = "windows")]
fn convert_to_wsl_unc_path(original_path: &str, distro_name: &Option<String>) -> String {
    let path_buf = PathBuf::from(original_path);
    if let Some(distro) = distro_name {
        convert_to_wsl_path(&path_buf, Some(distro)).to_string_lossy().into_owned()
    } else {
        original_path.to_string()
    }
}

#[cfg(not(target_os = "windows"))]
fn convert_to_wsl_unc_path(original_path: &str, _distro_name: &Option<String>) -> String {
    original_path.to_string()
}

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
pub struct FileNode {
    pub path: String,
    pub name: String,
    pub is_dir: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<FileNode>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<String>,
}

pub fn list_dir_contents<'a>(
    path: &'a str,
    recursive: bool,
    _environment_id: Option<String>,
    active_environment_details: Option<messages::Environment>,
) -> Pin<Box<dyn Future<Output = Result<Vec<FileNode>, String>> + Send + 'a>> {
    Box::pin(async move {
        let mut current_os_path = PathBuf::from(path);
        if let Some(env_details) = active_environment_details.clone() {
            if env_details.kind == "wsl" {
                #[cfg(target_os = "windows")]
                {
                    let distro_name = env_details.detail.clone();
                    let wsl_unc_path_str = convert_to_wsl_unc_path(path, &distro_name);
                    current_os_path = PathBuf::from(wsl_unc_path_str.clone());
                }
                #[cfg(not(target_os = "windows"))]
                {
                    if std::env::consts::OS != "linux" {
                        return Err(format!("WSL directory listing is not yet fully supported on non-Linux backend ({}): {}. Requested path: {}", std::env::consts::OS, env_details.detail, path));
                    }
                    current_os_path = PathBuf::from(path);
                }
            } else if env_details.kind == "ssh" {
                println!("Backend: list_dir_contents - INSIDE SSH BLOCK. Path: {}", path);
                let host = env_details.host.clone().ok_or_else(|| "SSH host not provided".to_string())?;
                let username = env_details.username.clone().ok_or_else(|| "SSH username not provided".to_string())?;
                let port = env_details.port.unwrap_or(22);
                let password = env_details.password.clone();

                let ssh_client = crate::ssh::RealSshClient::new(host, port, username, password).await.map_err(|e| e.to_string())?;
                match ssh_client.sftp_list_dir(path).await {
                    Ok(nodes_with_attrs) => {
                        let nodes: Vec<FileNode> = nodes_with_attrs.into_iter().map(|(filename, attrs)| {
                            FileNode {
                                path: format!("{}/{}", path, filename),
                                name: filename,
                                is_dir: attrs.file_type() == FileType::Dir,
                                children: None,
                                content: None,
                            }
                        }).collect();
                        return Ok(nodes);
                    },
                    Err(e) => {
                        eprintln!("Backend Error: SSH list_dir error '{}': {}", path, e);
                        return Err(e.to_string());
                    }
                }
            } else {
                current_os_path = PathBuf::from(path);
            }
        } else {
            current_os_path = PathBuf::from(path);
        }

        let mut entries = fs::read_dir(&current_os_path).await
            .map_err(|e: std::io::Error| format!("Cannot list directory '{}': {}", current_os_path.to_string_lossy(), e.to_string()))?;

        let mut nodes = Vec::new();

        while let Some(entry) = entries.next_entry().await.map_err(|e: std::io::Error| format!("Error reading directory entry '{}': {}", current_os_path.to_string_lossy(), e.to_string()))? {
            let entry_path = entry.path();
            let file_name = entry_path.file_name().unwrap_or_default().to_string_lossy().into_owned();

            if file_name.starts_with(".") {
                continue;
            }

            let metadata = match fs::metadata(&entry_path).await {
                Ok(m) => m,
                Err(e) => {
                    eprintln!("Backend Error: Cannot read metadata '{}': {} (Skipping)", entry_path.to_string_lossy(), e);
                    continue;
                }
            };

            let mut node = FileNode {
                path: entry_path.to_string_lossy().into_owned(),
                name: file_name,
                is_dir: metadata.is_dir(),
                children: None,
                content: None,
            };

            if node.is_dir && recursive {
                match list_dir_contents(
                    &node.path,
                    recursive,
                    _environment_id.clone(),
                    active_environment_details.clone(),
                ).await {
                    Ok(children) => node.children = Some(children),
                    Err(e) => eprintln!("Backend Error: Subdirectory listing error '{}': {}", node.path, e),
                }
            }

            nodes.push(node);
        }

        nodes.sort_by(|a, b| {
            if a.is_dir && !b.is_dir { std::cmp::Ordering::Less }
            else if !a.is_dir && b.is_dir { std::cmp::Ordering::Greater }
            else { a.name.cmp(&b.name) }
        });

        Ok(nodes)
    })
}

pub async fn read_file_content(path: &str, _environment_id: Option<String>, active_environment_details: Option<messages::Environment>) -> Result<String, String> {
    let mut current_os_path = PathBuf::from(path);

    if let Some(env_details) = active_environment_details.clone() {
        if env_details.kind == "wsl" {
            #[cfg(target_os = "windows")]
            {
                current_os_path = PathBuf::from(convert_to_wsl_unc_path(path, &env_details.detail));
            }
            #[cfg(not(target_os = "windows"))]
            {
                if std::env::consts::OS != "linux" {
                    return Err(format!("WSL file reading is not yet fully supported on non-Linux backend ({}): {}. Requested path: {}", std::env::consts::OS, env_details.detail, path));
                }
            }
        } else if env_details.kind == "ssh" {
            println!("Backend: read_file_content - INSIDE SSH BLOCK. Path: {}", path);
            let host = env_details.host.clone().ok_or_else(|| "SSH host not provided".to_string())?;
            let username = env_details.username.clone().ok_or_else(|| "SSH username not provided".to_string())?;
            let port = env_details.port.unwrap_or(22);
            let password = env_details.password.clone();

            let ssh_client = crate::ssh::RealSshClient::new(host, port, username, password).await.map_err(|e| e.to_string())?;
            match ssh_client.sftp_read_file(path).await {
                Ok(content) => return Ok(content),
                Err(e) => {
                    eprintln!("Backend Error: SSH read_file error '{}': {}", path, e);
                    return Err(e.to_string());
                }
            }
        } else {
            current_os_path = PathBuf::from(path);
        }
    } else {
        current_os_path = PathBuf::from(path);
    }
    tokio::fs::read_to_string(&current_os_path).await
        .map_err(|e| format!("Cannot read file '{}': {}", current_os_path.to_string_lossy(), e))
}

pub async fn write_file_content(path: &str, content: &str, _environment_id: Option<String>, active_environment_details: Option<messages::Environment>) -> Result<(), String> {
    let mut current_os_path = PathBuf::from(path);

    if let Some(env_details) = active_environment_details.clone() {
        if env_details.kind == "wsl" {
            #[cfg(target_os = "windows")]
            {
                current_os_path = PathBuf::from(convert_to_wsl_unc_path(path, &env_details.detail));
            }
            #[cfg(not(target_os = "windows"))]
            {
                if std::env::consts::OS != "linux" {
                    return Err(format!("WSL file writing is not yet fully supported on non-Linux backend ({}): {}. Requested path: {}", std::env::consts::OS, env_details.detail, path));
                }
            }
        } else if env_details.kind == "ssh" {
            println!("Backend: write_file_content - INSIDE SSH BLOCK. Path: {}", path);
            let host = env_details.host.clone().ok_or_else(|| "SSH host not provided".to_string())?;
            let username = env_details.username.clone().ok_or_else(|| "SSH username not provided".to_string())?;
            let port = env_details.port.unwrap_or(22);
            let password = env_details.password.clone();

            let ssh_client = crate::ssh::RealSshClient::new(host, port, username, password).await.map_err(|e| e.to_string())?;
            match ssh_client.sftp_write_file(path, content).await {
                Ok(_) => return Ok(()),
                Err(e) => {
                    eprintln!("Backend Error: SSH write_file error '{}': {}", path, e);
                    return Err(e.to_string());
                }
            }
        } else {
            current_os_path = PathBuf::from(path);
        }
    } else {
        current_os_path = PathBuf::from(path);
    }
    tokio::fs::write(&current_os_path, content).await
        .map_err(|e| format!("Cannot write file '{}': {}", current_os_path.to_string_lossy(), e))
}

pub async fn create_file(path: &str, _environment_id: Option<String>, active_environment_details: Option<messages::Environment>) -> Result<(), String> {
    let mut current_os_path = PathBuf::from(path);

    if let Some(env_details) = active_environment_details.clone() {
        if env_details.kind == "wsl" {
            #[cfg(target_os = "windows")]
            {
                current_os_path = PathBuf::from(convert_to_wsl_unc_path(path, &env_details.detail));
            }
            #[cfg(not(target_os = "windows"))]
            {
                if std::env::consts::OS != "linux" {
                    return Err(format!("WSL file creation is not yet fully supported on non-Linux backend ({}): {}. Requested path: {}", std::env::consts::OS, env_details.detail, path));
                }
            }
        } else if env_details.kind == "ssh" {
            println!("Backend: create_file - INSIDE SSH BLOCK. Path: {}", path);
            let host = env_details.host.clone().ok_or_else(|| "SSH host not provided".to_string())?;
            let username = env_details.username.clone().ok_or_else(|| "SSH username not provided".to_string())?;
            let port = env_details.port.unwrap_or(22);
            let password = env_details.password.clone();

            let ssh_client = crate::ssh::RealSshClient::new(host, port, username, password).await.map_err(|e| e.to_string())?;
            match ssh_client.sftp_create_file(path).await {
                Ok(_) => return Ok(()),
                Err(e) => {
                    eprintln!("Backend Error: SSH create_file error '{}': {}", path, e);
                    return Err(e.to_string());
                }
            }
        } else {
            current_os_path = PathBuf::from(path);
        }
    } else {
        current_os_path = PathBuf::from(path);
    }
    tokio::fs::File::create(&current_os_path).await
        .map_err(|e| format!("Cannot create file '{}': {}", current_os_path.to_string_lossy(), e))?;
    Ok(())
}

pub async fn create_dir(path: &str, _environment_id: Option<String>, active_environment_details: Option<messages::Environment>, is_project_root: Option<bool>) -> Result<(), String> {
    let mut current_os_path = PathBuf::from(path);

    if let Some(env_details) = active_environment_details.clone() {
        if env_details.kind == "wsl" {
            #[cfg(target_os = "windows")]
            {
                current_os_path = PathBuf::from(convert_to_wsl_unc_path(path, &env_details.detail));
            }
            #[cfg(not(target_os = "windows"))]
            {
                if std::env::consts::OS != "linux" {
                    return Err(format!("WSL directory creation is not yet fully supported on non-Linux backend ({}): {}. Requested path: {}", std::env::consts::OS, env_details.detail, path));
                }
            }
        } else if env_details.kind == "ssh" {
            println!("Backend: create_dir - INSIDE SSH BLOCK. Path: {}", path);
            let host = env_details.host.clone().ok_or_else(|| "SSH host not provided".to_string())?;
            let username = env_details.username.clone().ok_or_else(|| "SSH username not provided".to_string())?;
            let port = env_details.port.unwrap_or(22);
            let password = env_details.password.clone();

            let ssh_client = crate::ssh::RealSshClient::new(host, port, username, password).await.map_err(|e| e.to_string())?;
            match ssh_client.sftp_create_dir(path).await {
                Ok(_) => return Ok(()),
                Err(e) => {
                    eprintln!("Backend Error: SSH create_dir error '{}': {}", path, e);
                    return Err(e.to_string());
                }
            }
        } else {
            current_os_path = PathBuf::from(path);
        }
    } else {
        current_os_path = PathBuf::from(path);
    }
    tokio::fs::create_dir_all(&current_os_path).await
        .map_err(|e| format!("Cannot create directory '{}': {}", current_os_path.to_string_lossy(), e))?;
    Ok(())
}

pub async fn delete_path(path: &str, _environment_id: Option<String>, active_environment_details: Option<messages::Environment>) -> Result<(), String> {
    let mut current_os_path = PathBuf::from(path);

    if let Some(env_details) = active_environment_details.clone() {
        if env_details.kind == "wsl" {
            #[cfg(target_os = "windows")]
            {
                current_os_path = PathBuf::from(convert_to_wsl_unc_path(path, &env_details.detail));
            }
            #[cfg(not(target_os = "windows"))]
            {
                if std::env::consts::OS != "linux" {
                    return Err(format!("WSL path deletion is not yet fully supported on non-Linux backend ({}): {}. Requested path: {}", std::env::consts::OS, env_details.detail, path));
                }
            }
        } else if env_details.kind == "ssh" {
            println!("Backend: delete_path - INSIDE SSH BLOCK. Path: {}", path);
            let host = env_details.host.clone().ok_or_else(|| "SSH host not provided".to_string())?;
            let username = env_details.username.clone().ok_or_else(|| "SSH username not provided".to_string())?;
            let port = env_details.port.unwrap_or(22);
            let password = env_details.password.clone();

            let ssh_client = crate::ssh::RealSshClient::new(host, port, username, password).await.map_err(|e| e.to_string())?;
            match ssh_client.sftp_delete_path(path).await {
                Ok(_) => return Ok(()),
                Err(e) => {
                    eprintln!("Backend Error: SSH delete_path error '{}': {}", path, e);
                    return Err(e.to_string());
                }
            }
        } else {
            current_os_path = PathBuf::from(path);
        }
    } else {
        current_os_path = PathBuf::from(path);
    }

    if current_os_path.is_dir() {
        tokio::fs::remove_dir_all(&current_os_path).await
            .map_err(|e| format!("Cannot delete directory '{}': {}", current_os_path.to_string_lossy(), e))?;
    } else {
        tokio::fs::remove_file(&current_os_path).await
            .map_err(|e| format!("Cannot delete file '{}': {}", current_os_path.to_string_lossy(), e))?;
    }
    Ok(())
}

pub async fn get_suggested_project_roots(_environment_id: Option<String>, active_environment_details: Option<messages::Environment>) -> Result<Vec<FileNode>, String> {
    let mut roots = Vec::new();

    let home_dir = home::home_dir().ok_or_else(|| "User home directory not found.".to_string())?;

    // WSL ortamı için özel kökler
    #[cfg(target_os = "windows")]
    if let Some(env_details) = active_environment_details.clone() {
        if env_details.kind == "wsl" {
            let distro_name = env_details.detail.clone();
            // WSL dağıtımının UNC yolu
            let wsl_root = format!("//wsl.localhost/{}/", distro_name.unwrap_or_else(|| "Ubuntu".to_string()));
            roots.push(FileNode {
                path: wsl_root.clone(),
                name: format!("[WSL] {}", distro_name.unwrap_or_else(|| "Ubuntu".to_string())),
                is_dir: true,
                children: None,
                content: None,
            });
            // WSL ana dizinini de ekleyebiliriz (örneğin /home/user)
            let wsl_home = format!("{}/home/{}", wsl_root, std::env::var("USER").unwrap_or_else(|_| "user".to_string()));
            roots.push(FileNode {
                path: wsl_home.clone(),
                name: "WSL Home Directory".to_string(),
                is_dir: true,
                children: None,
                content: None,
            });
            return Ok(roots);
        } else if env_details.kind == "ssh" {
            println!("Backend: get_suggested_project_roots - INSIDE SSH BLOCK. Environment details: {:?}", env_details);
            let host = env_details.host.clone().ok_or_else(|| "SSH host not provided".to_string())?;
            let username = env_details.username.clone().ok_or_else(|| "SSH username not provided".to_string())?;
            let port = env_details.port.unwrap_or(22);
            let password = env_details.password.clone();

            let ssh_client = crate::ssh::RealSshClient::new(host, port, username, password).await.map_err(|e| e.to_string())?;
            
            // SSH sunucusunda varsayılan ana dizini listelemeyi dene
            match ssh_client.sftp_list_dir("/home").await {
                Ok(sftp_nodes) => {
                    let nodes: Vec<FileNode> = sftp_nodes.into_iter().map(|(filename, attrs)| {
                        FileNode {
                            path: format!("/home/{}", filename),
                            name: filename,
                            is_dir: attrs.file_type() == FileType::Dir,
                            children: None,
                            content: None,
                        }
                    }).collect();
                    roots.extend(nodes);
                },
                Err(e) => eprintln!("Backend Error: SSH get_suggested_project_roots /home listing error: {}", e),
            }

            return Ok(roots);
        }
    }


    // Varsayılan kökler (local dosya sistemi için)
    // Ana dizin
    roots.push(FileNode {
        path: home_dir.to_string_lossy().into_owned(),
        name: "Home Directory".to_string(),
        is_dir: true,
        children: None,
        content: None,
    });

    // Masaüstü (eğer varsa)
    if let Some(desktop_dir) = home_dir.join("Desktop").to_str() {
        if Path::new(desktop_dir).is_dir() {
            roots.push(FileNode {
                path: desktop_dir.to_string(),
                name: "Desktop".to_string(),
                is_dir: true,
                children: None,
                content: None,
            });
        }
    }

    // Belgeler (eğer varsa)
    if let Some(documents_dir) = home_dir.join("Documents").to_str() {
        if Path::new(documents_dir).is_dir() {
            roots.push(FileNode {
                path: documents_dir.to_string(),
                name: "Documents".to_string(),
                is_dir: true,
                children: None,
                content: None,
            });
        }
    }
    
    Ok(roots)
}

