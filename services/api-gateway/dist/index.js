"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatGPTBrowserAdapter = exports.GeminiAdapter = exports.ClaudeAdapter = exports.WorkflowEngine = void 0;
// Entry point for API Gateway service
const express_1 = __importDefault(require("express"));
const app = (0, express_1.default)();
const port = process.env.PORT || 3000;
app.get('/', (req, res) => {
    res.send('Hybrid Thinking API Gateway is running.');
});
app.listen(port, () => {
    console.log(`API Gateway listening on port ${port}`);
});
var WorkflowEngine_1 = require("./core/engine/WorkflowEngine");
Object.defineProperty(exports, "WorkflowEngine", { enumerable: true, get: function () { return WorkflowEngine_1.WorkflowEngine; } });
var ClaudeAdapter_1 = require("./core/adapters/ClaudeAdapter");
Object.defineProperty(exports, "ClaudeAdapter", { enumerable: true, get: function () { return ClaudeAdapter_1.ClaudeAdapter; } });
var GeminiAdapter_1 = require("./core/adapters/GeminiAdapter");
Object.defineProperty(exports, "GeminiAdapter", { enumerable: true, get: function () { return GeminiAdapter_1.GeminiAdapter; } });
var ChatGPTBrowserAdapter_1 = require("./core/adapters/ChatGPTBrowserAdapter");
Object.defineProperty(exports, "ChatGPTBrowserAdapter", { enumerable: true, get: function () { return ChatGPTBrowserAdapter_1.ChatGPTBrowserAdapter; } });
