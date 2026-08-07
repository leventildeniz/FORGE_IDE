use russh::client::Session;
use russh::keys::key::{KeyPair, PrivateKeyWithHashAlg};
use russh::keys::{HashAlg, PublicKey};
use russh::{client, ChannelId, ChannelOpenFailure, Preferred};
use russh_sftp::{
    client::{error::Error as SftpClientError, SftpSession},
    protocol::{FileAttributes, FileType, OpenFlags},
};
use std::borrow::Cow;
use std::fmt;
use std::sync::Arc;
use tokio::io::{AsyncReadExt, AsyncWriteExt};

#[derive(Debug)]
pub enum SshError {
    ConnectionError(russh::Error),
    AuthError(russh::Error),
    SftpError(SftpClientError),
    IoError(std::io::Error),
    Utf8Error(std::string::FromUtf8Error),
    GenericError(String),
}

impl fmt::Display for SshError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            SshError::ConnectionError(e) => write!(f, "SSH connection error: {}", e),
            SshError::AuthError(e) => write!(f, "SSH authentication error: {}", e),
            SshError::SftpError(e) => write!(f, "SFTP error: {:?}", e),
            SshError::IoError(e) => write!(f, "IO error: {}", e),
            SshError::Utf8Error(e) => write!(f, "UTF-8 conversion error: {}", e),
            SshError::GenericError(s) => write!(f, "Generic error: {}", s),
        }
    }
}

impl From<russh::Error> for SshError {
    fn from(e: russh::Error) -> Self {
        SshError::ConnectionError(e)
    }
}

impl From<SftpClientError> for SshError {
    fn from(e: SftpClientError) -> Self {
        SshError::SftpError(e)
    }
}

impl From<std::io::Error> for SshError {
    fn from(e: std::io::Error) -> Self {
        SshError::IoError(e)
    }
}

impl From<std::string::FromUtf8Error> for SshError {
    fn from(e: std::string::FromUtf8Error) -> Self {
        SshError::Utf8Error(e)
    }
}

#[derive(Clone)]
pub struct ClientHandler {
    // Client-specific state can be held here
}

impl ClientHandler {
    pub fn new() -> Self {
        ClientHandler {}
    }
}

// NOT: russh >=0.43 ile Handler trait'i artik `&mut self` + `&mut Session` kullanıyor
// ve degerleri tuple icinde geri dondurmuyor (E0195 buradan geliyordu).
// async_trait'e de gerek yok; native "async fn in trait" destekleniyor.
impl client::Handler for ClientHandler {
    type Error = SshError;

    async fn check_server_key(
        &mut self,
        server_public_key: &PublicKey,
    ) -> Result<bool, Self::Error> {
        println!("Server Public Key: {:?}", server_public_key);
        Ok(true)
    }

    async fn channel_open_confirmation(
        &mut self,
        channel: ChannelId,
        max_packet_size: u32,
        window_size: u32,
        _session: &mut Session,
    ) -> Result<(), Self::Error> {
        println!(
            "Channel open confirmation for channel {:?} (max_packet_size={}, window_size={})",
            channel, max_packet_size, window_size
        );
        Ok(())
    }

    async fn channel_open_failure(
        &mut self,
        channel: ChannelId,
        reason: ChannelOpenFailure,
        description: &str,
        language: &str,
        _session: &mut Session,
    ) -> Result<(), Self::Error> {
        eprintln!(
            "Channel open failure for channel {:?}, reason: {:?}, description: {}, language: {}",
            channel, reason, description, language
        );
        Ok(())
    }
}

pub struct RealSshClient {
    #[allow(dead_code)]
    session: client::Handle<ClientHandler>,
    sftp_session: SftpSession,
}

