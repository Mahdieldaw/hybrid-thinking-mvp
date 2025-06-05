# Adapter Development Guide

## Overview

This guide provides comprehensive instructions for developing adapters for the Hybrid Thinking platform. Adapters are the bridge between the platform and various AI models, enabling the Universal Model Registry to interact with any model through a consistent interface.

## Adapter Types

The platform supports three types of adapters:

1. **API Adapters**: Connect to models via REST APIs (OpenAI, Anthropic, Azure, etc.)
2. **Browser Adapters**: Connect to models via the browser extension (ChatGPT, Claude, Perplexity, etc.)
3. **Local Adapters**: Connect to models running locally (Ollama, LlamaCpp, etc.)

## Adapter Interface

All adapters must implement the `ModelAdapter` interface from the common types package:

```typescript
import { ModelAdapter, PromptOptions, ModelResponse } from '@hybrid-thinking/common-types';

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
```

## Creating a New Adapter

### 1. Basic Structure

Create a new file in the appropriate directory:
- API adapters: `core/adapters/src/api/`
- Browser adapters: `core/adapters/src/browser/`
- Local adapters: `core/adapters/src/local/`

```typescript
// Example: core/adapters/src/api/openai-adapter.ts
import { ModelAdapter, PromptOptions, ModelResponse, TokenData } from '@hybrid-thinking/common-types';
import { TokenVault } from '@hybrid-thinking/token-vault';

export class OpenAIAdapter implements ModelAdapter {
  id: string;
  type: 'api';
  supportsStreaming: boolean;
  private tokenVault: TokenVault;
  private userId: string;
  
  constructor(modelId: string, userId: string, tokenVault: TokenVault) {
    this.id = modelId;
    this.type = 'api';
    this.supportsStreaming = true;
    this.tokenVault = tokenVault;
    this.userId = userId;
  }
  
  async sendPrompt(prompt: string, options?: PromptOptions): Promise<ModelResponse> {
    // Implementation details below
  }
  
  async healthCheck(): Promise<{ ready: boolean; details?: string }> {
    // Implementation details below
  }
}
```

### 2. Implementing sendPrompt

The `sendPrompt` method is the core of any adapter. It should:
1. Get credentials from the TokenVault
2. Format the request for the specific model provider
3. Send the request to the model
4. Parse the response into the standard ModelResponse format
5. Handle errors appropriately

```typescript
async sendPrompt(prompt: string, options?: PromptOptions): Promise<ModelResponse> {
  try {
    // Get credentials from TokenVault
    const tokenData = await this.tokenVault.getValidToken(this.userId, 'openai');
    
    // Extract model name from ID (e.g., 'openai:gpt-4' -> 'gpt-4')
    const modelName = this.id.split(':')[1];
    
    // Prepare request payload
    const payload = {
      model: modelName,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: options?.maxTokens || 2048,
      temperature: options?.temperature || 0.7,
      stream: !!options?.streamCallback
    };
    
    // Handle streaming if requested
    if (options?.streamCallback) {
      return this.handleStreamingRequest(payload, tokenData, options.streamCallback);
    }
    
    // Send request
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenData.accessToken}`
      },
      body: JSON.stringify(payload)
    });
    
    // Check for errors
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
    }
    
    // Parse response
    const data = await response.json();
    
    // Format as ModelResponse
    return {
      id: data.id,
      content: data.choices[0].message.content,
      provider: 'openai',
      model: modelName,
      tokensUsed: {
        input: data.usage.prompt_tokens,
        output: data.usage.completion_tokens,
        total: data.usage.total_tokens
      },
      cost: this.calculateCost(modelName, data.usage),
      rawResponse: data
    };
  } catch (error) {
    // Handle errors
    throw new Error(`OpenAI adapter error: ${error.message}`);
  }
}

// Helper method for streaming requests
private async handleStreamingRequest(
  payload: any,
  tokenData: TokenData,
  streamCallback: (chunk: string) => void
): Promise<ModelResponse> {
  // Implementation of streaming logic
  // ...
}

