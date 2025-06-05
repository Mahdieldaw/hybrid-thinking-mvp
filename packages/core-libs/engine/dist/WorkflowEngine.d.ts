import { ModelAdapter, HybridJobState } from '@hybrid-thinking/common-types';
export declare class WorkflowEngine {
    private adapters;
    private jobs;
    constructor(adapters: Map<string, ModelAdapter>);
    registerAdapter(adapter: ModelAdapter): void;
    runHybridPrompt(userId: string, promptText: string, requestedModels: string[], options?: any): Promise<HybridJobState>;
    executeGenerationPhase(context: any): Promise<void>;
    onModelSuccess(context: any, modelId: string, response: any): void;
    onModelFailure(context: any, modelId: string, error: Error): void;
    startSynthesis(context: any): Promise<void>;
    renderTemplate(template: string, variables: Record<string, any>): string;
    generateJobId(): string;
    getJob(jobId: string): HybridJobState | undefined;
}
