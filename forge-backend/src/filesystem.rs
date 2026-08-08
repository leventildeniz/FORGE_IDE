use futures::Future;
use std::path::{Path, PathBuf};
use std::pin::Pin;
use tokio::fs;

use crate::messages;

#[cfg(not(target_os = "windows"))]
#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
pub struct FileNode {
    pub path: String,
    pub name: String,
    pub is_dir: bool,
    pub is_file: bool, // YENİ EKLENDİ
    pub size: u64,     // YENİ EKLENDİ
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
        let current_os_path: PathBuf;
        if let Some(env_details) = active_environment_details.clone() {
            if env_details.kind == "wsl" {
                #[cfg(target_os = "windows")]
                {
                    let distro_name = env_details.detail.clone();
                    let wsl_unc_path_str = path.to_string(); // convert_to_wsl_unc_path kaldırıldığı için doğrudan to_string
                    current_os_path = PathBuf::from(wsl_unc_path_str.clone());
                }
                #[cfg(not(target_os = "windows"))]
                {
                    if std::env::consts::OS != "linux" {
                        return Err(format!(
                            "WSL directory listing is not yet fully supported on non-Linux backend ({}): {}. Requested path: {}",
                            std::env::consts::OS,
                            env_details.detail,
                            path
                        ));
                    }
                    current_os_path = PathBuf::from(path);
                }
            } else {
                current_os_path = PathBuf::from(path);
            }
        } else {
            current_os_path = PathBuf::from(path);
        }

        let mut entries = fs::read_dir(&current_os_path)
            .await
            .map_err(|e: std::io::Error| {
                format!(
                    "Cannot list directory '{}': {}",
                    current_os_path.to_string_lossy(),
                    e.to_string()
                )
            })?;

        let mut nodes = Vec::new();

        while let Some(entry) = entries.next_entry().await.map_err(|e: std::io::Error| {
            format!(
                "Error reading directory entry '{}': {}",
                current_os_path.to_string_lossy(),
                e.to_string()
            )
        })? {
            let entry_path = entry.path();
            let file_name = entry_path
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .into_owned();

            if file_name == ".git"
                || file_name == "node_modules"
                || file_name == "target"
                || file_name == ".next"
                || file_name == "dist"
                || file_name == "build"
                || file_name == ".svelte-kit"
                || file_name == ".tanstack"
                || file_name == ".expo"
                || file_name == ".nuxt"
                || file_name == "coverage"
                || file_name == "logs"
                || file_name == "venv"
                || file_name == ".venv"
                || file_name == "env"
                || file_name == ".env"
                || file_name == "__pycache__"
                || file_name == ".forge_memory"
            {
                continue;
            }

            let file_type = match entry.file_type().await {
                Ok(ft) => ft,
                Err(e) => {
                    eprintln!(
                        "Backend Error: Cannot read file type '{}': {} (Skipping)",
                        entry_path.to_string_lossy(),
                        e
                    );
                    continue;
                }
            };

            let mut node = FileNode {
                path: entry_path.to_string_lossy().into_owned(),
                name: file_name,
                is_dir: file_type.is_dir(),
                is_file: file_type.is_file(),
                size: 0, // Avoid heavy fs::metadata call just for size unless needed.
                children: None,
                content: None,
            };

            if node.is_dir && recursive {
                match list_dir_contents(
                    &node.path,
                    recursive,
                    _environment_id.clone(),
                    active_environment_details.clone(),
                )
                .await
                {
                    Ok(children) => node.children = Some(children),
                    Err(e) => eprintln!(
                        "Backend Error: Subdirectory listing error '{}': {}",
                        node.path, e
                    ),
                }
            }

            nodes.push(node);
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
    })
}

