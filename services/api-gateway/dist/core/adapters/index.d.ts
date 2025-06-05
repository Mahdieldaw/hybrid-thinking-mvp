import { ClaudeAdapter } from './ClaudeAdapter';
import { GeminiAdapter } from './GeminiAdapter';
import { ChatGPTBrowserAdapter } from './ChatGPTBrowserAdapter';
import { ModelAdapter } from '@hybrid-thinking/common-types';
export { ClaudeAdapter, GeminiAdapter, ChatGPTBrowserAdapter };
export declare const adapterRegistry: Map<string, ModelAdapter>;
