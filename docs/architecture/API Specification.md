# API Specification

This document outlines the REST API endpoints for the Hybrid Thinking platform. The API follows OpenAPI 3.0 standards and enables programmatic access to the platform's intelligence orchestration capabilities.

## Base URL

```
https://api.hybridthinking.ai/v1
```

## Authentication

All API requests require authentication using a JWT token in the Authorization header:

```
Authorization: Bearer <token>
```

## OpenAPI Specification

```yaml
openapi: 3.0.0
info:
  title: Hybrid Thinking API
  description: API for intelligence orchestration across multiple AI models
  version: 1.0.0
servers:
  - url: https://api.hybridthinking.ai/v1
    description: Production server
  - url: https://api-staging.hybridthinking.ai/v1
    description: Staging server
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
  schemas:
    Error:
      type: object
      properties:
        code:
          type: string
          description: Error code
        message:
          type: string
          description: Error message
        details:
          type: object
          description: Additional error details
    TokenData:
      type: object
      properties:
        providerId:
          type: string
          description: Provider identifier (e.g., 'openai', 'browser:chatgpt')
        accessToken:
          type: string
          description: Access token or API key
        refreshToken:
          type: string
          description: Refresh token (for OAuth providers)
        expiresAt:
          type: integer
          description: Unix timestamp (ms) when token expires
        type:
          type: string
          enum: [api, oauth, browser, local]
          description: Type of token
        scopes:
          type: array
          items:
            type: string
          description: OAuth or API scopes
    ModelResponse:
      type: object
      properties:
        id:
          type: string
          description: Optional correlation ID
        content:
          type: string
          description: Full text output from the model
        provider:
          type: string
          description: Provider name (e.g., 'openai', 'anthropic')
        model:
          type: string
          description: Model identifier (e.g., 'gpt-4', 'claude-sonnet')
        tokensUsed:
          type: object
          properties:
            input:
              type: integer
              description: Input token count
            output:
              type: integer
              description: Output token count
            total:
              type: integer
              description: Total token count
        cost:
          type: number
          format: float
          description: Cost in USD
    HybridJobState:
      type: object
      properties:
        jobId:
          type: string
          description: Unique job identifier (UUID)
        userId:
          type: string
          description: ID of requesting user
        workflowName:
          type: string
          description: Name of YAML workflow if used
        promptText:
          type: string
          description: Raw prompt if direct prompt mode
        requestedModels:
          type: array
          items:
            type: string
          description: Array of model IDs
        results:
          type: object
          additionalProperties:
            oneOf:
              - $ref: '#/components/schemas/ModelResponse'
              - type: object
                properties:
                  error:
                    type: string
              - type: 'null'
          description: Map from modelId to response or error
        synthesisResult:
          oneOf:
            - $ref: '#/components/schemas/ModelResponse'
            - type: object
              properties:
                error:
                  type: string
            - type: 'null'
          description: Final synthesis result
        status:
          type: string
          enum: [pending, generating, synthesizing, completed, failed]
          description: Current job status
        createdAt:
          type: string
          format: date-time
          description: ISO timestamp of job creation
        updatedAt:
          type: string
          format: date-time
          description: ISO timestamp of last update
        errorInfo:
          type: string
          description: Error details if job failed
    WorkflowDefinition:
      type: object
      properties:
        workflow_name:
          type: string
          description: Unique workflow name
        description:
          type: string
          description: Human-readable description
        stages:
          type: object
          properties:
            generate:
              type: object
              properties:
                parallel:
                  type: boolean
                  description: Whether to run steps in parallel
                steps:
                  type: array
                  items:
                    type: object
                    properties:
                      name:
                        type: string
                        description: Step name
                      models:
                        type: array
                        items:
                          type: string
                        description: Array of model IDs
                      prompt_template:
                        type: string
                        description: Path or key to prompt template
                      output_var:
                        type: string
                        description: Variable name for output
                      input_vars:
                        type: array
                        items:
                          type: string
                        description: Variables to substitute
            synthesize:
              type: object
              properties:
                name:
                  type: string
                  description: Synthesis step name
                model:
                  type: string
                  description: Model ID for synthesis
                prompt_template:
                  type: string
                  description: Path or key to synthesis prompt
                input_vars:
                  type: array
                  items:
                    type: string
                  description: Variables from previous stages
                output_var:
                  type: string
                  description: Variable name for synthesis output
        execution_modes:
          type: object
          properties:
            web:
              type: object
              properties:
                realtime_updates:
                  type: boolean
                persistence:
                  type: string
                  enum: [database, none]
            cli:
              type: object
              properties:
                output_format:
                  type: string
                  enum: [obsidian_markdown, json]
                output_path:
                  type: string
            api:
              type: object
              properties:
                response_format:
                  type: string
                  enum: [json]
                webhook_url:
                  type: string
security:
  - bearerAuth: []
paths:
  /tokens:
    post:
      summary: Store a new token for a provider
      operationId: storeToken
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                userId:
                  type: string
                  description: User ID
                providerId:
                  type: string
                  description: Provider ID
                tokenData:
                  $ref: '#/components/schemas/TokenData'
              required:
                - userId
                - providerId
                - tokenData
      responses:
        '200':
          description: Token stored successfully
          content:
            application/json:
              schema:
                type: object
                properties:
                  status:
                    type: string
                    enum: [success]
        '400':
          description: Invalid request
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
        '401':
          description: Unauthorized
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
    delete:
      summary: Delete a token for a provider
      operationId: deleteToken
      parameters:
        - name: userId
          in: query
          required: true
          schema:
            type: string
        - name: providerId
          in: query
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Token deleted successfully
          content:
            application/json:
              schema:
                type: object
                properties:
                  status:
                    type: string
                    enum: [success]
        '400':
          description: Invalid request
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
        '401':
          description: Unauthorized
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
  /run-hybrid:
    post:
      summary: Run a hybrid prompt job
      operationId: runHybridPrompt
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                userId:
                  type: string
                  description: User ID
                promptText:
                  type: string
                  description: Prompt text
                requestedModels:
                  type: array
                  items:
                    type: string
                  description: Array of model IDs
                callbackUrl:
                  type: string
                  description: Optional webhook URL for results
              required:
                - userId
                - promptText
                - requestedModels
      responses:
        '202':
          description: Job accepted
          content:
            application/json:
              schema:
                type: object
                properties:
                  jobId:
                    type: string
                    description: Unique job ID
        '400':
          description: Invalid request
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
        '401':
          description: Unauthorized
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
  /run-workflow:
    post:
      summary: Run a workflow job
      operationId: runWorkflow
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                userId:
                  type: string
                  description: User ID
                workflowName:
                  type: string
                  description: Workflow name
                inputVariables:
                  type: object
                  additionalProperties:
                    type: string
                  description: Input variables for workflow
                callbackUrl:
                  type: string
                  description: Optional webhook URL for results
              required:
                - userId
                - workflowName
      responses:
        '202':
          description: Job accepted
          content:
            application/json:
              schema:
                type: object
                properties:
                  jobId:
                    type: string
                    description: Unique job ID
        '400':
          description: Invalid request
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
        '401':
          description: Unauthorized
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
  /jobs/{jobId}:
    get:
      summary: Get job status and results
      operationId: getJobStatus
      parameters:
        - name: jobId
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Job details
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/HybridJobState'
        '404':
          description: Job not found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
        '401':
          description: Unauthorized
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
  /workflows:
    get:
      summary: List available workflows
      operationId: listWorkflows
      responses:
        '200':
          description: List of workflows
          content:
            application/json:
              schema:
                type: array
                items:
                  type: object
                  properties:
                    name:
                      type: string
                    description:
                      type: string
        '401':
          description: Unauthorized
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
    post:
      summary: Create or update a workflow
      operationId: createWorkflow
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/WorkflowDefinition'
      responses:
        '200':
          description: Workflow created/updated
          content:
            application/json:
              schema:
                type: object
                properties:
                  status:
                    type: string
                    enum: [success]
                  name:
                    type: string
        '400':
          description: Invalid workflow definition
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
        '401':
          description: Unauthorized
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
  /workflows/{name}:
    get:
      summary: Get workflow definition
      operationId: getWorkflow
      parameters:
        - name: name
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Workflow definition
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/WorkflowDefinition'
        '404':
          description: Workflow not found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
        '401':
          description: Unauthorized
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
    delete:
      summary: Delete a workflow
      operationId: deleteWorkflow
      parameters:
        - name: name
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Workflow deleted
          content:
            application/json:
              schema:
                type: object
                properties:
                  status:
                    type: string
                    enum: [success]
        '404':
          description: Workflow not found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
        '401':
          description: Unauthorized
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
  /models:
    get:
      summary: List available models
      operationId: listModels
      responses:
        '200':
          description: List of available models
          content:
            application/json:
              schema:
                type: array
                items:
                  type: object
                  properties:
                    id:
                      type: string
                      description: Model ID
                    type:
                      type: string
                      enum: [api, browser, local]
                      description: Model type
                    provider:
                      type: string
                      description: Provider name
                    name:
                      type: string
                      description: Human-readable name
                    capabilities:
                      type: object
                      properties:
                        streaming:
                          type: boolean
                        maxTokens:
                          type: integer
        '401':
          description: Unauthorized
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
  /models/{modelId}/health:
    get:
      summary: Check model health
      operationId: checkModelHealth
      parameters:
        - name: modelId
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Model health status
          content:
            application/json:
              schema:
                type: object
                properties:
                  ready:
                    type: boolean
                  details:
                    type: string
        '404':
          description: Model not found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
        '401':
          description: Unauthorized
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
```

## Rate Limiting

The API implements rate limiting to ensure fair usage:

- 60 requests per minute per user for most endpoints
- 10 job submissions per minute per user for `/run-hybrid` and `/run-workflow`

Rate limit headers are included in all responses:
- `X-RateLimit-Limit`: Maximum requests per minute
- `X-RateLimit-Remaining`: Remaining requests in the current window
- `X-RateLimit-Reset`: Time (in seconds) until the rate limit resets

## Webhook Callbacks

When providing a `callbackUrl` in job submission requests, the system will POST the final job state to that URL once processing is complete. The webhook payload will match the schema of `HybridJobState`.

## Error Handling

All errors follow a consistent format:

```json
{
  "code": "error_code",
  "message": "Human-readable error message",
  "details": {
    "additional": "error-specific details"
  }
}
```

Common error codes:
- `invalid_request`: Malformed request
- `unauthorized`: Authentication failure
- `not_found`: Resource not found
- `rate_limited`: Rate limit exceeded
- `model_error`: Error from model provider
- `internal_error`: Server error

[TODO: Define specific error codes and messages for each endpoint]
