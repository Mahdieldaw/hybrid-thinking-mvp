import { io, Socket } from "socket.io-client";

type ModelResultPayload = {
  jobId: string;
  modelId: string;
  response: {
    content: string;
    provider: string;
    model: string;
  };
};

type JobCompletedPayload = {
  jobId: string;
  finalState: any; // You can replace `any` with your HybridJobState type once it's imported.
};

class WebSocketClient {
  private socket: Socket | null = null;

  connect() {
    if (this.socket) return; // already connected

    this.socket = io("ws://localhost:4000", {
      transports: ["websocket"],
    });

    this.socket.on("connect", () => {
      console.log("WebSocket connected, id:", this.socket!.id);
    });

    this.socket.on("disconnect", (reason) => {
      console.log("WebSocket disconnected:", reason);
      this.socket = null;
    });

    this.socket.on("job:model_result", (payload: ModelResultPayload) => {
      console.log("Received model result:", payload);
      this._modelResultListeners.forEach((cb) => cb(payload));
    });

    this.socket.on("job:completed", (payload: JobCompletedPayload) => {
      console.log("Job completed:", payload);
      this._jobCompletedListeners.forEach((cb) => cb(payload));
    });

    this.socket.on("job:model_error", (err) => {
      console.warn("Model error from server:", err);
    });

    this.socket.on("job:synthesis_error", (err) => {
      console.warn("Synthesis error from server:", err);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  runPrompt(userId: string, promptText: string, requestedModels: string[]) {
    if (!this.socket) {
      console.error("WebSocket is not connected");
      return;
    }
    this.socket.emit("job:run:prompt", { userId, promptText, requestedModels });
  }

  private _modelResultListeners: Array<(payload: ModelResultPayload) => void> = [];
  private _jobCompletedListeners: Array<(payload: JobCompletedPayload) => void> = [];

  subscribeModelResult(cb: (payload: ModelResultPayload) => void) {
    this._modelResultListeners.push(cb);
    return () => {
      this._modelResultListeners = this._modelResultListeners.filter((fn) => fn !== cb);
    };
  }

  subscribeJobCompleted(cb: (payload: JobCompletedPayload) => void) {
    this._jobCompletedListeners.push(cb);
    return () => {
      this._jobCompletedListeners = this._jobCompletedListeners.filter((fn) => fn !== cb);
    };
  }
}

const socketClient = new WebSocketClient();
export default socketClient;
