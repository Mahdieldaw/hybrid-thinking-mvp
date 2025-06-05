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
