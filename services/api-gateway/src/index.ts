// Entry point for API Gateway service
import express from 'express';

const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Hybrid Thinking API Gateway is running.');
});

app.listen(port, () => {
  console.log(`API Gateway listening on port ${port}`);
});

export { WorkflowEngine } from './core/engine/WorkflowEngine';
export { ClaudeAdapter } from './core/adapters/ClaudeAdapter';
export { GeminiAdapter } from './core/adapters/GeminiAdapter';
export { ChatGPTBrowserAdapter } from './core/adapters/ChatGPTBrowserAdapter';
