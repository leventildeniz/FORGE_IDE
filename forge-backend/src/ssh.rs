use async_trait::async_trait;
use russh::client::{Config, Handle, Handler};
use russh_keys::key::{KeyPair, PublicKey};
use russh_sftp::client::SftpSession;
use ssh_key::{LineEnding, PrivateKey, rand_core::OsRng};
use std::sync::Arc;

pub struct ClientHandler;

#[async_trait]
impl Handler for ClientHandler {
    type Error = russh::Error;
    async fn check_server_key(
        self,
        _server_public_key: &PublicKey,
    ) -> Result<(Self, bool), Self::Error> {
        // Geliştirme kolaylığı için şimdilik tüm sunucu anahtarlarını kabul et.
        Ok((self, true))
    }
}

// SSH bağlantısı ve kimlik doğrulama
pub async fn connect_and_authenticate(
    host: &str,
    port: u16,
    username: String,
    private_key_path_or_pem: String,
) -> Result<Handle<ClientHandler>, String> {
    let config = Config::default();
    let mut handle = russh::client::connect(Arc::new(config), (host, port), ClientHandler)
        .await
        .map_err(|e| e.to_string())?;

    let pem_content = if std::path::Path::new(&private_key_path_or_pem).exists() {
        std::fs::read_to_string(&private_key_path_or_pem)
            .map_err(|e| format!("Failed to read private key file: {}", e))?
    } else {
        private_key_path_or_pem
    };

    let key_pair: KeyPair = russh_keys::decode_secret_key(&pem_content, None)
        .map_err(|e| format!("Key decode error: {}", e.to_string()))?;

    let is_authenticated = handle
        .authenticate_publickey(username, Arc::new(key_pair))
        .await
        .map_err(|e| format!("Auth error: {}", e.to_string()))?;

    if is_authenticated {
        Ok(handle)
    } else {
        Err("Authentication failed".to_string())
    }
}

// Yeni SSH anahtarı üretme, diske kaydetme ve yolunu/public key'ini döndürme
pub fn generate_ssh_key_pem() -> Result<(String, String), String> {
    let private_key =
        PrivateKey::random(&mut OsRng, ssh_key::Algorithm::Ed25519).map_err(|e| e.to_string())?;
    let private_pem = private_key
        .to_openssh(LineEnding::LF)
        .map_err(|e| e.to_string())?
        .to_string();
    let public_openssh = private_key
        .public_key()
        .to_openssh()
        .map_err(|e| e.to_string())?;

    let home_dir = home::home_dir().ok_or_else(|| "Could not find home directory".to_string())?;
    let ssh_dir = home_dir.join(".ssh");

    if !ssh_dir.exists() {
        std::fs::create_dir_all(&ssh_dir)
            .map_err(|e| format!("Failed to create .ssh dir: {}", e))?;
    }

    let key_name = format!(
        "forge_ed25519_{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs()
    );
    let private_key_path = ssh_dir.join(&key_name);
    let public_key_path = ssh_dir.join(format!("{}.pub", key_name));

    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        let mut options = std::fs::OpenOptions::new();
        options.write(true).create_new(true).mode(0o600);
        let mut file = options
            .open(&private_key_path)
            .map_err(|e| format!("Failed to save private key: {}", e))?;
        use std::io::Write;
        file.write_all(private_pem.as_bytes())
            .map_err(|e| format!("Failed to write private key: {}", e))?;
    }
    #[cfg(not(unix))]
    {
        std::fs::write(&private_key_path, private_pem)
            .map_err(|e| format!("Failed to save private key: {}", e))?;
    }

    std::fs::write(&public_key_path, &public_openssh)
        .map_err(|e| format!("Failed to save public key: {}", e))?;

    let path_str = private_key_path.to_string_lossy().to_string();

    Ok((path_str, public_openssh))
}

// SFTP istemcisini başlatma
pub async fn start_sftp_client(handle: &mut Handle<ClientHandler>) -> Result<SftpSession, String> {
    let channel = handle
        .channel_open_session()
        .await
        .map_err(|e| e.to_string())?;
    channel
        .request_subsystem(true, "sftp")
        .await
        .map_err(|e| format!("Failed to request SFTP subsystem: {}", e))?;

    let stream = channel.into_stream();
    let sftp = SftpSession::new(stream).await.map_err(|e| e.to_string())?;

    Ok(sftp)
}
