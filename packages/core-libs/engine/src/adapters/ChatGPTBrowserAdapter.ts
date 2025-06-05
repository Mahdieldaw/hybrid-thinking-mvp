import { BaseAdapter } from './BaseAdapter';
import { ModelResponse, PromptOptions } from '@hybrid-thinking/common-types';

export class ChatGPTBrowserAdapter extends BaseAdapter {
  id = 'chatgpt-browser';
  type = 'browser' as const;
  supportsStreaming = false;
  private extensionId: string;

  constructor(extensionId: string) {
    super();
    this.extensionId = extensionId;
  }

  async sendPrompt(prompt: string, options?: PromptOptions): Promise<ModelResponse> {
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
      }, (response: any) => {
        clearTimeout(timeout);
        if (response?.success) {
          resolve(this.normalizeResponse(response.data));
        } else {
          reject(new Error(response?.error || 'Browser adapter failed'));
        }
      });
    });
  }

  async healthCheck(): Promise<{ ready: boolean; details?: string }> {
    return new Promise((resolve) => {
      // @ts-ignore
      chrome.runtime.sendMessage(this.extensionId, {
        type: 'HEALTH_CHECK',
        provider: 'chatgpt'
      }, (response: any) => {
        resolve({ ready: response?.ready === true, details: response?.details });
      });
    });
  }

  protected extractText(response: any): string {
    return response.response || '';
  }

  protected extractTokens(response: any): number {
    return 0; // Browser adapters don't provide token counts
  }

  protected calculateCost(response: any): number {
    return 0;
  }
}
