use rusqlite::{Connection, Result, params};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProjectRecord {
    pub id: String,
    pub name: String,
    pub path: String,
    pub environment_id: String,
    pub opened_at: i64,
}

pub fn get_db_path() -> PathBuf {
    let home_dir = home::home_dir().expect("Could not find home directory");
    let forge_dir = home_dir.join(".forge-ide");
    if !forge_dir.exists() {
        std::fs::create_dir_all(&forge_dir).expect("Failed to create .forge-ide directory");
    }
    forge_dir.join("forge.db")
}

pub fn init_db() -> Result<()> {
    let db_path = get_db_path();
    let conn = Connection::open(&db_path)?;

    // Create environments table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS environments (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            kind TEXT NOT NULL,
            detail TEXT NOT NULL,
            host TEXT,
            username TEXT,
            port INTEGER,
            private_key_path TEXT
        )",
        [],
    )?;

    // Create projects table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            path TEXT NOT NULL,
            environment_id TEXT NOT NULL,
            opened_at INTEGER NOT NULL,
            FOREIGN KEY(environment_id) REFERENCES environments(id)
        )",
        [],
    )?;

    // Create settings table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )",
        [],
    )?;

    // Create chat_sessions table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS chat_sessions (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            updated_at INTEGER NOT NULL
        )",
        [],
    )?;

    // Create chat_messages table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS chat_messages (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            FOREIGN KEY(session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
        )",
        [],
    )?;

    crate::debug_log!("Database initialized at {:?}", db_path);

    Ok(())
}

pub fn get_environments() -> Result<Vec<crate::messages::Environment>> {
    let conn = Connection::open(get_db_path())?;
    let mut stmt = conn.prepare(
        "SELECT id, name, kind, detail, host, username, port, private_key_path FROM environments",
    )?;
    let env_iter = stmt.query_map([], |row| {
        Ok(crate::messages::Environment {
            id: row.get(0)?,
            name: row.get(1)?,
            kind: row.get(2)?,
            detail: row.get(3)?,
            host: row.get(4)?,
            username: row.get(5)?,
            port: row.get(6)?,
            password: None,
            private_key_path: row.get(7)?,
            status: "disconnected".to_string(),
        })
    })?;

    let mut envs = Vec::new();
    for env in env_iter {
        envs.push(env?);
    }
    Ok(envs)
}

pub fn save_environment(env: &crate::messages::Environment) -> Result<()> {
    let conn = Connection::open(get_db_path())?;
    conn.execute(
        "INSERT INTO environments (id, name, kind, detail, host, username, port, private_key_path)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
         ON CONFLICT(id) DO UPDATE SET
         name=excluded.name, kind=excluded.kind, detail=excluded.detail, host=excluded.host, username=excluded.username, port=excluded.port, private_key_path=excluded.private_key_path",
        params![
            env.id, env.name, env.kind, env.detail, env.host, env.username, env.port, env.private_key_path
        ],
    )?;
    Ok(())
}

pub fn delete_environment(id: &str) -> Result<()> {
    let conn = Connection::open(get_db_path())?;
    conn.execute("DELETE FROM environments WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn delete_recent_project(id: &str) -> Result<()> {
    let conn = Connection::open(get_db_path())?;
    conn.execute("DELETE FROM projects WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn get_recent_projects() -> Result<Vec<ProjectRecord>> {
    let conn = Connection::open(get_db_path())?;
    let mut stmt = conn.prepare("SELECT id, name, path, environment_id, opened_at FROM projects ORDER BY opened_at DESC LIMIT 20")?;
    let proj_iter = stmt.query_map([], |row| {
        Ok(ProjectRecord {
            id: row.get(0)?,
            name: row.get(1)?,
            path: row.get(2)?,
            environment_id: row.get(3)?,
            opened_at: row.get(4)?,
        })
    })?;

    let mut projects = Vec::new();
    for proj in proj_iter {
        projects.push(proj?);
    }
    Ok(projects)
}

pub fn save_recent_project(proj: &ProjectRecord) -> Result<()> {
    let conn = Connection::open(get_db_path())?;
    conn.execute(
        "INSERT INTO projects (id, name, path, environment_id, opened_at)
         VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(id) DO UPDATE SET
         name=excluded.name, path=excluded.path, environment_id=excluded.environment_id, opened_at=excluded.opened_at",
        params![
            proj.id, proj.name, proj.path, proj.environment_id, proj.opened_at
        ],
    )?;
    Ok(())
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChatSessionRecord {
    pub id: String,
    pub title: String,
    pub updated_at: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChatMessageRecord {
    pub id: String,
    pub session_id: String,
    pub role: String,
    pub content: String,
    pub created_at: i64,
}

pub fn get_chat_sessions() -> Result<Vec<ChatSessionRecord>> {
    let conn = Connection::open(get_db_path())?;
    let mut stmt =
        conn.prepare("SELECT id, title, updated_at FROM chat_sessions ORDER BY updated_at DESC")?;
    let iter = stmt.query_map([], |row| {
        Ok(ChatSessionRecord {
            id: row.get(0)?,
            title: row.get(1)?,
            updated_at: row.get(2)?,
        })
    })?;

    let mut sessions = Vec::new();
    for s in iter {
        sessions.push(s?);
    }
    Ok(sessions)
}

pub fn save_chat_session(session: &ChatSessionRecord) -> Result<()> {
    let conn = Connection::open(get_db_path())?;
    conn.execute(
        "INSERT INTO chat_sessions (id, title, updated_at) VALUES (?1, ?2, ?3)
         ON CONFLICT(id) DO UPDATE SET title=excluded.title, updated_at=excluded.updated_at",
        params![session.id, session.title, session.updated_at],
    )?;
    Ok(())
}

pub fn delete_chat_session(id: &str) -> Result<()> {
    let conn = Connection::open(get_db_path())?;
    conn.execute("DELETE FROM chat_sessions WHERE id = ?1", params![id])?;
    // The foreign key cascade should delete messages, but if not enabled by default in sqlite connection,
    // we should explicitly delete them or ensure PRAGMA foreign_keys = ON.
    conn.execute(
        "DELETE FROM chat_messages WHERE session_id = ?1",
        params![id],
    )?;
    Ok(())
}

pub fn get_chat_messages(session_id: &str) -> Result<Vec<ChatMessageRecord>> {
    let conn = Connection::open(get_db_path())?;
    let mut stmt = conn.prepare("SELECT id, session_id, role, content, created_at FROM chat_messages WHERE session_id = ?1 ORDER BY created_at ASC")?;
    let iter = stmt.query_map(params![session_id], |row| {
        Ok(ChatMessageRecord {
            id: row.get(0)?,
            session_id: row.get(1)?,
            role: row.get(2)?,
            content: row.get(3)?,
            created_at: row.get(4)?,
        })
    })?;

    let mut messages = Vec::new();
    for m in iter {
        messages.push(m?);
    }
    Ok(messages)
}

pub fn delete_chat_message(id: &str) -> Result<()> {
    let conn = Connection::open(get_db_path())?;
    conn.execute("DELETE FROM chat_messages WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn save_chat_message(message: &ChatMessageRecord) -> Result<()> {
    let conn = Connection::open(get_db_path())?;
    conn.execute(
        "INSERT INTO chat_messages (id, session_id, role, content, created_at) VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(id) DO UPDATE SET role=excluded.role, content=excluded.content, created_at=excluded.created_at",
        params![message.id, message.session_id, message.role, message.content, message.created_at],
    )?;
    Ok(())
}
