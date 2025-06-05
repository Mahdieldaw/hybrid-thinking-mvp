Great—now that your API Gateway is running on port 4000 and listening for WebSocket connections, let’s wire up the front end. We’ll:

1. Create a simple WebSocket client in the React app that connects to `ws://localhost:4000/`.
2. Build a minimal Dashboard component that can send a `job:run:prompt` event and display incoming `job:model_result` or `job:completed` messages.
3. Verify the end-to-end flow (React → WebSocket → API Gateway → (simulated) model responses → React).

Follow these steps:

---

## 1. Add a WebSocket Client Wrapper

Create a new file at `apps/web-app/src/services/socket.ts`. This will export a small API for connecting, sending a “run prompt” request, and subscribing to events.

```ts
// apps/web-app/src/services/socket.ts
import { io, Socket } from "socket.io-client";

type ModelResultPayload = {
  jobId: string;
  modelId: string;
  response: {
    content: string;
    provider: string;
    model: string;
    // other fields as needed...
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

    // 1) Point to the API Gateway WS namespace/endpoint (assumes default namespace)
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

    // Handle server-pushed events (you can add more as needed)
    this.socket.on("job:model_result", (payload: ModelResultPayload) => {
      console.log("Received model result:", payload);
      // We’ll let components register their own handlers (see subscribeModelResult())
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

  /** Emit a "run prompt" request to the server */
  runPrompt(userId: string, promptText: string, requestedModels: string[]) {
    if (!this.socket) {
      console.error("WebSocket is not connected");
      return;
    }
    this.socket.emit("job:run:prompt", { userId, promptText, requestedModels });
  }

  // ==== Subscription APIs ====
  private _modelResultListeners: Array<(payload: ModelResultPayload) => void> = [];
  private _jobCompletedListeners: Array<(payload: JobCompletedPayload) => void> = [];

  subscribeModelResult(cb: (payload: ModelResultPayload) => void) {
    this._modelResultListeners.push(cb);
    // Return an unsubscribe function:
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

// Export a singleton instance:
const socketClient = new WebSocketClient();
export default socketClient;
```

> **Note:** If you’re using plain WebSockets instead of `socket.io-client`, you can replace the `io(...)` calls with `new WebSocket("ws://localhost:4000")` and wire up `.onmessage` accordingly. But since the API Gateway likely uses Socket.io, we’re using `socket.io-client` here.

---

## 2. Build a Basic Dashboard Component

Now create (or update) `apps/web-app/src/components/Dashboard.tsx` so that it can:

* Render a text input for “prompt” and checkboxes for model selection.
* Connect to the socket on mount (`useEffect`) and register listeners.
* Call `socketClient.runPrompt(...)` when the user clicks “Run Job”.
* Show model results and final synthesis in a simple list.

```tsx
// apps/web-app/src/components/Dashboard.tsx
import React, { useState, useEffect } from "react";
import socketClient from "../services/socket";

const AVAILABLE_MODELS = [
  { id: "claude-sonnet", label: "Claude Sonnet" },
  { id: "gemini-pro", label: "Gemini Pro" },
  { id: "chatgpt-browser", label: "ChatGPT (Browser)" },
];

interface ModelResult {
  modelId: string;
  text: string;
}

interface JobCompleted {
  jobId: string;
  finalState: any; // Replace with your HybridJobState type when available
}

const Dashboard: React.FC = () => {
  const [promptText, setPromptText] = useState("");
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [results, setResults] = useState<ModelResult[]>([]);
  const [finalSynthesis, setFinalSynthesis] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    // 1) Connect WebSocket when component mounts
    socketClient.connect();

    // 2) Subscribe to model results
    const unsubscribeModel = socketClient.subscribeModelResult((payload) => {
      setResults((prev) => [
        ...prev,
        { modelId: payload.modelId, text: payload.response.content },
      ]);
    });

    // 3) Subscribe to job completion
    const unsubscribeJob = socketClient.subscribeJobCompleted((payload) => {
      // For simplicity, assume payload.finalState.synthesisResult.content is the synthesized text
      const synth = payload.finalState.synthesisResult?.content || "[No synthesis]";
      setFinalSynthesis(synth);
      setIsRunning(false);
    });

    // Cleanup on unmount
    return () => {
      unsubscribeModel();
      unsubscribeJob();
      socketClient.disconnect();
    };
  }, []);

  const handleCheckbox = (modelId: string) => {
    setSelectedModels((prev) =>
      prev.includes(modelId) ? prev.filter((id) => id !== modelId) : [...prev, modelId]
    );
  };

  const handleRun = () => {
    if (!promptText.trim() || selectedModels.length === 0) {
      alert("Please enter a prompt and select at least one model.");
      return;
    }
    setIsRunning(true);
    setResults([]);
    setFinalSynthesis(null);
    // Send the run:prompt event
    socketClient.runPrompt("web-user", promptText, selectedModels);
  };

  return (
    <div style={{ padding: "20px", maxWidth: "600px", margin: "auto" }}>
      <h1>Hybrid Thinking Dashboard</h1>

      {/* Prompt Input */}
      <div>
        <label>
          Prompt:
          <textarea
            rows={4}
            style={{ width: "100%", marginTop: "8px" }}
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            disabled={isRunning}
          />
        </label>
      </div>

      {/* Model Selection */}
      <div style={{ marginTop: "16px" }}>
        <p>Select Models:</p>
        {AVAILABLE_MODELS.map((model) => (
          <label key={model.id} style={{ display: "block" }}>
            <input
              type="checkbox"
              value={model.id}
              checked={selectedModels.includes(model.id)}
              onChange={() => handleCheckbox(model.id)}
              disabled={isRunning}
            />
            {model.label}
          </label>
        ))}
      </div>

      {/* Run Button */}
      <button
        onClick={handleRun}
        disabled={isRunning}
        style={{
          marginTop: "16px",
          padding: "8px 16px",
          fontSize: "16px",
          cursor: isRunning ? "not-allowed" : "pointer",
        }}
      >
        {isRunning ? "Running..." : "Run Job"}
      </button>

      {/* Model Results */}
      {results.length > 0 && (
        <div style={{ marginTop: "24px" }}>
          <h2>Model Results</h2>
          <ul>
            {results.map((res, idx) => (
              <li key={idx}>
                <strong>{res.modelId}:</strong> {res.text}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Final Synthesis */}
      {finalSynthesis && (
        <div style={{ marginTop: "24px" }}>
          <h2>Final Synthesis</h2>
          <p>{finalSynthesis}</p>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
```

