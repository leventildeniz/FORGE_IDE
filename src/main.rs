use warp::ws::{Message, WebSocket};
use warp::Filter;
use futures_util::{StreamExt, SinkExt};
use tokio::sync::mpsc;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use serde_json;
use serde_json::json; // Add json! macro

mod filesystem; // Add our filesystem module
mod messages;   // Add our messages module

// A simple connection management for broadcast purposes (optional for echo but good for future)
type Clients = Arc<Mutex<HashMap<usize, mpsc::UnboundedSender<Message>>>>;

#[tokio::main]
async fn main() {
    let clients = Clients::default();

    // The WebSocket route
    let ws_route = warp::path("ws")
        .and(warp::ws())
        .and(with_clients(clients.clone()))
        .map(|ws: warp::ws::Ws, clients| {
            ws.on_upgrade(move |socket| client_connected(socket, clients))
        });

    // Combined routes
    let routes = ws_route.with(warp::cors().allow_any_origin());

    // Ensure listening on 0.0.0.0 to be accessible from outside WSL
    println!("Forge Backend listening on ws://0.0.0.0:3030/ws");
    warp::serve(routes)
        .run(([0, 0, 0, 0], 3030)) // THIS LINE MUST BE [0, 0, 0, 0]
        .await;
}

fn with_clients(clients: Clients) -> impl Filter<Extract = (Clients,), Error = std::convert::Infallible> + Clone {
    warp::any().map(move || clients.clone())
}

async fn client_connected(ws: WebSocket, clients: Clients) {
    let (mut client_ws_tx, mut client_ws_rx) = ws.split();
    let (tx, mut rx) = mpsc::unbounded_channel();

    // Every message from the server will be sent down this tx.
    tokio::task::spawn(async move {
        while let Some(message) = rx.recv().await {
            if let Err(e) = client_ws_tx.send(message).await {
                eprintln!("websocket send error: {}", e);
            }
        }
    });

    // Store the sender in our list of connected clients (for broadcasting, etc.)
    let my_id = rand::random::<usize>(); // Use rand::random() for simple unique ID
    clients.lock().unwrap().insert(my_id, tx.clone());
    
    println!("Client connected: {}", my_id);

    // Read messages from client and process them
    while let Some(result) = client_ws_rx.next().await {
        let msg = match result {
            Ok(msg) => msg,
            Err(e) => {
                eprintln!("websocket error(uid={}): {}", my_id, e);
                break;
            }
        };

        if msg.is_text() {
            let response = handle_websocket_message(msg.to_str().unwrap_or_default()).await;
            let json_response = serde_json::to_string(&response)
                .unwrap_or_else(|e| {
                    // Fallback to a simpler, hardcoded JSON error if serialization of BackendResponse fails
                    json!({ "Error": format!("Failed to serialize response: {}", e) }).to_string()
                });
            if let Err(e) = tx.send(Message::text(json_response)) {
                eprintln!("Error sending response back to client {}: {:?}", my_id, e);
            }
        } else if msg.is_close() {
            println!("Client {} sent close message ", my_id); // Added space
            break;
        } else if msg.is_ping() {
            if let Err(e) = tx.send(Message::pong(msg.into_bytes())) {
                eprintln!("Error sending pong to client {}: {:?}", my_id, e);
            }
        }
    }

    // Client disconnected
    clients.lock().unwrap().remove(&my_id);
    println!("Client disconnected: {}", my_id);
}

// Handles incoming WebSocket text messages as BackendRequests and returns BackendResponses
async fn handle_websocket_message(text_msg: &str) -> messages::BackendResponse {
    let request: messages::BackendRequest = match serde_json::from_str(text_msg) {
        Ok(req) => req,
        Err(e) => {
            return messages::BackendResponse::Error {
                message: format!("Failed to parse request: {}", e),
            };
        }
    };

    match request {
        messages::BackendRequest::ListDir { path, recursive } => { // Added recursive
            match filesystem::list_dir_contents(&path, recursive).await { // Passed recursive
                Ok(nodes) => messages::BackendResponse::ListDirResponse { path, nodes },
                Err(e) => messages::BackendResponse::Error { message: e },
            }
        }
        messages::BackendRequest::ReadFile { path } => {
            match filesystem::read_file_content(&path).await {
                Ok(content) => messages::BackendResponse::ReadFileResponse { path, content },
                Err(e) => messages::BackendResponse::Error { message: e },
            }
        }
        messages::BackendRequest::WriteFile { path, content } => {
            match filesystem::write_file_content(&path, &content).await {
                Ok(_) => messages::BackendResponse::WriteFileResponse { path },
                Err(e) => messages::BackendResponse::Error { message: e },
            }
        }
        messages::BackendRequest::CreateFile { path } => {
            match filesystem::create_file(&path).await {
                Ok(_) => messages::BackendResponse::CreateFileResponse { path },
                Err(e) => messages::BackendResponse::Error { message: e },
            }
        }
        messages::BackendRequest::CreateDir { path } => {
            match filesystem::create_dir(&path).await {
                Ok(_) => messages::BackendResponse::CreateDirResponse { path },
                Err(e) => messages::BackendResponse::Error { message: e },
            }
        }
        messages::BackendRequest::DeletePath { path } => {
            match filesystem::delete_path(&path).await {
                Ok(_) => messages::BackendResponse::DeletePathResponse { path },
                Err(e) => messages::BackendResponse::Error { message: e },
            }
        }
    }
}