// Helper method to calculate cost
private calculateCost(model: string, usage: { prompt_tokens: number; completion_tokens: number }): number {
  // Cost calculation based on model and token usage
  // ...
}
```

### 3. Implementing healthCheck

The `healthCheck` method verifies that the model is accessible:

```typescript
async healthCheck(): Promise<{ ready: boolean; details?: string }> {
  try {
    // Get credentials from TokenVault
    const tokenData = await this.tokenVault.getValidToken(this.userId, 'openai');
    
    // Send a simple request to check API availability
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${tokenData.accessToken}`
      }
    });
    
    if (!response.ok) {
      return {
        ready: false,
        details: `API returned status ${response.status}: ${response.statusText}`
      };
    }
    
    return { ready: true };
  } catch (error) {
    return {
      ready: false,
      details: error.message
    };
  }
}
```

## Browser Adapter Example

Browser adapters are different as they communicate with the extension:

```typescript
// Example: core/adapters/src/browser/chatgpt-adapter.ts
import { ModelAdapter, PromptOptions, ModelResponse } from '@hybrid-thinking/common-types';
import { ExtensionCoordinator } from '@hybrid-thinking/extension-coordinator';

export class ChatGPTAdapter implements ModelAdapter {
  id: string;
  type: 'browser';
  supportsStreaming: boolean;
  private extensionCoordinator: ExtensionCoordinator;
  private userId: string;
  
  constructor(modelId: string, userId: string, extensionCoordinator: ExtensionCoordinator) {
    this.id = modelId;
    this.type = 'browser';
    this.supportsStreaming = false; // Browser adapters typically don't support streaming
    this.extensionCoordinator = extensionCoordinator;
    this.userId = userId;
  }
  
  async sendPrompt(prompt: string, options?: PromptOptions): Promise<ModelResponse> {
    try {
      // Generate a unique prompt ID
      const promptId = `prompt-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
      
      // Send prompt to extension via coordinator
      const result = await this.extensionCoordinator.runPrompt(
        this.userId,
        promptId,
        this.id,
        prompt
      );
      
      // Format as ModelResponse
      return {
        id: promptId,
        content: result.text,
        provider: 'browser',
        model: this.id.split(':')[1],
        metadata: {
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      throw new Error(`ChatGPT adapter error: ${error.message}`);
    }
  }
  
  async healthCheck(): Promise<{ ready: boolean; details?: string }> {
    try {
      // Check if the extension has a valid session for this model
      const sessionStatus = await this.extensionCoordinator.checkSession(
        this.userId,
        this.id
      );
      
      return {
        ready: sessionStatus.valid,
        details: sessionStatus.valid ? undefined : 'No valid session found'
      };
    } catch (error) {
      return {
        ready: false,
        details: error.message
      };
    }
  }
}
```

## Local Adapter Example

Local adapters connect to models running on the local machine:

```typescript
// Example: core/adapters/src/local/ollama-adapter.ts
import { ModelAdapter, PromptOptions, ModelResponse } from '@hybrid-thinking/common-types';
import fetch from 'node-fetch';

export class OllamaAdapter implements ModelAdapter {
  id: string;
  type: 'local';
  supportsStreaming: boolean;
  private baseUrl: string;
  
  constructor(modelId: string, baseUrl: string = 'http://localhost:11434') {
    this.id = modelId;
    this.type = 'local';
    this.supportsStreaming = true;
    this.baseUrl = baseUrl;
  }
  
  async sendPrompt(prompt: string, options?: PromptOptions): Promise<ModelResponse> {
    try {
      // Extract model name from ID (e.g., 'local:llama3' -> 'llama3')
      const modelName = this.id.split(':')[1];
      
      // Prepare request payload
      const payload = {
        model: modelName,
        prompt: prompt,
        stream: !!options?.streamCallback
      };
      
      // Handle streaming if requested
      if (options?.streamCallback) {
        return this.handleStreamingRequest(payload, options.streamCallback);
      }
      
      // Send request
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      // Check for errors
      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.statusText}`);
      }
      
      // Parse response
      const data = await response.json();
      
      // Format as ModelResponse
      return {
        content: data.response,
        provider: 'local',
        model: modelName,
        metadata: {
          timestamp: new Date().toISOString(),
          totalDuration: data.total_duration
        }
      };
    } catch (error) {
      throw new Error(`Ollama adapter error: ${error.message}`);
    }
  }
  
  async healthCheck(): Promise<{ ready: boolean; details?: string }> {
    try {
      // Check if Ollama is running and the model is available
      const response = await fetch(`${this.baseUrl}/api/tags`);
      
      if (!response.ok) {
        return {
          ready: false,
          details: `Ollama API returned status ${response.status}: ${response.statusText}`
        };
      }
      
      const data = await response.json();
      const modelName = this.id.split(':')[1];
      const modelExists = data.models.some((model: any) => model.name === modelName);
      
      if (!modelExists) {
        return {
          ready: false,
          details: `Model ${modelName} not found in Ollama`
        };
      }
      
      return { ready: true };
    } catch (error) {
      return {
        ready: false,
        details: error.message
      };
    }
  }
  
  // Helper method for streaming requests
  private async handleStreamingRequest(
    payload: any,
    streamCallback: (chunk: string) => void
  ): Promise<ModelResponse> {
    // Implementation of streaming logic
    // ...
  }
}
```

## Registering Adapters

Adapters must be registered in the Universal Model Registry:

```typescript
// Example: core/adapters/src/index.ts
import { OpenAIAdapter } from './api/openai-adapter';
import { ChatGPTAdapter } from './browser/chatgpt-adapter';
import { OllamaAdapter } from './local/ollama-adapter';

// Export all adapters
export {
  OpenAIAdapter,
  ChatGPTAdapter,
  OllamaAdapter
};

// Adapter factory
export function createAdapter(
  modelId: string,
  userId: string,
  dependencies: {
    tokenVault?: TokenVault;
    extensionCoordinator?: ExtensionCoordinator;
  }
) {
  const [provider, model] = modelId.split(':');
  
  switch (provider) {
    case 'openai':
      return new OpenAIAdapter(modelId, userId, dependencies.tokenVault!);
    case 'browser':
      return new ChatGPTAdapter(modelId, userId, dependencies.extensionCoordinator!);
    case 'local':
      return new OllamaAdapter(modelId);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}
```

## Model Registry Configuration

Models are registered in a configuration file:

```json
// configs/models.json
{
  "models": [
    {
      "id": "openai:gpt-4",
      "type": "api",
      "provider": "openai",
      "name": "GPT-4",
      "capabilities": {
        "streaming": true,
        "maxTokens": 8192
      }
    },
    {
      "id": "openai:gpt-3.5-turbo",
      "type": "api",
      "provider": "openai",
      "name": "GPT-3.5 Turbo",
      "capabilities": {
        "streaming": true,
        "maxTokens": 4096
      }
    },
    {
      "id": "anthropic:claude-sonnet",
      "type": "api",
      "provider": "anthropic",
      "name": "Claude Sonnet",
      "capabilities": {
        "streaming": true,
        "maxTokens": 200000
      }
    },
    {
      "id": "browser:chatgpt",
      "type": "browser",
      "provider": "browser",
      "name": "ChatGPT (Browser)",
      "capabilities": {
        "streaming": false
      }
    },
    {
      "id": "browser:claude",
      "type": "browser",
      "provider": "browser",
      "name": "Claude (Browser)",
      "capabilities": {
        "streaming": false
      }
    },
    {
      "id": "local:llama3",
      "type": "local",
      "provider": "local",
      "name": "Llama 3 (Local)",
      "capabilities": {
        "streaming": true
      }
    }
  ]
}
```

## Error Handling

Adapters should implement robust error handling:

```typescript
try {
  // API call or other operation
} catch (error) {
  // Determine error type
  if (error.response?.status === 401) {
    throw new Error(`Authentication error: ${error.message}`);
  } else if (error.response?.status === 429) {
    throw new Error(`Rate limit exceeded: ${error.message}`);
  } else if (error.code === 'ECONNREFUSED') {
    throw new Error(`Connection refused: ${error.message}`);
  } else {
    throw new Error(`Unexpected error: ${error.message}`);
  }
}
```

## Testing Adapters

Each adapter should include comprehensive tests:

```typescript
// Example: core/adapters/__tests__/openai-adapter.test.ts
import { OpenAIAdapter } from '../src/api/openai-adapter';
import { TokenVault } from '@hybrid-thinking/token-vault';

// Mock TokenVault
const mockTokenVault = {
  getValidToken: jest.fn().mockResolvedValue({
    accessToken: 'mock-token',
    type: 'api'
  })
} as unknown as TokenVault;

// Mock fetch
global.fetch = jest.fn();

describe('OpenAIAdapter', () => {
  let adapter: OpenAIAdapter;
  
  beforeEach(() => {
    adapter = new OpenAIAdapter('openai:gpt-4', 'user-123', mockTokenVault);
    jest.clearAllMocks();
  });
  
  describe('sendPrompt', () => {
    it('should send a prompt and return a response', async () => {
      // Mock successful response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'response-123',
          choices: [{ message: { content: 'Mock response' } }],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 20,
            total_tokens: 30
          }
        })
      });
      
      const response = await adapter.sendPrompt('Test prompt');
      
      // Verify TokenVault was called
      expect(mockTokenVault.getValidToken).toHaveBeenCalledWith('user-123', 'openai');
      
      // Verify fetch was called with correct parameters
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer mock-token'
          }),
          body: expect.any(String)
        })
      );
      
      // Verify response format
      expect(response).toEqual({
        id: 'response-123',
        content: 'Mock response',
        provider: 'openai',
        model: 'gpt-4',
        tokensUsed: {
          input: 10,
          output: 20,
          total: 30
        },
        cost: expect.any(Number),
        rawResponse: expect.any(Object)
      });
    });
    
    it('should handle API errors', async () => {
      // Mock error response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        json: async () => ({
          error: {
            message: 'Rate limit exceeded'
          }
        })
      });
      
      await expect(adapter.sendPrompt('Test prompt')).rejects.toThrow(
        'OpenAI adapter error: OpenAI API error: Rate limit exceeded'
      );
    });
  });
  
  describe('healthCheck', () => {
    it('should return ready: true when API is available', async () => {
      // Mock successful response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true
      });
      
      const result = await adapter.healthCheck();
      
      expect(result).toEqual({ ready: true });
    });
    
    it('should return ready: false when API is unavailable', async () => {
      // Mock error response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable'
      });
      
      const result = await adapter.healthCheck();
      
      expect(result).toEqual({
        ready: false,
        details: 'API returned status 503: Service Unavailable'
      });
    });
  });
});
```

## Best Practices

### 1. Error Handling

- Implement comprehensive error handling
- Categorize errors (authentication, rate limiting, network, etc.)
- Provide clear error messages
- Include relevant context in error details

### 2. Credential Management

- Never hardcode credentials
- Always use TokenVault for credential management
- Handle token refresh automatically
- Implement circuit breaker pattern for authentication failures

### 3. Response Formatting

- Always normalize responses to the ModelResponse format
- Include all available metadata
- Calculate token usage and cost when available
- Preserve raw response for debugging

### 4. Performance Optimization

- Implement connection pooling for API adapters
- Use streaming when available and requested
- Implement timeout handling
- Consider implementing caching for identical prompts

### 5. Testing

- Write comprehensive unit tests
- Mock external dependencies
- Test error scenarios
- Test with real credentials in integration tests (using environment variables)

## Troubleshooting

### Common Issues

1. **Authentication Failures**
   - Check if the token is valid
   - Verify the token has the correct permissions
   - Check if the token has expired

2. **Rate Limiting**
   - Implement exponential backoff
   - Consider using multiple API keys
   - Monitor usage and implement quota management

3. **Network Issues**
   - Implement retry logic
   - Use circuit breaker pattern
   - Log detailed error information

## Future Enhancements

[TODO: Define specific enhancements for adapters]

1. **Adapter Discovery**: Automatic discovery and registration of adapters
2. **Dynamic Loading**: Load adapters dynamically at runtime
3. **Adapter Versioning**: Support for multiple versions of the same adapter
4. **Adapter Metrics**: Collect and report performance metrics
