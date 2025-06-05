# Workflow Engine Internals

This document provides a detailed overview of the Hybrid Thinking WorkflowEngine, which orchestrates staged intelligence workflows across multiple AI models.

## Core Concepts

The WorkflowEngine is responsible for:

1. Executing prompts across multiple models in parallel or sequence
2. Collecting and managing results from each model
3. Synthesizing diverse model outputs into coherent results
4. Managing state and error handling throughout the workflow
5. Supporting different execution modes (web, CLI, API)

## Architecture

### Core Data Structures

#### 1. PromptLogs (Database)

This table captures metadata for each hybrid job:

```sql
CREATE TABLE PromptLogs (
  jobId          TEXT PRIMARY KEY,        -- UUID
  userId         TEXT NOT NULL,           -- UUID of the requester
  workflowName   TEXT,                    -- If triggered by YAML
  promptText     TEXT,                    -- Raw prompt or YAML-generated prompt
  requestedModels TEXT NOT NULL,          -- JSON array text (e.g., '["claude-sonnet","browser:chatgpt"]')
  results         TEXT NOT NULL,          -- JSON object mapping modelId → text|null
  synthesisResult TEXT,                   -- Final synthesis text (nullable)
  status          TEXT NOT NULL,          -- ENUM: 'pending','generating','synthesizing','done','failed'
  createdAt       DATETIME NOT NULL,
  updatedAt       DATETIME NOT NULL,
  errorInfo       TEXT                    -- Error message if failed
);
```

#### 2. InFlightJobs (In-Memory)

Tracks currently executing jobs:

```typescript
// In-memory map of active jobs
const inFlightJobs = new Map<string, {
  resolveSynth: (result: ModelResponse) => void;
  rejectSynth: (error: Error) => void;
  timeoutId?: NodeJS.Timeout;
}>();
```

#### 3. ExecutionContext

Maintains state for a single job execution:

```typescript
interface ExecutionContext {
  jobId: string;
  userId: string;
  workflowName?: string;
  promptText?: string;
  requestedModels: string[];
  results: Record<string, ModelResponse | { error: string } | null>;
  synthesisInput?: Record<string, string>;
  synthesisResult?: ModelResponse | { error: string } | null;
  variables: Record<string, any>;
  metadata: Record<string, any>;
  status: 'pending' | 'generating' | 'synthesizing' | 'completed' | 'failed';
  createdAt: string;
  updatedAt: string;
  errorInfo?: string;
}
```

### Primary Functions

#### 1. runHybridPrompt

