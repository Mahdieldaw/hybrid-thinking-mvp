"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatGPTBrowserAdapter = void 0;
const BaseAdapter_1 = require("./BaseAdapter");
class ChatGPTBrowserAdapter extends BaseAdapter_1.BaseAdapter {
    constructor(extensionId) {
        super();
        this.id = 'chatgpt-browser';
        this.type = 'browser';
        this.supportsStreaming = false;
        this.extensionId = extensionId;
    }
    async sendPrompt(prompt, options) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Browser adapter timeout'));
            }, options?.timeout || 30000);
            // @ts-ignore
            chrome.runtime.sendMessage(this.extensionId, {
                type: 'INJECT_PROMPT',
                prompt,
                provider: 'chatgpt',
                options: { waitForResponse: true }
            }, (response) => {
                clearTimeout(timeout);
                if (response?.success) {
                    resolve(this.normalizeResponse(response.data));
                }
                else {
                    reject(new Error(response?.error || 'Browser adapter failed'));
                }
            });
        });
    }
    async healthCheck() {
        return new Promise((resolve) => {
            // @ts-ignore
            chrome.runtime.sendMessage(this.extensionId, {
                type: 'HEALTH_CHECK',
                provider: 'chatgpt'
            }, (response) => {
                resolve({ ready: response?.ready === true, details: response?.details });
            });
        });
    }
    extractText(response) {
        return response.response || '';
    }
    extractTokens(response) {
        return 0; // Browser adapters don't provide token counts
    }
    calculateCost(response) {
        return 0;
    }
}
exports.ChatGPTBrowserAdapter = ChatGPTBrowserAdapter;
