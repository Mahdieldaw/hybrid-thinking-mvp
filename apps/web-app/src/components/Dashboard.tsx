import React, { useState, useEffect, useRef } from 'react';
import socket from '../services/socket';

const modelsList = ['claude-sonnet', 'gemini-pro'];

const Dashboard: React.FC = () => {
  const [connected, setConnected] = useState(false);
  const [promptText, setPromptText] = useState('');
  const [requestedModels, setRequestedModels] = useState<string[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onConnect() {
      setConnected(true);
      setLogs((l) => [...l, '[socket] Connected']);
    }
    function onDisconnect() {
      setConnected(false);
      setLogs((l) => [...l, '[socket] Disconnected']);
    }
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('job:model_result', (data) => {
      setLogs((l) => [...l, `[model_result] ${JSON.stringify(data)}`]);
    });
    socket.on('job:synthesis_result', (data) => {
      setLogs((l) => [...l, `[synthesis_result] ${JSON.stringify(data)}`]);
    });
    socket.on('job:completed', (data) => {
      setLogs((l) => [...l, `[completed] ${JSON.stringify(data)}`]);
    });
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('job:model_result');
      socket.off('job:synthesis_result');
      socket.off('job:completed');
    };
  }, []);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  const handleConnect = () => {
    socket.connect();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptText || requestedModels.length === 0) return;
    // [TODO: replace 'web-user' with real auth once built]
    socket.emit('job:run:prompt', {
      userId: 'web-user',
      promptText,
      requestedModels,
    });
    setLogs((l) => [...l, `emit job:run:prompt with prompt: ${promptText}`]);
  };

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = Array.from(e.target.selectedOptions, (option) => option.value);
    setRequestedModels(selected);
  };

  return (
    <div style={{ maxWidth: 600, margin: '2rem auto', fontFamily: 'system-ui' }}>
      <h2>Hybrid Thinking Dashboard</h2>
      {!connected ? (
        <button onClick={handleConnect}>Connect</button>
      ) : (
        <form onSubmit={handleSubmit} style={{ marginBottom: 16 }}>
          <div>
            <label>Prompt:</label>
            <br />
            <textarea
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              rows={3}
              style={{ width: '100%' }}
              placeholder="Enter your prompt here..."
            />
          </div>
          <div style={{ margin: '12px 0' }}>
            <label>Models:</label>
            <br />
            <select
              multiple
              value={requestedModels}
              onChange={handleModelChange}
              style={{ width: '100%', height: 60 }}
            >
              {modelsList.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <button type="submit">Run Job</button>
        </form>
      )}
      <div
        ref={logRef}
        style={{
          background: '#222',
          color: '#fff',
          padding: 12,
          borderRadius: 6,
          height: 200,
          overflowY: 'auto',
          fontSize: 13,
        }}
      >
        {logs.map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
