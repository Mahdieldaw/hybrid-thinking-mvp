"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseAdapter = void 0;
class BaseAdapter {
    normalizeResponse(response) {
        return {
            content: this.extractText(response),
            provider: this.id,
            model: this.id,
            tokensUsed: { total: this.extractTokens(response) },
            cost: this.calculateCost(response),
            rawResponse: response,
            metadata: { timestamp: Date.now() }
        };
    }
}
exports.BaseAdapter = BaseAdapter;
