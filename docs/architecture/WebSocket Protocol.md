# WebSocket Protocol

This document outlines the WebSocket protocol used for real-time communication between clients and the Hybrid Thinking backend. The WebSocket interface enables live updates during job execution, streaming model responses, and handling authentication events.

## Connection Establishment

### WebSocket URL

```
wss://api.hybridthinking.ai/v1/ws
```

### Authentication

Authentication is performed by including a JWT token as a query parameter:

```
wss://api.hybridthinking.ai/v1/ws?token=<jwt_token>
```

## Message Format

All WebSocket messages follow a consistent format:

```json
{
  "type": "message_type",
  "payload": {
    // Message-specific data
  },
  "timestamp": "2025-06-05T05:32:33.000Z"
}
```

- `type`: String identifier for the message type
- `payload`: Object containing message-specific data
- `timestamp`: ISO 8601 timestamp of when the message was sent

## Client → Server Messages

### Run Direct Prompt

Requests execution of a prompt across multiple models.

```json
{
  "type": "job:run:prompt",
  "payload": {
    "userId": "user-123",
    "promptText": "Explain quantum computing in simple terms",
    "requestedModels": ["gpt-4", "claude", "browser:perplexity"],
    "executionMode": "web",
    "callbackUrl": "https://example.com/webhook"
  },
  "timestamp": "2025-06-05T05:32:33.000Z"
}
```

### Run Workflow

Requests execution of a predefined or ad-hoc workflow.

```json
{
  "type": "job:run:workflow",
  "payload": {
    "userId": "user-123",
    "workflowName": "content_research",
    "inputVariables": {
      "topic": "quantum computing",
      "audience": "beginners"
    },
    "executionMode": "web",
    "callbackUrl": "https://example.com/webhook"
  },
  "timestamp": "2025-06-05T05:32:33.000Z"
}
```

### Run Prompt in Browser

Requests the extension to run a prompt in a specific browser tab.

```json
{
  "type": "extension:run:prompt",
  "payload": {
    "promptId": "prompt-123",
    "model": "browser:chatgpt",
    "text": "Explain quantum computing in simple terms"
  },
  "timestamp": "2025-06-05T05:32:33.000Z"
}
```

### Cancel Job

Requests cancellation of an in-progress job.

```json
{
  "type": "job:cancel",
  "payload": {
    "jobId": "job-123",
    "userId": "user-123"
  },
  "timestamp": "2025-06-05T05:32:33.000Z"
}
```

## Server → Client Messages

### Job Started

Indicates that a job has been created and is starting.

```json
{
  "type": "job:started",
  "payload": {
    "jobId": "job-123",
    "userId": "user-123",
    "requestedModels": ["gpt-4", "claude", "browser:perplexity"]
  },
  "timestamp": "2025-06-05T05:32:33.000Z"
}
```

### Model Result

Provides a result from a specific model, which may be partial if streaming.

```json
{
  "type": "job:model:result",
  "payload": {
    "jobId": "job-123",
    "modelId": "gpt-4",
    "result": "Quantum computing is a type of computing that...",
    "isPartial": false
  },
  "timestamp": "2025-06-05T05:32:33.000Z"
}
```

### Model Error

Indicates that a model has failed to produce a result.

```json
{
  "type": "job:model:error",
  "payload": {
    "jobId": "job-123",
    "modelId": "claude",
    "error": "API rate limit exceeded"
  },
  "timestamp": "2025-06-05T05:32:33.000Z"
}
```

### Synthesis Error

Indicates that the synthesis stage has failed.

```json
{
  "type": "job:synthesis:error",
  "payload": {
    "jobId": "job-123",
    "error": "Synthesis model unavailable"
  },
  "timestamp": "2025-06-05T05:32:33.000Z"
}
```

### Job Complete

Indicates that a job has completed successfully.

```json
{
  "type": "job:complete",
  "payload": {
    "jobId": "job-123",
    "results": {
      "gpt-4": "Quantum computing is a type of computing that...",
      "claude": "Quantum computers use quantum bits or qubits...",
      "browser:perplexity": "Unlike classical computers that use bits..."
    },
    "synthesis": "Quantum computing is a revolutionary approach to computation that..."
  },
  "timestamp": "2025-06-05T05:32:33.000Z"
}
```