Now, in your `src/App.tsx`, simply render the Dashboard:

```tsx
// apps/web-app/src/App.tsx
import React from "react";
import Dashboard from "./components/Dashboard";

function App() {
  return <Dashboard />;
}

export default App;
```

Save both files.

---

## 3. Install `socket.io-client` and Rebuild

Back in your React app folder:

```bash
cd C:\Users\Mahdi\Workspace\hybrid-thinking-mvp\apps\web-app
npm install socket.io-client
npm start
```

* The development server should compile successfully.
* Open your browser to `http://localhost:3000`. You should see the Dashboard UI:

  * A text area for the prompt.
  * Checkboxes for “Claude Sonnet”, “Gemini Pro”, and “ChatGPT (Browser)”.
  * A “Run Job” button.

Because your API Gateway is already running (on port 4000), the client will attempt to connect to `ws://localhost:4000/`. If that connection succeeds, you’ll see “WebSocket connected, id: …” in the browser console. (If there’s an error, double-check that the API Gateway is running and that the front end is pointing at the correct port.)

---

## 4. Test a Prompt from the Web UI

1. In the Dashboard, type a simple prompt such as:

   ```
   Explain AI hybrid orchestration briefly.
   ```
2. Check “Claude Sonnet” and “Gemini Pro” (or any combination).
3. Click **Run Job**.

* The front end will send a `job:run:prompt` event to the WS server.
* The API Gateway (with placeholder implementations) should simulate sending back `job:model_result` events.

  * Since your server likely has `[TODO]` logic, you may get either dummy responses or no–ops. But you should see something in the browser console or in the “Model Results” list if the placeholders emit test data.

---

## 5. Wire the CLI End-to-End

Finally, update the CLI so it too connects to port 4000. If you used the earlier Copilot scaffold, your `cli/src/index.ts` may already import `socket.io-client`. Otherwise, add:

```bash
cd C:\Users\Mahdi\Workspace\hybrid-thinking-mvp\cli
npm install socket.io-client
npm run build
```

Then run a test from the CLI folder:

```bash
npm run cli run -p "Test from CLI" -m "claude-sonnet,gemini-pro"
```

* The CLI will connect to `ws://localhost:4000`, emit `job:run:prompt`, and print any incoming model results or the final synthesis to the console.
* If your API Gateway has placeholder code that emits simulated results, you should see them appear. Otherwise, you’ll see logs indicating you still have to fill in the `[TODO]` model-implementation sections.

---

## 6. Next Steps for Placeholders

* Wherever you see `[TODO]` comments in:

  * `services/api-gateway/src/index.ts` (e.g., actually call `TokenVaultService`, launch real model adapters via `WorkflowEngine`, etc.)
  * `apps/browser-extension/src/content.js` and `src/background.js` (e.g., selectors may need tweaking, proper WS URL, error handling)
  * `cli/src/index.ts` (e.g., adapt to `EXTENSION_ID` when using browser models)

Begin filling in those gaps one by one:

1. Replace placeholder “simulate model result” code with actual calls to `Engine.runHybridPrompt()`.
2. Wire real `TokenVaultService` methods.
3. Update `site_configs` selectors in the extension to match the live LLM pages.
4. Handle OAuth/token flows in Express routes.

But at this point, your primary end-to-end plumbing is in place. You can verify WS connections, UI flows, and CLI outputs—even before completing every single TODO.
