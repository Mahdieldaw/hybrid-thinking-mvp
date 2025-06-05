/**
 * Represents the authenticated user identity.
 * @property userId - Unique user identifier (e.g., Firebase UID or UUID).
 * @property email - Optional email of the user.
 * @property displayName - Optional display name.
 */
export interface UserIdentity {
  userId: string;
  email?: string;
  displayName?: string;
}

/**
 * Represents stored LLM credentials for a provider.
 * @property accessToken - Primary token or API key.
 * @property refreshToken - Refresh token if applicable (OAuth).
 * @property expiresAt - Unix timestamp (ms) when this token expires.
 * @property issuedAt - Unix timestamp (ms) when this token was issued.
 * @property providerId - e.g., 'openai', 'claude', 'browser:chatgpt'.
 * @property type - 'api' | 'oauth' | 'browser' | 'local'.
 * @property scopes - OAuth scopes or API scopes.
 * @property metadata - Additional provider-specific info.
 */
export interface TokenData {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  issuedAt?: number;
  providerId: string;
  type: 'api' | 'oauth' | 'browser' | 'local';
  scopes?: string[];
  metadata?: Record<string, any>;
}

/**
 * Core interface for any LLM model adapter.
 * @property id - Unique identifier (e.g., 'openai:gpt-4', 'browser:chatgpt', 'local:llama3').
 * @property type - 'api' | 'browser' | 'local'.
 * @property supportsStreaming - Whether the adapter can stream partial responses.
 */
export interface ModelAdapter {
  id: string;
  type: 'api' | 'browser' | 'local';
  supportsStreaming: boolean;

  /** Send a prompt to this model. */
  sendPrompt(prompt: string, options?: PromptOptions): Promise<ModelResponse>;

  /** Check if the model endpoint is reachable and healthy. */
  healthCheck(): Promise<{ ready: boolean; details?: string }>;
}

/**
 * Optional parameters when sending a prompt.
 * @property maxTokens - Maximum tokens to generate.
 * @property temperature - Sampling temperature.
 * @property timeout - Milliseconds before rejecting.
 * @property streamCallback - Callback for streaming chunks.
 * @property customParameters - Any additional provider-specific parameters.
 */
export interface PromptOptions {
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
  streamCallback?: (chunk: string) => void;
  customParameters?: Record<string, any>;
}

/**
 * Standardized response from any ModelAdapter.
 * @property id - Optional correlation or request ID.
 * @property content - Full text output.
 * @property provider - Provider name (e.g., 'openai', 'anthropic', 'browser:chatgpt').
 * @property model - Model identifier (e.g., 'gpt-4', 'claude-sonnet').
 * @property tokensUsed - { input, output, total } token counts.
 * @property cost - Cost incurred (USD).
 * @property rawResponse - Raw provider response (for debugging).
 * @property metadata - Timestamp, error details, etc.
 */
export interface ModelResponse {
  id?: string;
  content: string;
  provider: string;
  model: string;
  tokensUsed?: { input?: number; output?: number; total?: number };
  cost?: number;
  rawResponse?: any;
  metadata?: Record<string, any>;
}

/**
 * Defines a complete YAML workflow specification.
 * Mirrors the structure of 'Unified System Flow Map'.
 * @property workflow_name - Unique name.
 * @property description - Optional human description.
 * @property stages - 'generate', 'synthesize', etc.
 * @property execution_modes - Options for web, cli, api.
 */
export interface WorkflowDefinition {
  workflow_name: string;
  description?: string;
  stages: {
    generate: GenerateStage;
    synthesize: SynthesizeStage;
    [key: string]: any; // For future extension
  };
  execution_modes?: ExecutionModes;
}

/**
 * Generation stage in a workflow.
 * @property parallel - Whether to run steps in parallel.
 * @property steps - Array of GenerateStep.
 */
export interface GenerateStage {
  parallel?: boolean;
  steps: GenerateStep[];
}

/**
 * Single step within the 'generate' stage.
 * @property name - Unique step name.
 * @property models - Array of modelIds to invoke.
 * @property prompt_template - Path or key to a prompt template file.
 * @property output_var - Variable name to store this step's output.
 * @property input_vars - (Optional) Array of variable names to substitute into prompt.
 */
export interface GenerateStep {
  name: string;
  models: string[];
  prompt_template: string;
  output_var: string;
  input_vars?: string[];
}

/**
 * Synthesis stage in a workflow.
 * @property name - Name of the synthesis step.
 * @property model - Single modelId used for synthesis.
 * @property prompt_template - Path/key for the synthesis prompt.
 * @property input_vars - Variables collected from previous stage(s).
 * @property output_var - Name for final synthesis output.
 */
export interface SynthesizeStage {
  name: string;
  model: string;
  prompt_template: string;
  input_vars: string[];
  output_var: string;
}

/**
 * Execution mode options for different contexts.
 * @property web - Real-time update and persistence options.
 * @property cli - Output format and path options.
 * @property api - JSON/webhook options.
 */
export interface ExecutionModes {
  web?: {
    realtime_updates: boolean;
    persistence: 'database' | 'none';
  };
  cli?: {
    output_format: 'obsidian_markdown' | 'json';
    output_path: string; // e.g., "HybridOutputs/{{workflow_name}}/{{date}}/"
  };
  api?: {
    response_format: 'json';
    webhook_url?: string;
  };
}

