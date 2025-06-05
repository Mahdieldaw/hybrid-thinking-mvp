import { ClaudeAdapter } from './ClaudeAdapter';
import { GeminiAdapter } from './GeminiAdapter';
import { ChatGPTBrowserAdapter } from './ChatGPTBrowserAdapter';
import { ModelAdapter } from '@hybrid-thinking/common-types';

export { ClaudeAdapter, GeminiAdapter, ChatGPTBrowserAdapter };

export const adapterRegistry: Map<string, ModelAdapter> = new Map();

if (process.env.CLAUDE_API_KEY) {
  adapterRegistry.set('claude-sonnet', new ClaudeAdapter(process.env.CLAUDE_API_KEY));
}
if (process.env.GEMINI_API_KEY) {
  adapterRegistry.set('gemini-pro', new GeminiAdapter(process.env.GEMINI_API_KEY));
}
if (process.env.EXTENSION_ID) {
  adapterRegistry.set('chatgpt-browser', new ChatGPTBrowserAdapter(process.env.EXTENSION_ID));
}