```typescript
/**
 * Run a hybrid prompt across multiple models
 * @param userId User ID
 * @param promptText Prompt text
 * @param requestedModels Array of model IDs
 * @param options Optional parameters
 * @returns Promise resolving to HybridJobState
 */
async function runHybridPrompt(
  userId: string,
  promptText: string,
  requestedModels: string[],
  options?: {
    timeout?: number;
    callbackUrl?: string;
    executionMode?: 'web' | 'cli' | 'api';
  }
): Promise<HybridJobState> {
  // Generate job ID
  const jobId = generateUUID();
  
  // Create execution context
  const context: ExecutionContext = {
    jobId,
    userId,
    promptText,
    requestedModels,
    results: {},
    variables: {},
    metadata: {
      executionMode: options?.executionMode || 'web',
      callbackUrl: options?.callbackUrl
    },
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  // Initialize results map
  requestedModels.forEach(modelId => {
    context.results[modelId] = null;
  });
  
  // Insert into PromptLogs
  await db.run(`
    INSERT INTO PromptLogs (
      jobId, userId, promptText, requestedModels, results, status, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    jobId,
    userId,
    promptText,
    JSON.stringify(requestedModels),
    JSON.stringify(context.results),
    'pending',
    context.createdAt,
    context.updatedAt
  ]);
  
  // Emit job started event
  eventEmitter.emit('JOB_STARTED', {
    jobId,
    userId,
    requestedModels
  });
  
  // Create promise for job completion
  const jobPromise = new Promise<HybridJobState>((resolve, reject) => {
    // Store resolve/reject functions
    inFlightJobs.set(jobId, {
      resolveSynth: (result) => {
        // Update context with synthesis result
        context.synthesisResult = result;
        context.status = 'completed';
        context.updatedAt = new Date().toISOString();
        
        // Update database
        updateJobStatus(jobId, 'done', JSON.stringify(result));
        
        // Emit job complete event
        eventEmitter.emit('JOB_COMPLETE', {
          jobId,
          results: Object.fromEntries(
            Object.entries(context.results)
              .map(([k, v]) => [k, v && 'content' in v ? v.content : null])
          ),
          synthesis: result.content
        });
        
        // Resolve promise
        resolve(contextToJobState(context));
        
        // Clean up
        inFlightJobs.delete(jobId);
      },
      rejectSynth: (error) => {
        // Update context with error
        context.status = 'failed';
        context.errorInfo = error.message;
        context.updatedAt = new Date().toISOString();
        
        // Update database
        updateJobStatus(jobId, 'failed', null, error.message);
        
        // Emit error event
        eventEmitter.emit('JOB_ERROR', {
          jobId,
          error: error.message
        });
        
        // Reject promise
        reject(error);
        
        // Clean up
        inFlightJobs.delete(jobId);
      }
    });
    
    // Set timeout if specified
    if (options?.timeout) {
      const timeoutId = setTimeout(() => {
        const error = new Error(`Job timed out after ${options.timeout}ms`);
        inFlightJobs.get(jobId)?.rejectSynth(error);
      }, options.timeout);
      
      inFlightJobs.get(jobId)!.timeoutId = timeoutId;
    }
  });
  
  // Start model invocations
  fanOutToModels(context);
  
  return jobPromise;
}
```

#### 2. fanOutToModels

```typescript
/**
 * Fan out prompt to multiple models
 * @param context Execution context
 */
async function fanOutToModels(context: ExecutionContext): Promise<void> {
  const { jobId, userId, promptText, requestedModels } = context;
  
  // Update status
  context.status = 'generating';
  context.updatedAt = new Date().toISOString();
  await updateJobStatus(jobId, 'generating');
  
  // Get workflow definition if this is a workflow-driven job
  const workflowDef = context.workflowName 
    ? await getWorkflowDefinition(context.workflowName)
    : null;
  
  // Check if we should run in parallel
  const runParallel = workflowDef?.stages.generate.parallel !== false;
  
  if (runParallel) {
    // Run all models in parallel
    const modelPromises = requestedModels.map(modelId => 
      invokeModel(context, modelId, promptText)
        .catch(error => handleModelError(context, modelId, error))
    );
    
    // Wait for all to complete
    await Promise.all(modelPromises);
  } else {
    // Run models sequentially
    for (const modelId of requestedModels) {
      try {
        await invokeModel(context, modelId, promptText);
      } catch (error) {
        await handleModelError(context, modelId, error);
      }
    }
  }
  
  // Check if all models have completed
  const allCompleted = Object.values(context.results).every(result => result !== null);
  
  if (allCompleted) {
    // Start synthesis
    startSynthesis(context);
  }
}
```

#### 3. invokeModel

```typescript
/**
 * Invoke a single model
 * @param context Execution context
 * @param modelId Model ID
 * @param promptText Prompt text
 * @returns Promise resolving to ModelResponse
 */
async function invokeModel(
  context: ExecutionContext,
  modelId: string,
  promptText: string
): Promise<ModelResponse> {
  const { jobId, userId } = context;
  
  // Get adapter for this model
  const adapter = await adapterLoader.getAdapter(userId, modelId);
  
  // Get valid token if needed
  if (adapter.type !== 'local') {
    const providerId = modelId.split(':')[0];
    await tokenVault.getValidToken(userId, providerId);
  }
  
  // Send prompt to model
  const response = await adapter.sendPrompt(promptText, {
    streamCallback: (chunk) => {
      // For streaming models, emit partial results
      eventEmitter.emit('MODEL_RESULT', {
        jobId,
        modelId,
        result: chunk,
        isPartial: true
      });
    }
  });
  
  // Store result in context
  context.results[modelId] = response;
  
  // Update database
  const results = { ...JSON.parse(await getJobResults(jobId)), [modelId]: response };
  await db.run(`
    UPDATE PromptLogs
    SET results = ?, updatedAt = ?
    WHERE jobId = ?
  `, [
    JSON.stringify(results),
    new Date().toISOString(),
    jobId
  ]);
  
  // Emit model result event
  eventEmitter.emit('MODEL_RESULT', {
    jobId,
    modelId,
    result: response.content,
    isPartial: false
  });
  
  return response;
}
```

#### 4. handleModelError

```typescript
/**
 * Handle error from model invocation
 * @param context Execution context
 * @param modelId Model ID
 * @param error Error object
 */
