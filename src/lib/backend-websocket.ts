import { BackendRequest, BackendResponse, BackendResponseType } from "@/types/backend-messages";
import { toast } from "sonner";
import { useIDEStore } from "@/stores/ide-store";

interface WebSocketCallbacks {
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (event: Event) => void;
  onMessage: (response: BackendResponse) => void;
}

class WebSocketManager {
  private ws: WebSocket | null = null;
  public callbacks: WebSocketCallbacks;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private baseReconnectIntervalMs: number = 1000; // Start with 1 second
  private maxReconnectIntervalMs: number = 30000; // Cap at 30 seconds
  private messageQueue: {
    request: BackendRequest;
    resolve: (val: any) => void;
    reject: (err: any) => void;
  }[] = [];
  private pendingRequests = new Map<
    string,
    { resolve: (response: BackendResponse) => void; reject: (error: string) => void }
  >();

  constructor(callbacks: WebSocketCallbacks) {
    this.callbacks = callbacks;
  }

  public connect() {
    if (typeof window === "undefined") {
      console.log("WebSocketManager: Skipping connection during SSR.");
      return;
    }

    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)
    ) {
      console.log(
        `WebSocketManager: Connection already in state ${this.ws.readyState}. Not creating a new one.`,
      );
      return;
    }

    console.log(
      `WebSocketManager: connect() called. Current readyState: ${this.ws?.readyState ?? "N/A"}, wsInstance: ${this.ws ? "exists" : "null"}`,
    );

    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const websocketUrl = `${wsProtocol}//${window.location.host}/forge-backend-ws`;

    console.log(`WebSocketManager: Attempting to connect to: ${websocketUrl}`);

    if (
      this.ws &&
      !(this.ws.readyState === WebSocket.CLOSED || this.ws.readyState === WebSocket.CLOSING)
    ) {
      console.log(
        `WebSocketManager: Closing existing inactive WebSocket connection (readyState: ${this.ws.readyState}) before new one.`,
      );
      this.ws.close();
    }

    this.ws = new WebSocket(websocketUrl);

    this.ws.onopen = () => {
      console.log("WebSocket connected. (onopen event) - Connection established.");
      this.reconnectAttempts = 0;
      this.callbacks.onOpen?.();
      useIDEStore.getState().setIsConnected(true);
      toast.success("Backend connected");
      this.flushMessageQueue();
    };

    this.ws.onmessage = (event) => {
      try {
        const response: BackendResponse = JSON.parse(event.data as string);
        const requestId = (response.payload as any).request_id; // Değişiklik burada!

        if (requestId && this.pendingRequests.has(requestId)) {
          const pending = this.pendingRequests.get(requestId);
          this.pendingRequests.delete(requestId);
          if (pending) {
            if (response.type === BackendResponseType.Error) {
              pending.reject((response.payload as any).message);
            } else {
              pending.resolve(response);
            }
          }
        }

        // Always call onMessage so global stores can process it if they want
        if (this.callbacks && this.callbacks.onMessage) {
          this.callbacks.onMessage(response);
        }
      } catch (e) {
        console.error("Failed to parse WebSocket message:", e, event.data);
        toast.error("Failed to parse backend response.");
      }
    };

    this.ws.onclose = (event) => {
      console.warn(
        `WebSocket disconnected. (onclose event) - Code: ${event.code}, Reason: ${event.reason}, Clean: ${event.wasClean}.`,
      );
      useIDEStore.getState().setIsConnected(false);

      if (!event.wasClean && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.callbacks.onClose?.();
        toast.warning("Backend disconnected. Attempting to reconnect...");
        this.handleReconnect();
      } else if (event.wasClean) {
        console.log("WebSocketManager: Connection closed cleanly. Not reconnecting.");
        this.callbacks.onClose?.();
      } else {
        console.error(
          "WebSocketManager: Max reconnect attempts reached or clean close. Not reconnecting.",
        );
        toast.error("Max reconnect attempts reached. Please restart the backend.");
      }
    };

    this.ws.onerror = (event) => {
      console.error("WebSocket error. (onerror event) - Event details:", event);
      this.callbacks.onError?.(event);
      this.ws?.close();
    };
  }

  private handleReconnect() {
    console.log(`WebSocketManager: handleReconnect() called. Attempts: ${this.reconnectAttempts}`);
    this.reconnectAttempts++;
    const delay = Math.min(
      this.baseReconnectIntervalMs * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectIntervalMs,
    );
    setTimeout(() => {
      console.log(
        `Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts}) with delay ${delay}ms`,
      );
      this.connect();
    }, delay);
  }

  public sendRequest(request: BackendRequest): Promise<any> {
    // Generate request_id if not present in payload
    let requestId = (request.payload as any).request_id;
    if (!requestId) {
      requestId =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : Math.random().toString(36).substring(2, 15) +
            Math.random().toString(36).substring(2, 15);
      (request.payload as any).request_id = requestId;
    }

    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        try {
          const jsonRequest = this.formatRequestForBackend(request);
          console.log("WebSocketManager: Sending request:", jsonRequest);
          this.pendingRequests.set(requestId, { resolve, reject });
          this.ws.send(jsonRequest);
        } catch (e) {
          console.error("Failed to serialize request:", e, request);
          toast.error("Failed to send request to backend.");
          reject(e);
        }
      } else {
        console.warn("WebSocketManager: WebSocket not open. Queueing request:", request);
        this.messageQueue.push({ request, resolve, reject });
        toast.warning("Waiting for backend connection...");
      }
    });
  }

  private flushMessageQueue() {
    console.log(
      `WebSocketManager: Flushing message queue. Queue size: ${this.messageQueue.length}`,
    );
    const queue = [...this.messageQueue];
    this.messageQueue = [];
    for (const item of queue) {
      this.sendRequest(item.request).then(item.resolve).catch(item.reject);
    }
  }

  private formatRequestForBackend(request: BackendRequest): string {
    const payload = { ...request.payload } as any;

    // Eğer active_environment_details mevcutsa ve password içeriyorsa, onu kaldır
    if (payload.active_environment_details && payload.active_environment_details.password) {
      console.warn(
        "WebSocketManager: Removing password from outgoing request for security reasons.",
      );
      const { password, ...restDetails } = payload.active_environment_details;
      payload.active_environment_details = restDetails;
    }

    // Backend'in #[serde(tag = "type", content = "payload")] attribute'ü ile beklediği formatı oluşturuyoruz.
    // Yani, `type` adında bir field ve `payload` adında bir field olacak.
    const formattedRequest = {
      type: request.type,
      payload: {
        ...payload,
      },
    };
    return JSON.stringify(formattedRequest);
  }

  public close() {
    console.log("WebSocketManager: close() called.");
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

let wsManager: WebSocketManager | null = null;

export const getWebSocketManager = (callbacks?: WebSocketCallbacks) => {
  if (!wsManager) {
    console.log("WebSocketManager: Creating new instance.");
    wsManager = new WebSocketManager(callbacks || { onMessage: () => {} });
  } else if (callbacks) {
    wsManager.callbacks = callbacks;
    console.log("WebSocketManager: Reusing existing instance, updated callbacks.");
  }
  return wsManager;
};
