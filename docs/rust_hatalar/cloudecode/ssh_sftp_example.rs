// Cargo.toml icin gerekli bagimliliklar (gercek versiyonlariniza gore ayarlayin):
//
// [dependencies]
// russh = "0.50"
// russh-sftp = "2"
// tokio = { version = "1", features = ["full"] }
// anyhow = "1"
//
// NOT: russh 0.50.x, eski bagimsiz `russh-keys` crate'ini ARTIK GOMULU olarak
// icinde barindiriyor: `russh::keys::*`. Ayrica `russh-keys` diye ayri bir
// bagimlilik EKLEMEYIN — cakisma ve E0432/E0433 hatalari tam da budan cikiyor.

use russh::client::{self, Session};
use russh::keys::key::{KeyPair, PrivateKeyWithHashAlg};
use russh::keys::PublicKey;
use russh::{ChannelId, ChannelOpenFailure, Preferred};
use russh_sftp::client::SftpSession;
use russh_sftp::protocol::OpenFlags;
use std::borrow::Cow;
use std::sync::Arc;
use tokio::io::{AsyncReadExt, AsyncWriteExt};

struct ClientHandler;

// russh 0.43+ ile Handler artik native "async fn in trait" kullaniyor:
// `&mut self`, tuple donusu yok, `async_trait` makrosuna gerek yok.
impl client::Handler for ClientHandler {
    type Error = anyhow::Error;

    async fn check_server_key(&mut self, server_public_key: &PublicKey) -> Result<bool, Self::Error> {
        println!("Sunucu anahtari: {:?}", server_public_key);
        // Uretimde: bilinen_host dosyasiyla karsilastirin, korusuzca true donmeyin.
        Ok(true)
    }

    async fn channel_open_confirmation(
        &mut self,
        id: ChannelId,
        max_packet_size: u32,
        window_size: u32,
        _session: &mut Session,
    ) -> Result<(), Self::Error> {
        println!("Kanal acildi: {id:?} (max_packet_size={max_packet_size}, window_size={window_size})");
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
        eprintln!("Kanal acilamadi {channel:?}: {reason:?} - {description} ({language})");
        Ok(())
    }
}

async fn connect_and_sftp(
    host: &str,
    port: u16,
    username: &str,
    password: Option<&str>,
) -> anyhow::Result<SftpSession> {
    let config = client::Config {
        preferred: Preferred {
            // Preferred::kex alaninin Owned karsiligi Vec<Name>'dir; Box'a
            // cevirmeye calismak (E0271) tam da bu satirdaki hataya sebep oluyordu.
            kex: Cow::Owned(vec![
                "curve25519-sha256@libssh.org".parse().unwrap(),
                "ecdh-sha2-nistp256".parse().unwrap(),
                "diffie-hellman-group14-sha256".parse().unwrap(),
            ]),
            ..Default::default()
        },
        ..Default::default()
    };

    let mut session = client::connect(Arc::new(config), (host, port), ClientHandler).await?;

    let auth_ok = if let Some(pwd) = password {
        session.authenticate_password(username, pwd).await?.success()
    } else {
        let key_pair = KeyPair::generate_ed25519().expect("anahtar uretilemedi");
        session
            .authenticate_publickey(
                username,
                // Ed25519 icin hash_alg onemsiz; RSA kullaniyorsaniz
                // `session.best_supported_rsa_hash().await?.flatten()` verin.
                PrivateKeyWithHashAlg::new(Arc::new(key_pair), None),
            )
            .await?
            .success()
    };

    if !auth_ok {
        anyhow::bail!("SSH kimlik dogrulamasi basarisiz");
    }

    let channel = session.channel_open_session().await?;
    channel.request_subsystem(true, "sftp").await?;

    // Kilit nokta: Channel artik dogrudan AsyncRead/AsyncWrite degil.
    // `into_stream()` ChannelMsg::Data uzerinden okuma/yazma yapan bir
    // AsyncRead+AsyncWrite adaptoru dondurur — SftpSession bunu bekliyor.
    let stream = channel.into_stream();
    let sftp = SftpSession::new(stream).await?;

    Ok(sftp)
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let sftp = connect_and_sftp("127.0.0.1", 22, "kullanici", Some("sifre")).await?;

    // Dizin listeleme: read_dir stream degil, dogrudan iterate edilebilir.
    for entry in sftp.read_dir(".").await? {
        println!("{}", entry.file_name());
    }

    // Dosya okuma: open() tek argumandir (varsayilan READ modu).
    // Ekstra bayrak gerekiyorsa open_with_flags(path, flags) kullanin.
    let mut file = sftp.open("uzak_dosya.txt").await?;
    let mut buf = String::new();
    file.read_to_string(&mut buf).await?;
    println!("Icerik: {buf}");

    // Yazma icin flags gerektiginde:
    let mut wfile = sftp
        .open_with_flags("uzak_dosya.txt", OpenFlags::WRITE | OpenFlags::CREATE)
        .await?;
    wfile.write_all(b"merhaba forge").await?;
    wfile.shutdown().await?;

    Ok(())
}