async function handleModelError(
  context: ExecutionContext,
  modelId: string,
  error: Error
): Promise<void> {
  const { jobId } = context;
  
  // Check if we have a fallback model
  const fallbackModelId = getFallbackModel(modelId);
  
  if (fallbackModelId) {
    // Try fallback model
    try {
      const response = await invokeModel(context, fallbackModelId, context.promptText!);
      return;
    } catch (fallbackError) {
      // Both primary and fallback failed
      context.results[modelId] = { error: `${error.message} (Fallback also failed: ${fallbackError.message})` };
    }
  } else {
    // No fallback available
    context.results[modelId] = { error: error.message };
  }
  
  // Update database
  const results = { ...JSON.parse(await getJobResults(jobId)), [modelId]: { error: error.message } };
  await db.run(`
    UPDATE PromptLogs
    SET results = ?, updatedAt = ?
    WHERE jobId = ?
  `, [
    JSON.stringify(results),
    new Date().toISOString(),
    jobId
  ]);
  
  // Emit model error event
  eventEmitter.emit('MODEL_ERROR', {
    jobId,
    modelId,
    error: error.message
  });
  
  // Check if this failure should fail the entire job
  if (shouldFailJob(context, modelId)) {
    const jobError = new Error(`Critical model ${modelId} failed: ${error.message}`);
    inFlightJobs.get(jobId)?.rejectSynth(jobError);
  } else {
    // Check if all models have completed or failed
    const allCompleted = Object.values(context.results).every(result => result !== null);
    
    if (allCompleted) {
      // Start synthesis with available results
      startSynthesis(context);
    }
  }
}
```

#### 5. startSynthesis

```typescript
/**
 * Start synthesis of model results
 * @param context Execution context
 */
async function startSynthesis(context: ExecutionContext): Promise<void> {
  const { jobId, userId, results } = context;
  
  // Update status
  context.status = 'synthesizing';
  context.updatedAt = new Date().toISOString();
  await updateJobStatus(jobId, 'synthesizing');
  
  // Get workflow definition if this is a workflow-driven job
  const workflowDef = context.workflowName 
    ? await getWorkflowDefinition(context.workflowName)
    : null;
  
  // Determine synthesis model
  const synthesisModelId = workflowDef?.stages.synthesize.model || 'openai:gpt-4';
  
  // Prepare synthesis input
  const successfulResults = Object.entries(results)
    .filter(([_, result]) => result && 'content' in result)
    .map(([modelId, result]) => ({
      modelId,
      content: (result as ModelResponse).content
    }));
  
  context.synthesisInput = Object.fromEntries(
    successfulResults.map(({ modelId, content }) => [modelId, content])
  );
  
  // Build synthesis prompt
  let synthesisPrompt: string;
  
  if (workflowDef) {
    // Use workflow-defined synthesis prompt
    const templatePath = workflowDef.stages.synthesize.prompt_template;
    const template = await loadPromptTemplate(templatePath);
    
    // Substitute variables
    synthesisPrompt = renderTemplate(template, {
      ...context.variables,
      [workflowDef.stages.generate.steps[0].output_var]: context.synthesisInput
    });
  } else {
    // Use default synthesis prompt
    synthesisPrompt = buildDefaultSynthesisPrompt(context.synthesisInput);
  }
  
  try {
    // Get adapter for synthesis model
    const synthAdapter = await adapterLoader.getAdapter(userId, synthesisModelId);
    
    // Send synthesis prompt
    const synthOutput = await synthAdapter.sendPrompt(synthesisPrompt);
    
    // Store result and resolve promise
    inFlightJobs.get(jobId)?.resolveSynth(synthOutput);
  } catch (error) {
    // Emit synthesis error event
    eventEmitter.emit('SYNTHESIS_ERROR', {
      jobId,
      error: error.message
    });
    
    // Reject promise
    inFlightJobs.get(jobId)?.rejectSynth(error);
  }
}
```

### Parallel vs. Sequential Execution

The WorkflowEngine supports both parallel and sequential execution of generation steps:

```typescript
// Example workflow with parallel execution
const parallelWorkflow = {
  workflow_name: "parallel_research",
  stages: {
    generate: {
      parallel: true, // Run all steps in parallel
      steps: [
        {
          name: "expert_analysis",
          models: ["gpt-4", "claude", "browser:perplexity"],
          prompt_template: "research/expert_analysis.md",
          output_var: "expert_perspectives"
        }
      ]
    },
    synthesize: {
      name: "final_synthesis",
      model: "gpt-4",
      prompt_template: "synthesis/research_summary.md",
      input_vars: ["expert_perspectives"],
      output_var: "final_report"
    }
  }
};

