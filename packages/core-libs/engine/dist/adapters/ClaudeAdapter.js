"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClaudeAdapter = void 0;
const BaseAdapter_1 = require("./BaseAdapter");
class ClaudeAdapter extends BaseAdapter_1.BaseAdapter {
    constructor(apiKey) {
        super();
        this.id = 'claude-sonnet';
        this.type = 'api';
        this.supportsStreaming = false;
        this.baseUrl = 'https://api.anthropic.com/v1';
        this.apiKey = apiKey;
    }
    async sendPrompt(prompt, options) {
        const response = await fetch(`${this.baseUrl}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-3.5-sonnet-20241022',
                max_tokens: options?.maxTokens || 4096,
                messages: [{ role: 'user', content: prompt }]
            })
        });
        if (!response.ok) {
            throw new Error(`Claude API error: ${response.statusText}`);
        }
        const data = await response.json();
        return this.normalizeResponse(data);
    }
    async healthCheck() {
        try {
            await this.sendPrompt('Health check', { maxTokens: 10 });
            return { ready: true };
        }
        catch (e) {
            return { ready: false, details: e?.message };
        }
    }
    extractText(response) {
        return response.content?.[0]?.text || '';
    }
    extractTokens(response) {
        return (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);
    }
    calculateCost(response) {
        // [TODO: implement Claude pricing]
        return 0;
    }
}
exports.ClaudeAdapter = ClaudeAdapter;
