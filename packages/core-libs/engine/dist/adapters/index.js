"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adapterRegistry = exports.ChatGPTBrowserAdapter = exports.GeminiAdapter = exports.ClaudeAdapter = void 0;
const ClaudeAdapter_1 = require("./ClaudeAdapter");
Object.defineProperty(exports, "ClaudeAdapter", { enumerable: true, get: function () { return ClaudeAdapter_1.ClaudeAdapter; } });
const GeminiAdapter_1 = require("./GeminiAdapter");
Object.defineProperty(exports, "GeminiAdapter", { enumerable: true, get: function () { return GeminiAdapter_1.GeminiAdapter; } });
const ChatGPTBrowserAdapter_1 = require("./ChatGPTBrowserAdapter");
Object.defineProperty(exports, "ChatGPTBrowserAdapter", { enumerable: true, get: function () { return ChatGPTBrowserAdapter_1.ChatGPTBrowserAdapter; } });
exports.adapterRegistry = new Map();
if (process.env.CLAUDE_API_KEY) {
    exports.adapterRegistry.set('claude-sonnet', new ClaudeAdapter_1.ClaudeAdapter(process.env.CLAUDE_API_KEY));
}
if (process.env.GEMINI_API_KEY) {
    exports.adapterRegistry.set('gemini-pro', new GeminiAdapter_1.GeminiAdapter(process.env.GEMINI_API_KEY));
}
if (process.env.EXTENSION_ID) {
    exports.adapterRegistry.set('chatgpt-browser', new ChatGPTBrowserAdapter_1.ChatGPTBrowserAdapter(process.env.EXTENSION_ID));
}