// Example workflow with sequential execution
const sequentialWorkflow = {
  workflow_name: "sequential_research",
  stages: {
    generate: {
      parallel: false, // Run steps sequentially
      steps: [
        {
          name: "initial_research",
          models: ["gpt-4"],
          prompt_template: "research/initial_research.md",
          output_var: "initial_findings"
        },
        {
          name: "follow_up",
          models: ["claude"],
          prompt_template: "research/follow_up.md",
          input_vars: ["initial_findings"],
          output_var: "detailed_analysis"
        }
      ]
    },
    synthesize: {
      name: "final_synthesis",
      model: "gpt-4",
      prompt_template: "synthesis/sequential_summary.md",
      input_vars: ["initial_findings", "detailed_analysis"],
      output_var: "final_report"
    }
  }
};
```

### Error Recovery & Fallback

The WorkflowEngine implements several error recovery mechanisms:

1. **Model Fallbacks**: If a primary model fails, the engine can try a fallback model:

```typescript
// Fallback configuration
const modelFallbacks = {
  'openai:gpt-4': 'openai:gpt-3.5-turbo',
  'anthropic:claude-sonnet': 'anthropic:claude-instant',
  'browser:chatgpt': 'openai:gpt-3.5-turbo'
};

function getFallbackModel(modelId: string): string | null {
  return modelFallbacks[modelId] || null;
}
```

2. **Circuit Breaker**: Prevents repeated failures by temporarily disabling problematic models:

```typescript
// Circuit breaker state
const circuitState = new Map<string, {
  state: 'closed' | 'open' | 'half-open';
  failureCount: number;
  lastFailure: number;
  nextAttempt: number;
}>();

function checkCircuitBreaker(providerId: string): boolean {
  const circuit = circuitState.get(providerId);
  
  if (!circuit) {
    return true; // No circuit, allow request
  }
  
  if (circuit.state === 'closed') {
    return true; // Circuit closed, allow request
  }
  
  if (circuit.state === 'open') {
    const now = Date.now();
    if (now >= circuit.nextAttempt) {
      // Try half-open state
      circuit.state = 'half-open';
      return true;
    }
    return false; // Circuit open, block request
  }
  
  if (circuit.state === 'half-open') {
    return true; // Allow one test request
  }
  
  return true;
}

function recordSuccess(providerId: string): void {
  const circuit = circuitState.get(providerId);
  
  if (circuit && (circuit.state === 'half-open' || circuit.state === 'open')) {
    // Reset circuit on success
    circuit.state = 'closed';
    circuit.failureCount = 0;
  }
}

