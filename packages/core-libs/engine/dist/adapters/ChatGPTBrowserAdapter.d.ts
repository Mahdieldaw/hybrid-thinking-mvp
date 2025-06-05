import { BaseAdapter } from './BaseAdapter';
import { ModelResponse, PromptOptions } from '@hybrid-thinking/common-types';
export declare class ChatGPTBrowserAdapter extends BaseAdapter {
    id: string;
    type: "browser";
    supportsStreaming: boolean;
    private extensionId;
    constructor(extensionId: string);
    sendPrompt(prompt: string, options?: PromptOptions): Promise<ModelResponse>;
    healthCheck(): Promise<{
        ready: boolean;
        details?: string;
    }>;
    protected extractText(response: any): string;
    protected extractTokens(response: any): number;
    protected calculateCost(response: any): number;
}
