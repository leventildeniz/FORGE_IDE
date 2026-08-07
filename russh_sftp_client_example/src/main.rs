use std::sync::Arc;
use tokio::{self, net::TcpStream};
use russh::{
    client::{self, Config},
    keys::{self, PrivateKey},
    kex,
};
use russh_sftp::{self, client::Handle as SftpHandle};
use futures::StreamExt;
use rand::rngs::OsRng;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 1. Key Generation
    // Generate an ED25519 key pair
    let mut rng = OsRng;
    let key_pair = keys::key_pair::KeyPair::generate(&mut rng, russh::keys::key_pair::ED25519)
        .expect("Failed to generate key pair");
    let private_key = key_pair.into_private_key();
    let private_key_with_hash_alg = PrivateKey::from(private_key);

    // Print the public key for the user to add to authorized_keys on the server
    println!("Generated Public Key (add this to ~/.ssh/authorized_keys on the server for user 'testuser'):");
    println!("{}", private_key_with_hash_alg.public_key_base64_standard()?);

    // 2. Client Configuration
    let config = Config {
        // Define preferred key exchange algorithms
        // kex::CURVES includes a recommended set of strong key exchange algorithms.
        // You can customize this list if needed.
        kex: kex::CURVES.to_vec(),
        auth_rejection_time: std::time::Duration::from_secs(3),
        // Add the generated private key for public-key authentication
        keys: vec![private_key_with_hash_alg.clone()], // Clone for authentication later
        ..Default::default()
    };
    let config = Arc::new(config);

    // 3. Establish SSH Connection
    // IMPORTANT: Replace "127.0.0.1:22" with your SSH server's address and port.
    // Ensure an SSH server is running and accessible at this address.
    println!("Attempting to connect to SSH server at 127.0.0.1:22...");
    let stream = TcpStream::connect("127.0.0.1:22").await.map_err(|e| format!("Failed to connect to SSH server: {}", e))?;
    let mut client = client::connect(config, stream, None).await.map_err(|e| format!("Failed to establish SSH connection: {}", e))?;
    println!("SSH connection established.");

    // Authenticate with username and the generated private key for public-key authentication
    let username = "testuser"; // Replace with your SSH username on the server
    println!("Attempting public key authentication for user '{}'...", username);
    let auth_result = client.authenticate_publickey(username, Arc::new(private_key_with_hash_alg)).await;

    if let Err(e) = auth_result {
        eprintln!("Public key authentication failed for user '{}'. Error: {:?}", username, e);
        eprintln!("Please ensure:");
        eprintln!("  1. The SSH server is running at 127.0.0.1:22.");
        eprintln!("  2. The user '{}' exists on the server.", username);
        eprintln!("  3. The public key printed above is added to '~/.ssh/authorized_keys' for user '{}' on the server.", username);
        eprintln!("  4. File permissions for '~/.ssh' and '~/.ssh/authorized_keys' are correct (e.g., chmod 700 ~/.ssh, chmod 600 ~/.ssh/authorized_keys).");
        return Ok(());
    }
    println!("SSH authentication successful for user '{}'.", username);

    // 4. SFTP Operations
    // Open a channel and request SFTP subsystem
    let mut channel = client.channel_open_session().await?;
    channel.exec(true, "sftp").await?;

    let mut sftp_client = russh_sftp::client::Client::new(channel);

    println!("\n--- SFTP Operations ---");

    // Create a directory
    let dir_path = "test_sftp_dir";
    println!("Creating directory: {}", dir_path);
    match sftp_client.create_dir(dir_path).await {
        Ok(_) => println!("Directory '{}' created.", dir_path),
        Err(e) => eprintln!("Failed to create directory {}: {:?}. It might already exist.", dir_path, e),
    }

    // Write a file
    let file_path = format!("{}/test_file.txt", dir_path);
    let file_content = b"Hello from russh-sftp!";
    println!("Creating and writing to file: {}", file_path);
    match sftp_client.create_file(&file_path).await {
        Ok(mut file) => {
            match file.write(file_content).await {
                Ok(_) => println!("File '{}' written with content: '{}'", file_path, std::str::from_utf8(file_content)?),
                Err(e) => eprintln!("Failed to write to file {}: {:?}", file_path, e),
            }
            if let Err(e) = file.close().await {
                eprintln!("Failed to close file {}: {:?}", file_path, e);
            }
        },
        Err(e) => eprintln!("Failed to create file {}: {:?}", file_path, e),
    }

    // Read a file
    println!("Reading file: {}", file_path);
    match sftp_client.open(&file_path).await {
        Ok(mut file) => {
            let mut buffer = Vec::new();
            match file.read_to_end(&mut buffer).await {
                Ok(_) => println!("Content of '{}': '{}'", file_path, std::str::from_utf8(&buffer)?),
                Err(e) => eprintln!("Failed to read file {}: {:?}", file_path, e),
            }
            if let Err(e) = file.close().await {
                eprintln!("Failed to close file {}: {:?}", file_path, e);
            }
        },
        Err(e) => eprintln!("Failed to open file {}: {:?}. It might not exist.", file_path, e),
    }

    // List directory contents
    println!("Listing directory contents for: {}", dir_path);
    match sftp_client.read_dir(dir_path).await {
        Ok(entries) => {
            println!("Contents of '{}':", dir_path);
            for entry in entries {
                println!("  - {{:?}}", entry);
            }
        }
        Err(e) => eprintln!("Failed to read directory {}: {:?}", dir_path, e),
    }

    // Remove the file
    println!("Removing file: {}", file_path);
    match sftp_client.remove_file(&file_path).await {
        Ok(_) => println!("File '{}' removed.", file_path),
        Err(e) => eprintln!("Failed to remove file {}: {:?}. It might not exist.", file_path, e),
    }

    // Remove the directory
    println!("Removing directory: {}", dir_path);
    match sftp_client.remove_dir(dir_path).await {
        Ok(_) => println!("Directory '{}' removed.", dir_path),
        Err(e) => eprintln!("Failed to remove directory {}: {:?}. It might not be empty or not exist.", dir_path, e),
    }

    println!("\nSFTP operations completed.");

    Ok(())
}