function recordFailure(providerId: string): void {
  let circuit = circuitState.get(providerId);
  
  if (!circuit) {
    circuit = {
      state: 'closed',
      failureCount: 0,
      lastFailure: 0,
      nextAttempt: 0
    };
    circuitState.set(providerId, circuit);
  }
  
  circuit.failureCount++;
  circuit.lastFailure = Date.now();
  
  if (circuit.failureCount >= 3) {
    // Open circuit after 3 failures
    circuit.state = 'open';
    circuit.nextAttempt = Date.now() + 30000; // Try again after 30s
  }
}
```

3. **Partial Success Handling**: The synthesis stage can proceed with partial results if some models fail:

```typescript
function shouldFailJob(context: ExecutionContext, failedModelId: string): boolean {
  // Get workflow definition
  const workflowDef = context.workflowName 
    ? getWorkflowDefinitionSync(context.workflowName)
    : null;
  
  // Check if this model is marked as critical
  if (workflowDef?.metadata?.criticalModels?.includes(failedModelId)) {
    return true;
  }
  
  // Check if we have at least one successful result
  const hasSuccessfulResults = Object.values(context.results).some(
    result => result && 'content' in result
  );
  
  // Fail job only if all models failed
  return !hasSuccessfulResults;
}
```

## YAML Workflow Specification

The WorkflowEngine is driven by YAML workflow specifications:

```yaml
workflow_name: content_research
description: "Multi-model research synthesis"

stages:
  generate:
    parallel: true
    steps:
      - name: expert_analysis
        models: [gpt-4, claude, browser:perplexity]
        prompt_template: research/expert_analysis.md
        output_var: expert_perspectives
        
  synthesize:
    name: final_synthesis  
    model: gpt-4
    prompt_template: synthesis/research_summary.md
    input_vars: [expert_perspectives]
    output_var: final_report

execution_modes:
  web: 
    realtime_updates: true
    persistence: database
  cli:
    output_format: obsidian_markdown  
    output_path: "HybridOutputs/{{workflow_name}}/{{date}}/"
  api:
    response_format: json
    webhook_url: optional
```

### YAML Parser

```typescript
/**
 * Parse a YAML workflow definition
 * @param yamlContent YAML content
 * @returns WorkflowDefinition
 */
function parseWorkflowYAML(yamlContent: string): WorkflowDefinition {
  try {
    const parsed = yaml.parse(yamlContent);
    
    // Validate required fields
    if (!parsed.workflow_name) {
      throw new Error('Missing workflow_name');
    }
    
    if (!parsed.stages || !parsed.stages.generate || !parsed.stages.synthesize) {
      throw new Error('Missing required stages (generate, synthesize)');
    }
    
    if (!Array.isArray(parsed.stages.generate.steps) || parsed.stages.generate.steps.length === 0) {
      throw new Error('Generate stage must have at least one step');
    }
    
    // Return validated workflow
    return parsed as WorkflowDefinition;
  } catch (error) {
    throw new Error(`Invalid workflow YAML: ${error.message}`);
  }
}
```

### Template Rendering

```typescript
/**
 * Render a prompt template with variables
 * @param template Template string
 * @param variables Variables to substitute
 * @returns Rendered template
 */
function renderTemplate(template: string, variables: Record<string, any>): string {
  // Replace ${{variable}} with actual values
  return template.replace(/\$\{\{([^}]+)\}\}/g, (match, varName) => {
    const value = getNestedValue(variables, varName.trim());
    
    if (value === undefined) {
      return `[Variable not found: ${varName}]`;
    }
    
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    
    return String(value);
  });
}

/**
 * Get a nested value from an object using dot notation
 * @param obj Object to get value from
 * @param path Path to value (e.g., "user.name")
 * @returns Value or undefined
 */
function getNestedValue(obj: Record<string, any>, path: string): any {
  return path.split('.').reduce((o, p) => (o ? o[p] : undefined), obj);
}
```

## Multi-Interface Support

The WorkflowEngine supports multiple execution interfaces:

### Web Interface

```typescript
/**
 * Run a job from the web interface
 * @param socket WebSocket connection
 * @param message Client message
 */
async function handleWebJobRequest(socket: WebSocket, message: ClientRunPromptRequest): Promise<void> {
  const { userId, promptText, requestedModels } = message.payload;
  
  try {
    // Run job
    const jobPromise = runHybridPrompt(userId, promptText, requestedModels, {
      executionMode: 'web'
    });
    
    // Job will emit events that are sent to the client via WebSocket
    // No need to wait for completion here
  } catch (error) {
    // Send error to client
    socket.send(JSON.stringify({
      type: 'error',
      payload: {
        code: 'job_creation_failed',
        message: error.message
      },
      timestamp: new Date().toISOString()
    }));
  }
}
```

### CLI Interface

```typescript
/**
 * Run a job from the CLI
 * @param args Command line arguments
 */
