# API Gateway Service

## Overview

The API Gateway service is the main entry point for programmatic access to the Hybrid Thinking platform. It provides RESTful API endpoints for running hybrid prompts, managing workflows, and handling user credentials.

## Features

- RESTful API for hybrid prompt execution
- Workflow management (create, read, update, delete)
- Token management for model providers
- Model registry access
- Job status monitoring
- Authentication and authorization

## Architecture

The API Gateway is built using Express.js and TypeScript, following a modular architecture:

```
api-gateway/
├── src/
│   ├── controllers/    # Request handlers
│   ├── middleware/     # Express middleware
│   ├── routes/         # API route definitions
│   ├── services/       # Business logic
│   ├── utils/          # Utility functions
│   └── index.ts        # Entry point
├── package.json
└── tsconfig.json
```

## API Endpoints

The service exposes the following main endpoints:

- `POST /run-hybrid`: Run a hybrid prompt across multiple models
- `POST /run-workflow`: Run a predefined workflow
- `GET /jobs/:jobId`: Get job status and results
- `GET /workflows`: List available workflows
- `POST /workflows`: Create or update a workflow
- `GET /workflows/:name`: Get workflow definition
- `DELETE /workflows/:name`: Delete a workflow
- `GET /models`: List available models
- `GET /models/:modelId/health`: Check model health
- `POST /tokens`: Store a token for a provider
- `DELETE /tokens`: Delete a token for a provider

For detailed API specifications, see the [API Specification](../architecture/API_SPECIFICATION.md) document.

## Dependencies

The API Gateway depends on the following core components:

- **WorkflowEngine**: For executing hybrid prompts and workflows
- **UniversalModelRegistry**: For accessing AI models
- **TokenVault**: For secure credential management
- **ExecutionContext**: For maintaining job state

## Configuration

The service is configured using environment variables:

```
# Server configuration
PORT=3000
HOST=0.0.0.0
NODE_ENV=development

# Database configuration
DATABASE_URL=sqlite:./data.db

# Security configuration
JWT_SECRET=your-jwt-secret
ENCRYPTION_KEY=your-encryption-key

# Logging configuration
LOG_LEVEL=info

# CORS configuration
CORS_ORIGIN=*
```

## Getting Started

### Prerequisites

- Node.js 18 or higher
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/hybrid-thinking.git

# Navigate to the API Gateway directory
cd hybrid-thinking/services/api-gateway

# Install dependencies
npm install
```

### Development

```bash
# Start the development server
npm run dev

# The server will be available at http://localhost:3000
```

### Building for Production

```bash
# Build the service
npm run build

# Start the production server
npm start
```

## Authentication

The API Gateway uses JWT (JSON Web Token) for authentication. All API requests must include a valid JWT token in the Authorization header:

```
Authorization: Bearer <token>
```

### Token Generation

Tokens are generated during the user authentication process. The authentication flow is as follows:

1. User logs in through the web interface or CLI
2. Upon successful authentication, a JWT token is generated
3. The token contains the user's ID and permissions
4. The token is returned to the client for use in subsequent API requests

### Token Validation

All API requests go through the authentication middleware, which:

1. Extracts the token from the Authorization header
2. Verifies the token signature using the JWT_SECRET
3. Checks if the token has expired
4. Extracts the user ID and permissions from the token
5. Attaches the user information to the request object for use in controllers

## Error Handling

The API Gateway implements a standardized error handling approach:

```typescript
// Error response format
interface ErrorResponse {
  code: string;
  message: string;
  details?: any;
}

// Error middleware
function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  const statusCode = err.statusCode || 500;
  const errorCode = err.code || 'internal_error';
  const message = err.message || 'An unexpected error occurred';
  
  res.status(statusCode).json({
    code: errorCode,
    message: message,
    details: err.details
  });
  
  // Log error
  logger.error(`${statusCode} ${errorCode}: ${message}`, {
    path: req.path,
    method: req.method,
    details: err.details
  });
}
```

## Rate Limiting

To prevent abuse, the API Gateway implements rate limiting:

```typescript
import rateLimit from 'express-rate-limit';

// General rate limit: 60 requests per minute
const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  standardHeaders: true,
  legacyHeaders: false
});

// Job submission rate limit: 10 requests per minute
const jobLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  standardHeaders: true,
  legacyHeaders: false
});

// Apply rate limiting
app.use(generalLimiter);
app.use('/run-hybrid', jobLimiter);
app.use('/run-workflow', jobLimiter);
```

## Logging

The API Gateway uses a structured logging approach:

```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    logger.info(`${req.method} ${req.path}`, {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: duration,
      userAgent: req.headers['user-agent'],
      ip: req.ip
    });
  });
  
  next();
});
```

## Testing

The API Gateway includes comprehensive tests:

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

Test structure:

```
__tests__/
├── unit/
│   ├── controllers/
│   ├── middleware/
│   └── services/
├── integration/
│   └── api/
└── e2e/
```

## Deployment

The API Gateway can be deployed using Docker:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist/ ./dist/

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

Build and run:

```bash
# Build Docker image
docker build -t hybrid-thinking/api-gateway .

# Run Docker container
docker run -p 3000:3000 -e DATABASE_URL=sqlite:/data/data.db -v ./data:/data hybrid-thinking/api-gateway
```

## Future Enhancements

[TODO: Define specific enhancements for the API Gateway]

1. **GraphQL API**: Add GraphQL support for more flexible queries
2. **WebSocket Integration**: Tighter integration with WebSocket server for real-time updates
3. **API Versioning**: Support for multiple API versions
4. **Enhanced Analytics**: Track API usage patterns and performance metrics
