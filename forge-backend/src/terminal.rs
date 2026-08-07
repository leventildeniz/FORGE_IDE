use portable_pty::{CommandBuilder, NativePtySystem, PtySize, PtySystem};
use std::io::{Read, Write};
use std::sync::Arc;
use tokio::sync::{Mutex, mpsc};
use tokio::task;

// A handle to interact with the terminal from the WebSocket receiver task.
pub enum TerminalType {
    Local {
        pty_master: Arc<Mutex<Box<dyn portable_pty::MasterPty + Send>>>,
    },
    Ssh {
        resize_tx: mpsc::UnboundedSender<(u16, u16)>,
    },
}

pub struct TerminalHandle {
    pub t_type: TerminalType,
    pub input_tx: mpsc::UnboundedSender<String>,
}

impl TerminalHandle {
    pub fn resize(&self, cols: u16, rows: u16) {
        match &self.t_type {
            TerminalType::Local { pty_master } => {
                let master = pty_master.clone();
                tokio::task::spawn_blocking(move || {
                    if let Ok(m) = master.try_lock() {
                        let _ = (**m).resize(PtySize {
                            rows,
                            cols,
                            pixel_width: 0,
                            pixel_height: 0,
                        });
                    }
                });
            }
            TerminalType::Ssh { resize_tx } => {
                let _ = resize_tx.send((cols, rows));
            }
        }
    }

    pub fn write_input(&self, data: String) {
        let _ = self.input_tx.send(data);
    }
}

pub fn spawn_local_terminal(
    terminal_id: String,
    cwd: String,
    cols: u16,
    rows: u16,
    is_wsl: bool,
    client_sender: tokio::sync::mpsc::UnboundedSender<warp::ws::Message>,
) -> Result<TerminalHandle, Box<dyn std::error::Error + Send + Sync>> {
    let pty_system = NativePtySystem::default();

    let pair = pty_system.openpty(PtySize {
        rows,
        cols,
        pixel_width: 0,
        pixel_height: 0,
    })?;

    let mut cmd = if is_wsl {
        let mut c = CommandBuilder::new("wsl.exe");
        c.cwd(cwd); // Not sure if wsl.exe respects cwd this way, but we try
        c
    } else {
        #[cfg(target_os = "windows")]
        let mut c = CommandBuilder::new("powershell.exe");
        #[cfg(not(target_os = "windows"))]
        let mut c = CommandBuilder::new("bash");

        c.cwd(cwd);
        c
    };

    let _child = pair.slave.spawn_command(cmd)?;
    let master = Arc::new(Mutex::new(pair.master));

    // Writer task
    let (input_tx, mut input_rx) = mpsc::unbounded_channel::<String>();
    let master_for_writer = master.clone();

    task::spawn(async move {
        let writer = {
            let m = master_for_writer.lock().await;
            (**m).take_writer()
        };
        if let Ok(mut writer) = writer {
            while let Some(data) = input_rx.recv().await {
                let _ = writer.write_all(data.as_bytes());
                let _ = writer.flush();
            }
        }
    });

    // Reader task
    let master_for_reader = master.clone();
    let term_id_clone = terminal_id.clone();

    task::spawn_blocking(move || {
        let reader = {
            if let Ok(m) = master_for_reader.try_lock() {
                (**m).try_clone_reader()
            } else {
                return;
            }
        };

        if let Ok(mut reader) = reader {
            let mut buf = [0u8; 1024];
            while let Ok(n) = reader.read(&mut buf) {
                if n == 0 {
                    break;
                }
                let data = String::from_utf8_lossy(&buf[..n]).to_string();
                let msg = crate::messages::BackendResponse::TerminalOutput {
                    terminal_id: term_id_clone.clone(),
                    data,
                };
                let ws_msg = warp::ws::Message::text(serde_json::to_string(&msg).unwrap());
                if client_sender.send(ws_msg).is_err() {
                    break;
                }
            }

            // Send closed event
            let msg = crate::messages::BackendResponse::TerminalClosed {
                terminal_id: term_id_clone,
            };
            let _ = client_sender.send(warp::ws::Message::text(
                serde_json::to_string(&msg).unwrap(),
            ));
        }
    });

    Ok(TerminalHandle {
        t_type: TerminalType::Local { pty_master: master },
        input_tx,
    })
}

pub fn spawn_ssh_terminal(
    terminal_id: String,
    mut channel: russh::Channel<russh::client::Msg>,
    client_sender: tokio::sync::mpsc::UnboundedSender<warp::ws::Message>,
) -> TerminalHandle {
    let (input_tx, mut input_rx) = mpsc::unbounded_channel::<String>();
    let (resize_tx, mut resize_rx) = mpsc::unbounded_channel::<(u16, u16)>();

    let term_id_clone = terminal_id.clone();

    task::spawn(async move {
        loop {
            tokio::select! {
                // Resize requests
                Some((cols, rows)) = resize_rx.recv() => {
                    let _ = channel.window_change(cols as u32, rows as u32, 0, 0).await;
                }
                // Input data from user
                Some(data) = input_rx.recv() => {
                    let _ = channel.data(data.as_bytes()).await;
                }
                // Output data from ssh channel
                msg = channel.wait() => {
                    match msg {
                        Some(russh::ChannelMsg::Data { data }) => {
                            let text = String::from_utf8_lossy(&data).to_string();
                            let resp = crate::messages::BackendResponse::TerminalOutput {
                                terminal_id: term_id_clone.clone(),
                                data: text,
                            };
                            let ws_msg = warp::ws::Message::text(serde_json::to_string(&resp).unwrap());
                            if client_sender.send(ws_msg).is_err() {
                                break;
                            }
                        }
                        Some(russh::ChannelMsg::ExtendedData { data, .. }) => {
                            let text = String::from_utf8_lossy(&data).to_string();
                            let resp = crate::messages::BackendResponse::TerminalOutput {
                                terminal_id: term_id_clone.clone(),
                                data: text,
                            };
                            let ws_msg = warp::ws::Message::text(serde_json::to_string(&resp).unwrap());
                            if client_sender.send(ws_msg).is_err() {
                                break;
                            }
                        }
                        Some(russh::ChannelMsg::Eof) | Some(russh::ChannelMsg::Close) | None => {
                            // Close event
                            let msg = crate::messages::BackendResponse::TerminalClosed {
                                terminal_id: term_id_clone.clone(),
                            };
                            let _ = client_sender.send(warp::ws::Message::text(
                                serde_json::to_string(&msg).unwrap(),
                            ));
                            break;
                        }
                        _ => {}
                    }
                }
            }
        }
    });

    TerminalHandle {
        t_type: TerminalType::Ssh { resize_tx },
        input_tx,
    }
}
