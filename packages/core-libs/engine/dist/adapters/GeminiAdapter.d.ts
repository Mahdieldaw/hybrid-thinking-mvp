import { BaseAdapter } from './BaseAdapter';
import { ModelResponse, PromptOptions } from '@hybrid-thinking/common-types';
export declare class GeminiAdapter extends BaseAdapter {
    id: string;
    type: "api";
    supportsStreaming: boolean;
    private apiKey;
    private baseUrl;
    constructor(apiKey: string);
    sendPrompt(prompt: string, options?: PromptOptions): Promise<ModelResponse>;
    healthCheck(): Promise<{
        ready: boolean;
        details?: string;
    }>;
    protected extractText(response: any): string;
    protected extractTokens(response: any): number;
    protected calculateCost(response: any): number;
}