async function runCliJob(args: {
  workflow: string;
  variables?: Record<string, string>;
  output?: string;
}): Promise<void> {
  try {
    // Load workflow
    const workflowContent = await fs.readFile(args.workflow, 'utf-8');
    const workflow = parseWorkflowYAML(workflowContent);
    
    // Get user ID (from config or environment)
    const userId = getUserId();
    
    // Prepare prompt from workflow
    const promptTemplate = await loadPromptTemplate(workflow.stages.generate.steps[0].prompt_template);
    const promptText = renderTemplate(promptTemplate, args.variables || {});
    
    // Get requested models
    const requestedModels = workflow.stages.generate.steps[0].models;
    
    // Run job
    const result = await runHybridPrompt(userId, promptText, requestedModels, {
      executionMode: 'cli'
    });
    
    // Determine output path
    const outputPath = args.output || getDefaultOutputPath(workflow);
    
    // Write output
    await writeCliOutput(result, outputPath, workflow);
    
    console.log(`Job complete. Output written to ${outputPath}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}
```

### API Interface

```typescript
/**
 * Run a job from the API
 * @param req HTTP request
 * @param res HTTP response
 */
async function handleApiJobRequest(req: Request, res: Response): Promise<void> {
  const { userId, promptText, requestedModels, callbackUrl } = req.body;
  
  try {
    // Generate job ID
    const jobId = generateUUID();
    
    // Send immediate response
    res.status(202).json({ jobId });
    
    // Run job
    runHybridPrompt(userId, promptText, requestedModels, {
      executionMode: 'api',
      callbackUrl
    }).then(result => {
      // If callback URL provided, send result
      if (callbackUrl) {
        axios.post(callbackUrl, result).catch(error => {
          console.error(`Failed to send callback: ${error.message}`);
        });
      }
    }).catch(error => {
      console.error(`Job ${jobId} failed: ${error.message}`);
    });
  } catch (error) {
    res.status(400).json({
      code: 'job_creation_failed',
      message: error.message
    });
  }
}
```

## Performance Considerations

### Concurrency Management

```typescript
// Concurrency limits
const MAX_CONCURRENT_JOBS = 10;
const MAX_CONCURRENT_MODELS_PER_PROVIDER = 5;

// Track active jobs and models
const activeJobs = new Set<string>();
const activeModelsPerProvider = new Map<string, number>();

/**
 * Check if a new job can be started
 * @returns Boolean indicating if job can start
 */
function canStartNewJob(): boolean {
  return activeJobs.size < MAX_CONCURRENT_JOBS;
}

/**
 * Check if a model can be invoked
 * @param providerId Provider ID
 * @returns Boolean indicating if model can be invoked
 */
function canInvokeModel(providerId: string): boolean {
  const activeCount = activeModelsPerProvider.get(providerId) || 0;
  return activeCount < MAX_CONCURRENT_MODELS_PER_PROVIDER;
}

/**
 * Track job start
 * @param jobId Job ID
 */
function trackJobStart(jobId: string): void {
  activeJobs.add(jobId);
}

/**
 * Track job end
 * @param jobId Job ID
 */
function trackJobEnd(jobId: string): void {
  activeJobs.delete(jobId);
}

/**
 * Track model invocation start
 * @param providerId Provider ID
 */
function trackModelStart(providerId: string): void {
  const activeCount = activeModelsPerProvider.get(providerId) || 0;
  activeModelsPerProvider.set(providerId, activeCount + 1);
}

/**
 * Track model invocation end
 * @param providerId Provider ID
 */
function trackModelEnd(providerId: string): void {
  const activeCount = activeModelsPerProvider.get(providerId) || 0;
  if (activeCount > 0) {
    activeModelsPerProvider.set(providerId, activeCount - 1);
  }
}
```

### Caching

```typescript
// Simple in-memory cache for prompt templates
const templateCache = new Map<string, { content: string, expiry: number }>();
const TEMPLATE_CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Load a prompt template with caching
 * @param templatePath Path to template
 * @returns Template content
 */
async function loadPromptTemplate(templatePath: string): Promise<string> {
  const now = Date.now();
  
  // Check cache
  const cached = templateCache.get(templatePath);
  if (cached && cached.expiry > now) {
    return cached.content;
  }
  
  // Load template
  const content = await fs.readFile(templatePath, 'utf-8');
  
  // Cache template
  templateCache.set(templatePath, {
    content,
    expiry: now + TEMPLATE_CACHE_TTL
  });
  
  return content;
}
```

## Testing Considerations

### Unit Testing

```typescript
// Example test for runHybridPrompt
describe('WorkflowEngine', () => {
  describe('runHybridPrompt', () => {
    it('should create a job and return results', async () => {
      // Mock dependencies
      const mockAdapter = {
        sendPrompt: jest.fn().mockResolvedValue({
          content: 'Mock response',
          provider: 'mock',
          model: 'mock-model'
        })
      };
      
      adapterLoader.getAdapter = jest.fn().mockResolvedValue(mockAdapter);
      
      // Run test
      const result = await runHybridPrompt(
        'test-user',
        'Test prompt',
        ['mock-model']
      );
      
      // Assertions
      expect(result.status).toBe('completed');
      expect(result.results['mock-model'].content).toBe('Mock response');
      expect(result.synthesisResult.content).toBeDefined();
    });
    
    it('should handle model errors', async () => {
      // Mock dependencies
      const mockAdapter = {
        sendPrompt: jest.fn().mockRejectedValue(new Error('Mock error'))
      };
      
      adapterLoader.getAdapter = jest.fn().mockResolvedValue(mockAdapter);
      
      // Run test
      const result = await runHybridPrompt(
        'test-user',
        'Test prompt',
        ['mock-model']
      );
      
      // Assertions
      expect(result.status).toBe('failed');
      expect(result.errorInfo).toContain('Mock error');
    });
  });
});
```

### Integration Testing

```typescript
// Example integration test
describe('WorkflowEngine Integration', () => {
  it('should execute a complete workflow', async () => {
    // Create test workflow
    const workflowContent = `
      workflow_name: test_workflow
      stages:
        generate:
          parallel: true
          steps:
            - name: test_step
              models: [test-model]
              prompt_template: test/template.md
              output_var: test_output
        synthesize:
          name: test_synthesis
          model: test-model
          prompt_template: test/synthesis.md
          input_vars: [test_output]
          output_var: final_output
    `;
    
    // Write test templates
    await fs.writeFile('test/template.md', 'Test prompt');
    await fs.writeFile('test/synthesis.md', 'Synthesize: ${{test_output}}');
    
    // Mock adapter
    const mockAdapter = {
      sendPrompt: jest.fn()
        .mockImplementationOnce(() => ({
          content: 'Test model output',
          provider: 'test',
          model: 'test-model'
        }))
        .mockImplementationOnce(() => ({
          content: 'Synthesized: Test model output',
          provider: 'test',
          model: 'test-model'
        }))
    };
    
    adapterLoader.getAdapter = jest.fn().mockResolvedValue(mockAdapter);
    
    // Parse workflow
    const workflow = parseWorkflowYAML(workflowContent);
    
    // Execute workflow
    const result = await executeWorkflow('test-user', workflow, {});
    
    // Assertions
    expect(result.status).toBe('completed');
    expect(result.synthesisResult.content).toBe('Synthesized: Test model output');
  });
});
```

## Future Enhancements

[TODO: Define specific enhancements and extensions for the WorkflowEngine]

1. **Advanced Workflow Features**:
   - Conditional branching based on model outputs
   - Looping and iteration for refinement
   - User interaction points within workflows

2. **Performance Optimizations**:
   - Distributed execution across multiple nodes
   - Result caching for identical prompts
   - Adaptive concurrency management

3. **Monitoring and Observability**:
   - Detailed metrics collection
   - Performance dashboards
   - Cost tracking and optimization
