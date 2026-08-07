use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::process::Stdio;
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::Mutex;

#[derive(Debug, Serialize, Deserialize)]
pub struct JsonRpcRequest {
    pub jsonrpc: String,
    pub id: u64,
    pub method: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub params: Option<Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct JsonRpcNotification {
    pub jsonrpc: String,
    pub method: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub params: Option<Value>,
}
#[derive(Debug, Serialize, Deserialize)]
pub struct JsonRpcResponse {
    pub jsonrpc: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<Value>,
}

pub struct McpClient {
    child_process: Mutex<Option<Child>>,
    request_id_counter: Mutex<u64>,
}

impl McpClient {
    pub fn new() -> Arc<Self> {
        Arc::new(Self {
            child_process: Mutex::new(None),
            request_id_counter: Mutex::new(1),
        })
    }

    /// Spawns the MCP Server process via stdio and initializes it
    pub async fn start(&self, command: &str, args: &[&str]) -> Result<(), String> {
        #[cfg(target_os = "windows")]
        let mut cmd = {
            let mut c = Command::new("cmd");
            c.arg("/C");
            c.arg(command);
            for a in args {
                c.arg(a);
            }
            c
        };

        #[cfg(not(target_os = "windows"))]
        let mut cmd = {
            let mut c = Command::new("bash");
            c.arg("-c");
            // Use full path for npx if known or standard bash login to load nvm/node paths
            let full_cmd = format!(
                "source ~/.bashrc 2>/dev/null; {} {}",
                command,
                args.join(" ")
            );
            c.arg(&full_cmd);
            c
        };

        cmd.stdin(Stdio::piped());
        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());

        let child = cmd
            .spawn()
            .map_err(|e| format!("Failed to spawn MCP Server ({}): {}", command, e))?;
        {
            let mut lock = self.child_process.lock().await;
            *lock = Some(child);
        }

        // Protocol Handshake: Send 'initialize'
        let init_params = serde_json::json!({
            "protocolVersion": "2024-11-05",
            "clientInfo": {
                "name": "ForgeIDE",
                "version": "1.0.0"
            },
            "capabilities": {}
        });

        match self.send_request("initialize", Some(init_params)).await {
            Ok(_) => {
                // Send 'notifications/initialized'
                self.send_notification("notifications/initialized", None)
                    .await?;
                Ok(())
            }
            Err(e) => {
                self.stop().await;
                Err(format!("MCP Initialization handshake failed: {}", e))
            }
        }
    }

    /// Sends a JSON-RPC notification (no response expected)
    pub async fn send_notification(
        &self,
        method: &str,
        params: Option<Value>,
    ) -> Result<(), String> {
        let mut lock = self.child_process.lock().await;
        if let Some(child) = lock.as_mut() {
            let stdin = child.stdin.as_mut().ok_or("Failed to open stdin")?;
            let req = JsonRpcNotification {
                jsonrpc: "2.0".to_string(),
                method: method.to_string(),
                params,
            };
            let mut req_str = serde_json::to_string(&req).map_err(|e| e.to_string())?;
            req_str.push('\n');
            stdin
                .write_all(req_str.as_bytes())
                .await
                .map_err(|e| e.to_string())?;
            stdin.flush().await.map_err(|e| e.to_string())?;
            Ok(())
        } else {
            Err("MCP Client is not running".to_string())
        }
    }

    /// Sends a JSON-RPC request and waits for the specific matching response
    pub async fn send_request(&self, method: &str, params: Option<Value>) -> Result<Value, String> {
        let mut lock = self.child_process.lock().await;
        if let Some(child) = lock.as_mut() {
            let stdin = child.stdin.as_mut().ok_or("Failed to open stdin")?;

            // Get next Request ID
            let req_id = {
                let mut id_lock = self.request_id_counter.lock().await;
                let id = *id_lock;
                *id_lock += 1;
                id
            };

            let req = JsonRpcRequest {
                jsonrpc: "2.0".to_string(),
                id: req_id,
                method: method.to_string(),
                params,
            };

            let mut req_str = serde_json::to_string(&req).map_err(|e| e.to_string())?;
            req_str.push('\n');

            // Log the outgoing request for debugging
            crate::debug_log!("MCP Client: Sending request -> {}", req_str.trim());

            stdin
                .write_all(req_str.as_bytes())
                .await
                .map_err(|e| e.to_string())?;
            stdin.flush().await.map_err(|e| e.to_string())?;

            // Read the response from stdout
            let stdout = child.stdout.as_mut().ok_or("Failed to open stdout")?;
            let mut reader = BufReader::new(stdout);

            let timeout_duration = tokio::time::Duration::from_secs(15);

            let read_future = async {
                loop {
                    let mut line = String::new();
                    match reader.read_line(&mut line).await {
                        Ok(bytes_read) if bytes_read > 0 => {
                            let trimmed_line = line.trim();
                            // Log incoming lines for debugging
                            if trimmed_line.starts_with('{') {
                                crate::debug_log!("MCP Client: Received -> {}", trimmed_line);
                            }

                            // MCP Servers (especially npx) can be very chatty.
                            // We MUST ignore anything that isn't a valid JSON-RPC response.
                            if trimmed_line.starts_with('{')
                                && trimmed_line.contains(r#""jsonrpc""#)
                            {
                                if let Ok(response) = serde_json::from_str::<JsonRpcResponse>(&line)
                                {
                                    if response.id == Some(req_id) {
                                        if let Some(err) = response.error {
                                            return Err(format!("MCP Error: {}", err));
                                        }
                                        if let Some(res) = response.result {
                                            return Ok(res);
                                        }
                                        return Ok(serde_json::json!({}));
                                    }
                                }
                            }
                        }
                        Ok(_) => {
                            return Err("MCP Server closed the connection unexpectedly".to_string());
                        }
                        Err(e) => return Err(format!("Failed to read from MCP stdout: {}", e)),
                    }
                }
            };

            match tokio::time::timeout(timeout_duration, read_future).await {
                Ok(res) => res,
                Err(_) => {
                    Err("MCP request timed out waiting for a valid JSON-RPC response".to_string())
                }
            }
        } else {
            Err("MCP Client is not running".to_string())
        }
    }

    /// Stops the child process
    pub async fn stop(&self) {
        let mut lock = self.child_process.lock().await;
        if let Some(mut child) = lock.take() {
            let _ = child.kill().await;
        }
    }
}