impl RealSshClient {
    pub async fn new(host: String, port: u16, username: String, password: Option<String>) -> Result<Self, SshError> {
        let config = client::Config {
            inactivity_timeout: Some(std::time::Duration::from_secs(30)),
            preferred: Preferred {
                // Preferred::kex artik `Cow<'static, [kex::Name]>` ve bunun `Owned` karsiligi
                // `Vec<Name>` (bkz. `impl ToOwned for [T]`). `.into_boxed_slice()` cagirmak
                // Box<[Name]> uretiyor ve bu da Cow::Owned ile uyusmuyordu (E0271).
                // Cozum: Vec'i dogrudan Cow::Owned icine vermek.
                kex: Cow::Owned(vec![
                    "curve25519-sha256@libssh.org".parse().unwrap(),
                    "ecdh-sha2-nistp256".parse().unwrap(),
                    "ecdh-sha2-nistp384".parse().unwrap(),
                    "ecdh-sha2-nistp521".parse().unwrap(),
                    "diffie-hellman-group16-sha512".parse().unwrap(),
                    "diffie-hellman-group18-sha512".parse().unwrap(),
                    "diffie-hellman-group14-sha256".parse().unwrap(),
                ]),
                ..Default::default()
            },
            ..Default::default()
        };

        let sh = ClientHandler::new();
        let session = client::connect(Arc::new(config), (host.clone(), port), sh).await?;

        let auth_result = if let Some(pwd) = password {
            session.authenticate_password(&username, &pwd).await?
        } else {
            let key = KeyPair::generate_ed25519().unwrap();
            // authenticate_publickey artik `PrivateKeyWithHashAlg` bekliyor, cıplak
            // `Arc<KeyPair>` degil (E0308). RSA olmayan anahtarlar icin hash_alg
            // gormezden gelinir, bu yuzden None gecmek guvenli.
            session
                .authenticate_publickey(
                    &username,
                    // RSA olmayan (ed25519) anahtarlarda hash_alg gormezden gelinir;
                    // RSA kullaniyorsaniz `session.best_supported_rsa_hash().await?.flatten()`
                    // ile sunucunun destekledigi en iyi algoritmayi otomatik secebilirsiniz.
                    PrivateKeyWithHashAlg::new(Arc::new(key), None::<HashAlg>),
                )
                .await?
        };

        // authenticate_* artik `bool` degil `AuthResult` donduruyor (E0308).
        // AuthResult::success() basari durumunu kontrol eden helper.
        if !auth_result.success() {
            return Err(SshError::AuthError(russh::Error::Disconnect));
        }

        let channel = session.channel_open_session().await?;
        // Channel artik dogrudan AsyncRead/AsyncWrite degil. `into_stream()` ile
        // ChannelMsg::Data alip/gonderen bir AsyncRead+AsyncWrite stream'e cevriliyor
        // (E0624 / E0061 buradan geliyordu — ChannelStream::new artik private ve
        // farklı bir imzaya sahip).
        channel.request_subsystem(true, "sftp").await?;
        let stream = channel.into_stream();
        let sftp_session = SftpSession::new(stream).await?;

        Ok(Self { session, sftp_session })
    }

    pub async fn sftp_list_dir(&self, path: &str) -> Result<Vec<(String, FileAttributes)>, SshError> {
        let mut entries = Vec::new();
        // read_dir artik bir Stream degil, dogrudan iterate edilebilir bir
        // koleksiyon donduruyor (Vec<DirEntry> benzeri) — `.next().await` yerine
        // normal `for` dongusu kullanilir (E0277 buradan geliyordu).
        let read_dir_entries = self.sftp_session.read_dir(path).await?;

        for entry in read_dir_entries {
            entries.push((entry.file_name(), entry.metadata()));
        }
        Ok(entries)
    }

    pub async fn sftp_read_file(&self, path: &str) -> Result<String, SshError> {
        // `open()` yardimci metodu tek argüman alir ve varsayilan olarak READ modunda
        // acar; ekstra OpenFlags icin `open_with_flags` kullanilmali (E0061).
        let mut file = self.sftp_session.open(path).await?;
        let mut bytes = Vec::new();
        file.read_to_end(&mut bytes).await?;
        Ok(String::from_utf8(bytes)?)
    }

    pub async fn sftp_write_file(&self, path: &str, content: &str) -> Result<(), SshError> {
        let mut file = self.sftp_session.create(path).await?;
        file.write_all(content.as_bytes()).await?;
        file.shutdown().await?;
        Ok(())
    }

    pub async fn sftp_create_file(&self, path: &str) -> Result<(), SshError> {
        self.sftp_session.create(path).await?;
        Ok(())
    }

    pub async fn sftp_create_dir(&self, path: &str) -> Result<(), SshError> {
        self.sftp_session.create_dir(path).await?;
        Ok(())
    }

    pub async fn sftp_delete_path(&self, path: &str) -> Result<(), SshError> {
        // SftpClientError::IO artik std::io::Error degil bir String tasiyor, bu yuzden
        // `.kind()` cagrilamiyordu (E0599). En saglam yaklasim: silmeden once
        // metadata ile turu kontrol etmek, hataya gore ayirt etmeye calismamak.
        match self.sftp_session.metadata(path).await {
            Ok(attrs) if attrs.is_dir() => {
                self.sftp_session.remove_dir(path).await?;
            }
            _ => {
                self.sftp_session.remove_file(path).await?;
            }
        }
        Ok(())
    }

    pub async fn sftp_rename_path(&self, old_path: &str, new_path: &str) -> Result<(), SshError> {
        self.sftp_session.rename(old_path, new_path).await?;
        Ok(())
    }

    pub async fn sftp_set_attributes(&self, path: &str, attrs: FileAttributes) -> Result<(), SshError> {
        self.sftp_session.set_metadata(path, attrs).await?;
        Ok(())
    }

    pub async fn sftp_get_attributes(&self, path: &str) -> Result<FileAttributes, SshError> {
        let attrs = self.sftp_session.metadata(path).await?;
        Ok(attrs)
    }
}