### Token Refreshed

Indicates that a token has been successfully refreshed.

```json
{
  "type": "auth:token:refreshed",
  "payload": {
    "userId": "user-123",
    "providerId": "openai"
  },
  "timestamp": "2025-06-05T05:32:33.000Z"
}
```

### Reauth Required

Indicates that reauthentication is required for a provider.

```json
{
  "type": "auth:reauth:required",
  "payload": {
    "userId": "user-123",
    "providerId": "browser:chatgpt",
    "reason": "Session expired"
  },
  "timestamp": "2025-06-05T05:32:33.000Z"
}
```

## Extension → Server Messages

### Prompt Result

Provides the result of a prompt executed in a browser tab.

```json
{
  "type": "extension:prompt:result",
  "payload": {
    "promptId": "prompt-123",
    "text": "Quantum computing uses quantum bits or qubits..."
  },
  "timestamp": "2025-06-05T05:32:33.000Z"
}
```

### Session Invalid

Indicates that a browser session is no longer valid.

```json
{
  "type": "extension:session:invalid",
  "payload": {
    "userId": "user-123",
    "providerId": "browser:chatgpt",
    "tabId": 12345
  },
  "timestamp": "2025-06-05T05:32:33.000Z"
}
```

## Connection Management

### Heartbeat

To maintain connection health, the server sends periodic heartbeat messages:

```json
{
  "type": "heartbeat",
  "timestamp": "2025-06-05T05:32:33.000Z"
}
```

Clients should respond with:

```json
{
  "type": "heartbeat:ack",
  "timestamp": "2025-06-05T05:32:33.000Z"
}
```

### Reconnection Strategy

If the WebSocket connection is lost, clients should implement an exponential backoff strategy:

1. Initial reconnect attempt after 1 second
2. If unsuccessful, wait 2 seconds before next attempt
3. Double the wait time for each subsequent attempt, up to a maximum of 30 seconds
4. Continue attempting reconnection indefinitely until successful

Upon reconnection, the server will automatically resend the current state of any active jobs for the authenticated user.

## Error Handling

### Error Message Format

```json
{
  "type": "error",
  "payload": {
    "code": "error_code",
    "message": "Human-readable error message",
    "details": {
      "additional": "error-specific details"
    }
  },
  "timestamp": "2025-06-05T05:32:33.000Z"
}
```

### Common Error Codes

- `invalid_message`: Malformed message
- `unauthorized`: Authentication failure
- `rate_limited`: Rate limit exceeded
- `internal_error`: Server error

[TODO: Define specific error codes and messages for each message type]

## Implementation Notes

### Socket.io Integration

The WebSocket protocol is implemented using Socket.io, which provides additional features like automatic reconnection and fallback to HTTP long-polling when WebSockets are not available.

Client-side implementation example:

```javascript
import { io } from 'socket.io-client';

const socket = io('https://api.hybridthinking.ai/v1/ws', {
  query: { token: 'jwt_token' },
  reconnectionDelayMax: 30000,
  reconnectionAttempts: Infinity
});

socket.on('connect', () => {
  console.log('Connected to Hybrid Thinking WebSocket');
});

socket.on('job:started', (data) => {
  console.log(`Job ${data.payload.jobId} started`);
});

socket.on('job:model:result', (data) => {
  console.log(`Model ${data.payload.modelId} result:`, data.payload.result);
});

socket.on('job:complete', (data) => {
  console.log(`Job ${data.payload.jobId} complete:`, data.payload.synthesis);
});

socket.on('error', (data) => {
  console.error(`Error: ${data.payload.message}`);
});

// Send a message
socket.emit('job:run:prompt', {
  type: 'job:run:prompt',
  payload: {
    userId: 'user-123',
    promptText: 'Explain quantum computing',
    requestedModels: ['gpt-4', 'claude']
  },
  timestamp: new Date().toISOString()
});
```

### Message Validation

All messages should be validated against JSON schemas before processing. Invalid messages should result in an error response.

[TODO: Define JSON schemas for each message type]
