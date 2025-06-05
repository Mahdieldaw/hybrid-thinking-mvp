import { ModelAdapter, ModelResponse, PromptOptions } from '@hybrid-thinking/common-types';

export abstract class BaseAdapter implements ModelAdapter {
  abstract id: string;
  abstract type: 'api' | 'browser' | 'local';
  abstract supportsStreaming: boolean;

  abstract sendPrompt(prompt: string, options?: PromptOptions): Promise<ModelResponse>;
  abstract healthCheck(): Promise<{ ready: boolean; details?: string }>;

  protected abstract extractText(response: any): string;
  protected abstract extractTokens(response: any): number;
  protected abstract calculateCost(response: any): number;

  protected normalizeResponse(response: any): ModelResponse {
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
