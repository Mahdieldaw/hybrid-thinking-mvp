import { BaseAdapter } from './BaseAdapter';
import { ModelResponse, PromptOptions } from '@hybrid-thinking/common-types';

export class GeminiAdapter extends BaseAdapter {
  id = 'gemini-pro';
  type = 'api' as const;
  supportsStreaming = false;
  private apiKey: string;
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

  constructor(apiKey: string) {
    super();
    this.apiKey = apiKey;
  }

  async sendPrompt(prompt: string, options?: PromptOptions): Promise<ModelResponse> {
    const response = await fetch(
      `${this.baseUrl}/models/gemini-pro:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: options?.maxTokens || 4096
          }
        })
      }
    );
    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.statusText}`);
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
    return response.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  protected extractTokens(response: any): number {
    return response.usageMetadata?.totalTokenCount || 0;
  }

  protected calculateCost(response: any): number {
    // [TODO: implement Gemini pricing]
    return 0;
  }
}
