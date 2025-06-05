"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeminiAdapter = void 0;
const BaseAdapter_1 = require("./BaseAdapter");
class GeminiAdapter extends BaseAdapter_1.BaseAdapter {
    constructor(apiKey) {
        super();
        this.id = 'gemini-pro';
        this.type = 'api';
        this.supportsStreaming = false;
        this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
        this.apiKey = apiKey;
    }
    async sendPrompt(prompt, options) {
        const response = await fetch(`${this.baseUrl}/models/gemini-pro:generateContent?key=${this.apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    maxOutputTokens: options?.maxTokens || 4096
                }
            })
        });
        if (!response.ok) {
            throw new Error(`Gemini API error: ${response.statusText}`);
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
        return response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }
    extractTokens(response) {
        return response.usageMetadata?.totalTokenCount || 0;
    }
    calculateCost(response) {
        // [TODO: implement Gemini pricing]
        return 0;
    }
}
exports.GeminiAdapter = GeminiAdapter;