/**
 * Tracks the full state of a hybrid job (PromptLogs).
 * @property jobId - Unique job ID (UUID).
 * @property userId - Requesting user ID.
 * @property workflowName - (Optional) Workflow name if YAML-driven.
 * @property promptText - Raw prompt if direct.
 * @property requestedModels - Array of invoked modelIds.
 * @property results - Map from modelId → ModelResponse or error placeholder.
 * @property synthesisInput - (Optional) Data passed into synthesis stage.
 * @property synthesisResult - (Optional) Final synthesis response.
 * @property status - 'pending' | 'generating' | 'synthesizing' | 'completed' | 'failed'.
 * @property createdAt - ISO timestamp of job creation.
 * @property updatedAt - ISO timestamp of last update.
 * @property errorInfo - (Optional) Error message if failure.
 */
export interface HybridJobState {
  jobId: string;
  userId: string;
  workflowName?: string;
  promptText?: string;
  requestedModels: string[];
  results: Record<string, ModelResponse | { error: string } | null>;
  synthesisInput?: Record<string, string>;
  synthesisResult?: ModelResponse | { error: string } | null;
  status: 'pending' | 'generating' | 'synthesizing' | 'completed' | 'failed';
  createdAt: string;
  updatedAt: string;
  errorInfo?: string;
}

/**
 * Base structure for all WebSocket messages.
 * @property type - Message channel/event name.
 * @property payload - Event data (varies by message).
 * @property timestamp - ISO timestamp of the message.
 */
export interface SocketMessageBase {
  type: string;
  payload?: any;
  timestamp: string;
}

/**
 * Client → Server: request to run a direct prompt.
 * @property userId - Who is calling.
 * @property promptText - Raw prompt string.
 * @property requestedModels - Array of modelIds.
 * @property executionMode - 'web' | 'api' (if from web or API).
 * @property callbackUrl - (Optional) For API mode.
 */
export interface ClientRunPromptRequest extends SocketMessageBase {
  type: 'job:run:prompt';
  payload: {
    userId: string;
    promptText: string;
    requestedModels: string[];
    executionMode?: 'web' | 'api';
    callbackUrl?: string;
  };
}

/**
 * Client → Server: request to run a predefined or ad-hoc workflow.
 * @property userId - Caller.
 * @property workflowName - Name of the YAML workflow.
 * @property inputVariables - (Optional) Override variables.
 * @property executionMode - 'web' | 'cli' | 'api'.
 * @property callbackUrl - (Optional) For API mode.
 */
export interface ClientRunWorkflowRequest extends SocketMessageBase {
  type: 'job:run:workflow';
  payload: {
    userId: string;
    workflowName: string;
    inputVariables?: Record<string, string>;
    executionMode?: 'web' | 'cli' | 'api';
    callbackUrl?: string;
  };
}

/**
 * Server → Client: job has been created and is starting.
 * @property jobId - Unique job identifier.
 * @property userId - Who submitted the job.
 * @property requestedModels - Array of modelIds.
 */
export interface ServerJobStartedEvent extends SocketMessageBase {
  type: 'job:started';
  payload: {
    jobId: string;
    userId: string;
    requestedModels: string[];
  };
}

/**
 * Server → Client: a model has returned a result.
 * @property jobId - Which job this belongs to.
 * @property modelId - Which model returned this result.
 * @property result - The model's response text.
 * @property isPartial - True if streaming and not complete.
 */
export interface ServerModelResultEvent extends SocketMessageBase {
  type: 'job:model:result';
  payload: {
    jobId: string;
    modelId: string;
    result: string;
    isPartial: boolean;
  };
}

/**
 * Server → Client: a model has failed.
 * @property jobId - Which job this belongs to.
 * @property modelId - Which model failed.
 * @property error - Error message.
 */
export interface ServerModelErrorEvent extends SocketMessageBase {
  type: 'job:model:error';
  payload: {
    jobId: string;
    modelId: string;
    error: string;
  };
}

/**
 * Server → Client: synthesis has failed.
 * @property jobId - Which job this belongs to.
 * @property error - Error message.
 */
export interface ServerSynthesisErrorEvent extends SocketMessageBase {
  type: 'job:synthesis:error';
  payload: {
    jobId: string;
    error: string;
  };
}

/**
 * Server → Client: job is complete.
 * @property jobId - Which job is complete.
 * @property results - Map from modelId → text.
 * @property synthesis - Final synthesis text.
 */
export interface ServerJobCompleteEvent extends SocketMessageBase {
  type: 'job:complete';
  payload: {
    jobId: string;
    results: Record<string, string>;
    synthesis: string;
  };
}

/**
 * Server → Client: token has been refreshed.
 * @property userId - Whose token was refreshed.
 * @property providerId - Which provider's token.
 */
export interface ServerTokenRefreshedEvent extends SocketMessageBase {
  type: 'auth:token:refreshed';
  payload: {
    userId: string;
    providerId: string;
  };
}

/**
 * Server → Client: reauthentication required.
 * @property userId - Who needs to reauthenticate.
 * @property providerId - Which provider needs reauth.
 * @property reason - Why reauth is needed.
 */
export interface ServerReauthRequiredEvent extends SocketMessageBase {
  type: 'auth:reauth:required';
  payload: {
    userId: string;
    providerId: string;
    reason: string;
  };
}

/**
 * Extension → Server: browser session is invalid.
 * @property userId - Whose session is invalid.
 * @property providerId - Which provider's session.
 * @property tabId - Which browser tab.
 */
export interface ExtensionSessionInvalidEvent extends SocketMessageBase {
  type: 'extension:session:invalid';
  payload: {
    userId: string;
    providerId: string;
    tabId: number;
  };
}

// [TODO: Add any additional types or interfaces as the platform evolves]