pub async fn read_file_content(
    path: &str,
    _environment_id: Option<String>,
    active_environment_details: Option<messages::Environment>,
) -> Result<String, String> {
    let mut current_os_path = PathBuf::from(path);

    if let Some(env_details) = active_environment_details.clone() {
        if env_details.kind == "wsl" {
            #[cfg(target_os = "windows")]
            {
                current_os_path = PathBuf::from(path.to_string());
            }
            #[cfg(not(target_os = "windows"))]
            {
                if std::env::consts::OS != "linux" {
                    return Err(format!(
                        "WSL file reading is not yet fully supported on non-Linux backend ({}): {}. Requested path: {}",
                        std::env::consts::OS,
                        env_details.detail,
                        path
                    ));
                }
            }
        } else if env_details.kind == "ssh" {
            // Removed SSH specific file read logic from filesystem.rs
            return Err("SSH file read not supported in filesystem module.".to_string());
        } else {
            current_os_path = PathBuf::from(path);
        }
    } else {
        current_os_path = PathBuf::from(path);
    }
    tokio::fs::read_to_string(&current_os_path)
        .await
        .map_err(|e| {
            format!(
                "Cannot read file '{}': {}",
                current_os_path.to_string_lossy(),
                e
            )
        })
}

pub async fn write_file_content(
    path: &str,
    content: &str,
    _environment_id: Option<String>,
    active_environment_details: Option<messages::Environment>,
) -> Result<(), String> {
    let mut current_os_path = PathBuf::from(path);

    if let Some(env_details) = active_environment_details.clone() {
        if env_details.kind == "wsl" {
            #[cfg(target_os = "windows")]
            {
                current_os_path = PathBuf::from(path.to_string());
            }
            #[cfg(not(target_os = "windows"))]
            {
                if std::env::consts::OS != "linux" {
                    return Err(format!(
                        "WSL file writing is not yet fully supported on non-Linux backend ({}): {}. Requested path: {}",
                        std::env::consts::OS,
                        env_details.detail,
                        path
                    ));
                }
            }
        } else {
            current_os_path = PathBuf::from(path);
        }
    }
    if let Some(parent) = current_os_path.parent() {
        if !parent.exists() {
            tokio::fs::create_dir_all(parent).await.map_err(|e| {
                format!(
                    "Cannot create parent directory for '{}': {}",
                    current_os_path.display(),
                    e
                )
            })?;
        }
    }

    tokio::fs::write(&current_os_path, content)
        .await
        .map_err(|e| {
            format!(
                "Cannot write file '{}': {}",
                current_os_path.to_string_lossy(),
                e
            )
        })
}

pub async fn create_file(
    path: &str,
    _environment_id: Option<String>,
    active_environment_details: Option<messages::Environment>,
) -> Result<(), String> {
    let mut current_os_path = PathBuf::from(path);

    if let Some(env_details) = active_environment_details.clone() {
        if env_details.kind == "wsl" {
            #[cfg(target_os = "windows")]
            {
                current_os_path = PathBuf::from(path.to_string());
            }
            #[cfg(not(target_os = "windows"))]
            {
                if std::env::consts::OS != "linux" {
                    return Err(format!(
                        "WSL file creation is not yet fully supported on non-Linux backend ({}): {}. Requested path: {}",
                        std::env::consts::OS,
                        env_details.detail,
                        path
                    ));
                }
            }
        } else {
            current_os_path = PathBuf::from(path);
        }
    }
    tokio::fs::File::create(&current_os_path)
        .await
        .map_err(|e| {
            format!(
                "Cannot create file '{}': {}",
                current_os_path.to_string_lossy(),
                e
            )
        })?;
    Ok(())
}

pub async fn create_dir(
    path: &str,
    _recursive: bool,
    _environment_id: Option<String>,
    _active_environment_details: Option<messages::Environment>,
) -> Result<(), String> {
    let mut current_os_path = PathBuf::from(path);

    if let Some(env_details) = _active_environment_details.clone() {
        if env_details.kind == "wsl" {
            #[cfg(target_os = "windows")]
            {
                current_os_path = PathBuf::from(path.to_string());
            }
            #[cfg(not(target_os = "windows"))]
            {
                if std::env::consts::OS != "linux" {
                    return Err(format!(
                        "WSL directory creation is not yet fully supported on non-Linux backend ({}): {}. Requested path: {}",
                        std::env::consts::OS,
                        env_details.detail,
                        path
                    ));
                }
            }
        } else {
            current_os_path = PathBuf::from(path);
        }
    }
    tokio::fs::create_dir_all(&current_os_path)
        .await
        .map_err(|e| {
            format!(
                "Cannot create directory '{}': {}",
                current_os_path.to_string_lossy(),
                e
            )
        })?;
    Ok(())
}

