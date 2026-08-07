use tokio::fs;
use serde::{Serialize, Deserialize};
use std::path::{Path, PathBuf};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileNode {
    pub path: String,
    pub name: String,
    pub is_dir: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<FileNode>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<String>,
}

// Helper to get absolute path (canonicalize can fail if path doesn't exist yet, so we handle it)
async fn get_absolute_path(p: &Path) -> PathBuf {
    if let Ok(abs_path) = p.canonicalize().await {
        abs_path
    } else {
        // Fallback to absolute path relative to current dir if canonicalize fails (e.g. for non-existent paths)
        let mut current_dir = tokio::env::current_dir().unwrap_or_default();
        current_dir.push(p);
        current_dir
    }
}

pub async fn list_dir_contents(path: &str, recursive: bool) -> Result<Vec<FileNode>, String> {
    let base_path = PathBuf::from(path);
    let abs_base_path = get_absolute_path(&base_path).await; // Ensure base path is absolute
    let mut entries = fs::read_dir(&abs_base_path).await.map_err(|e| e.to_string())?;
    let mut nodes = Vec::new();

    while let Some(entry) = entries.next_entry().await.map_err(|e| e.to_string())? {
        let entry_path = entry.path();
        let file_name = entry_path.file_name().unwrap_or_default().to_string_lossy().into_owned();

        // Ignore hidden files/folders, build artifacts, git
        if file_name.starts_with(\".\") || file_name == \"target\" || file_name == \"node_modules\" || file_name == \".git\" {
            continue;
        }

        let metadata = fs::metadata(&entry_path).await.map_err(|e| e.to_string())?;
        let is_dir = metadata.is_dir();
        let abs_entry_path = get_absolute_path(&entry_path).await; // Ensure entry path is absolute

        let mut node = FileNode {
            path: abs_entry_path.to_string_lossy().into_owned(),
            name: file_name,
            is_dir,
            children: None,
            content: None,
        };

        if is_dir && recursive {
            // Recursively list children
            match list_dir_contents(&abs_entry_path.to_string_lossy(), true).await {
                Ok(children_nodes) => node.children = Some(children_nodes),
                Err(e) => eprintln!(\"Error reading recursive directory {}: {}\", abs_entry_path.display(), e), // Log error but continue
            }
        } else if is_dir {
            // If not recursive, just indicate it's a directory (empty children list for now, will fetch on expand)
            node.children = Some(vec![]);
        }
        nodes.push(node);
    }

    nodes.sort_by(|a, b| {
        if a.is_dir && !b.is_dir { std::cmp::Ordering::Less }
        else if !a.is_dir && b.is_dir { std::cmp::Ordering::Greater }
        else { a.name.cmp(&b.name) }
    });

    Ok(nodes)
}

pub async fn read_file_content(path: &str) -> Result<String, String> {
    let abs_path = get_absolute_path(&PathBuf::from(path)).await;
    fs::read_to_string(&abs_path).await.map_err(|e| e.to_string())
}

pub async fn write_file_content(path: &str, content: &str) -> Result<(), String> {
    let abs_path = get_absolute_path(&PathBuf::from(path)).await;
    fs::write(&abs_path, content).await.map_err(|e| e.to_string())
}

pub async fn create_file(path: &str) -> Result<(), String> {
    let abs_path = get_absolute_path(&PathBuf::from(path)).await;
    fs::File::create(&abs_path).await.map_err(|e| e.to_string())?;
    Ok(())
}

pub async fn create_dir(path: &str) -> Result<(), String> {
    let abs_path = get_absolute_path(&PathBuf::from(path)).await;
    fs::create_dir_all(&abs_path).await.map_err(|e| e.to_string())?;
    Ok(())
}

pub async fn delete_path(path: &str) -> Result<(), String> {
    let abs_path = get_absolute_path(&PathBuf::from(path)).await;
    let metadata = fs::metadata(&abs_path).await.map_err(|e| e.to_string())?;
    if metadata.is_dir() {
        fs::remove_dir_all(&abs_path).await.map_err(|e| e.to_string())?;
    } else {
        fs::remove_file(&abs_path).await.map_err(|e| e.to_string())?;
    }
    Ok(())
}
