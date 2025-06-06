import { BaseAdapter } from './BaseAdapter';
import { ModelResponse, PromptOptions } from '@hybrid-thinking/common-types';

export class ClaudeAdapter extends BaseAdapter {
  id = 'claude-3-sonnet-20240229';
  type = 'api' as const;
  supportsStreaming = false;
  private apiKey: string;
  private baseUrl = 'https://api.anthropic.com/v1';

  constructor(apiKey: string) {
    super();
    this.apiKey = apiKey;
  }

  async sendPrompt(prompt: string, options?: PromptOptions): Promise<ModelResponse> {
    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-sonnet-20240229',
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

  async healthCheck(): Promise<{ ready: boolean; details?: string }> {
    try {
      await this.sendPrompt('Health check', { maxTokens: 10 });
      return { ready: true };
    } catch (e: any) {
      return { ready: false, details: e?.message };
    }
  }

  protected extractText(response: any): string {
    return response.content?.[0]?.text || '';
  }

  protected extractTokens(response: any): number {
    return (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);
  }

  protected calculateCost(response: any): number {
    // [TODO: implement Claude pricing]
    return 0;
  }
}