pub async fn rename_path(
    old_path: &str,
    new_path: &str,
    _environment_id: Option<String>,
    _active_environment_details: Option<messages::Environment>,
) -> Result<(), String> {
    let old_os_path = PathBuf::from(old_path);
    let new_os_path = PathBuf::from(new_path);

    // WSL logic could be added here if needed, similar to other functions.
    // Assuming PathBuf handles basic local/WSL operations appropriately if mapped.
    // Proper WSL path conversion would be implemented for robust WSL support on Windows.

    tokio::fs::rename(&old_os_path, &new_os_path)
        .await
        .map_err(|e| {
            format!(
                "Cannot rename path '{}' to '{}': {}",
                old_os_path.to_string_lossy(),
                new_os_path.to_string_lossy(),
                e
            )
        })
}

pub async fn delete_path(
    path: &str,
    _environment_id: Option<String>,
    _active_environment_details: Option<messages::Environment>,
) -> Result<(), String> {
    let current_os_path = PathBuf::from(path); // 'mut' kaldırıldı

    if let Some(env_details) = _active_environment_details.clone() {
        if env_details.kind == "wsl" {
            #[cfg(target_os = "windows")]
            {
                current_os_path = PathBuf::from(path.to_string());
            }
            #[cfg(not(target_os = "windows"))]
            {
                if std::env::consts::OS != "linux" {
                    return Err(format!(
                        "WSL path deletion is not yet fully supported on non-Linux backend ({}): {}. Requested path: {}",
                        std::env::consts::OS,
                        env_details.detail,
                        path
                    ));
                }
            }
        }
    }

    if current_os_path.is_dir() {
        tokio::fs::remove_dir_all(&current_os_path)
            .await
            .map_err(|e| {
                format!(
                    "Cannot delete directory '{}': {}",
                    current_os_path.to_string_lossy(),
                    e
                )
            })?;
    } else {
        tokio::fs::remove_file(&current_os_path)
            .await
            .map_err(|e| {
                format!(
                    "Cannot delete file '{}': {}",
                    current_os_path.to_string_lossy(),
                    e
                )
            })?;
    }
    Ok(())
}

pub async fn get_suggested_project_roots(
    _environment_id: Option<String>,
    active_environment_details: Option<messages::Environment>,
) -> Result<Vec<FileNode>, String> {
    let mut roots = Vec::new();

    if let Some(env_details) = active_environment_details.clone() {
        if env_details.kind == "ssh" {
            roots.push(FileNode {
                path: "/".to_string(),
                name: "Remote Home (/)".to_string(),
                is_dir: true,
                is_file: false,
                size: 0,
                children: None,
                content: None,
            });
            return Ok(roots);
        }
    }

    let home_dir = home::home_dir().ok_or_else(|| "User home directory not found.".to_string())?;

    // WSL ortamı için özel kökler
    #[cfg(target_os = "windows")]
    if let Some(env_details) = active_environment_details.clone() {
        if env_details.kind == "wsl" {
            let distro_name = env_details.detail.clone();
            // WSL dağıtımının UNC yolu
            let wsl_root = format!("//wsl.localhost/{}/", distro_name);
            roots.push(FileNode {
                path: wsl_root.clone(),
                name: format!("[WSL] {}", distro_name),
                is_dir: true,
                is_file: false,
                size: 0,
                children: None,
                content: None,
            });
            // WSL ana dizinini de ekleyebiliriz (örneğin /home/user)
            let wsl_home = format!(
                "{}/home/{}",
                wsl_root,
                std::env::var("USER").unwrap_or_else(|_| "user".to_string())
            );
            roots.push(FileNode {
                path: wsl_home.clone(),
                name: "WSL Home Directory".to_string(),
                is_dir: true,
                is_file: false,
                size: 0,
                children: None,
                content: None,
            });
            return Ok(roots);
        }
    }

    // Varsayılan kökler (local dosya sistemi için)
    // Ana dizin
    roots.push(FileNode {
        path: home_dir.to_string_lossy().into_owned(),
        name: "Home Directory".to_string(),
        is_dir: true,
        is_file: false,
        size: 0,
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
                is_file: false,
                size: 0,
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
                is_file: false,
                size: 0,
                children: None,
                content: None,
            });
        }
    }

    Ok(roots)
}

use std::fs::File;
use std::io::{Read, Write};
use walkdir::WalkDir;
use zip::write::SimpleFileOptions;

pub async fn export_project_to_zip(
    project_root: &str,
    _environment_id: Option<String>,
    _active_environment_details: Option<messages::Environment>,
) -> Result<String, String> {
    let root_path = Path::new(project_root);
    if !root_path.exists() || !root_path.is_dir() {
        return Err("Project root is invalid".to_string());
    }

    let forge_dir = root_path.join(".forge");
    if !forge_dir.exists() {
        if let Err(e) = std::fs::create_dir_all(&forge_dir) {
            return Err(format!("Failed to create .forge directory: {}", e));
        }
    }

    let project_name = root_path.file_name().unwrap_or_default().to_string_lossy();
    let zip_filename = format!("{}_export.zip", project_name);
    let temp_dir = std::env::temp_dir();
    let zip_path = temp_dir.join(&zip_filename);

    let zip_path_clone = zip_path.clone();
    let root_path_clone = root_path.to_path_buf();

    // We run the zip blocking operations inside a spawn_blocking block to prevent blocking the async runtime
    let _result = tokio::task::spawn_blocking(move || -> Result<(), String> {
        let file = File::create(&zip_path_clone)
            .map_err(|e| format!("Failed to create zip file: {}", e))?;
        let mut zip = zip::ZipWriter::new(file);
        let options =
            SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);

        let walker = WalkDir::new(&root_path_clone).into_iter();
        for entry in walker.filter_entry(|e| {
            let name = e.file_name().to_string_lossy();
            name != "node_modules"
                && name != "target"
                && name != ".git"
                && name != ".forge"
                && name != ".forge_memory"
        }) {
            let entry = entry.map_err(|e| format!("WalkDir error: {}", e))?;
            let path = entry.path();
            let name = path.strip_prefix(&root_path_clone).unwrap_or(path);
            let name_str = name.to_string_lossy().replace("\\", "/");

            if name_str.is_empty() {
                continue;
            }

            if path.is_file() {
                zip.start_file(name_str, options)
                    .map_err(|e| format!("Failed to start zip file: {}", e))?;
                let mut f =
                    File::open(path).map_err(|e| format!("Failed to open file for zip: {}", e))?;
                let mut buffer = Vec::new();
                f.read_to_end(&mut buffer)
                    .map_err(|e| format!("Failed to read file for zip: {}", e))?;
                zip.write_all(&buffer)
                    .map_err(|e| format!("Failed to write to zip: {}", e))?;
            } else if path.is_dir() {
                zip.add_directory(name_str, options)
                    .map_err(|e| format!("Failed to add directory to zip: {}", e))?;
            }
        }
        zip.finish()
            .map_err(|e| format!("Failed to finish zip file: {}", e))?;
        Ok(())
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))??;

    // Read the generated zip file into base64
    let zip_bytes = tokio::fs::read(&zip_path)
        .await
        .map_err(|e| format!("Failed to read zip: {}", e))?;

    use base64::{Engine as _, engine::general_purpose};
    let b64 = general_purpose::STANDARD.encode(&zip_bytes);

    // Clean up temp file
    let _ = tokio::fs::remove_file(&zip_path).await;

    // Return base64 + filename (joined with a custom delimiter to easily parse on frontend)
    Ok(format!("{}|{}", zip_filename, b64))
}
