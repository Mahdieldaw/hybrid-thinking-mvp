# Project Folder Structure Guide

This document outlines the recommended folder structure for the Hybrid Thinking MVP project, providing a clear organization for the monorepo architecture.

## Overview

The Hybrid Thinking project is organized as a monorepo with the following top-level directories:

```
hybrid-thinking/
├── apps/               # Frontend applications
├── services/           # Backend services
├── packages/           # Shared libraries and utilities
├── core/               # Core platform components
├── configs/            # Configuration files
├── docs/               # Documentation
├── scripts/            # Build and utility scripts
└── tools/              # Development tools
```

## Directory Structure Details

### apps/

Contains frontend applications and user-facing interfaces:

```
apps/
├── web-app/            # React web application
│   ├── public/         # Static assets
│   ├── src/            # Source code
│   │   ├── components/ # React components
│   │   ├── pages/      # Page components
│   │   ├── store/      # Redux store
│   │   ├── hooks/      # Custom React hooks
│   │   ├── utils/      # Utility functions
│   │   └── App.tsx     # Main application component
│   ├── package.json    # Dependencies and scripts
│   └── README.md       # Application-specific documentation
│
├── browser-extension/  # Chrome extension
│   ├── src/            # Source code
│   │   ├── background/ # Background script
│   │   ├── content/    # Content scripts
│   │   ├── popup/      # Popup UI
│   │   └── utils/      # Utility functions
│   ├── manifest.json   # Extension manifest
│   ├── package.json    # Dependencies and scripts
│   └── README.md       # Extension-specific documentation
│
└── cli/               # Command-line interface
    ├── src/           # Source code
    │   ├── commands/  # CLI commands
    │   └── utils/     # Utility functions
    ├── bin/           # Executable scripts
    ├── package.json   # Dependencies and scripts
    └── README.md      # CLI-specific documentation
```

### services/

Contains backend services and API endpoints:

```
services/
├── api-gateway/        # Main API service
│   ├── src/            # Source code
│   │   ├── controllers/# API controllers
│   │   ├── middleware/ # Express middleware
│   │   ├── routes/     # API routes
│   │   ├── services/   # Business logic
│   │   └── index.ts    # Entry point
│   ├── package.json    # Dependencies and scripts
│   └── README.md       # Service-specific documentation
│
└── websocket-server/   # WebSocket server
    ├── src/            # Source code
    │   ├── handlers/   # WebSocket event handlers
    │   ├── middleware/ # WebSocket middleware
    │   └── index.ts    # Entry point
    ├── package.json    # Dependencies and scripts
    └── README.md       # Service-specific documentation
```

### packages/

Contains shared libraries and utilities used across the project:

```
packages/
├── core-libs/          # Core libraries
│   ├── common-types/   # Shared TypeScript interfaces
│   │   ├── src/        # Source code
│   │   ├── package.json# Dependencies and scripts
│   │   └── README.md   # Library-specific documentation
│   │
│   ├── utils/          # Shared utility functions
│   │   ├── src/        # Source code
│   │   ├── package.json# Dependencies and scripts
│   │   └── README.md   # Library-specific documentation
│   │
│   └── ui-components/  # Shared UI components
│       ├── src/        # Source code
│       ├── package.json# Dependencies and scripts
│       └── README.md   # Library-specific documentation
│
└── test-utils/         # Testing utilities
    ├── src/            # Source code
    ├── package.json    # Dependencies and scripts
    └── README.md       # Library-specific documentation
```

### core/

Contains core platform components:

```
core/
├── workflow-engine/    # Workflow execution engine
│   ├── src/            # Source code
│   │   ├── execution/  # Execution logic
│   │   ├── parser/     # YAML parser
│   │   ├── templates/  # Template rendering
│   │   └── index.ts    # Entry point
│   ├── package.json    # Dependencies and scripts
│   └── README.md       # Component-specific documentation
│
├── adapters/           # Model adapters
│   ├── src/            # Source code
│   │   ├── api/        # API adapters (OpenAI, Claude, etc.)
│   │   ├── browser/    # Browser adapters
│   │   ├── local/      # Local model adapters
│   │   └── index.ts    # Entry point
│   ├── package.json    # Dependencies and scripts
│   └── README.md       # Component-specific documentation
│
├── token-vault/        # Credential management
│   ├── src/            # Source code
│   │   ├── encryption/ # Encryption utilities
│   │   ├── storage/    # Token storage
│   │   ├── refresh/    # Token refresh logic
│   │   └── index.ts    # Entry point
│   ├── package.json    # Dependencies and scripts
│   └── README.md       # Component-specific documentation
│
└── extension-coordinator/ # Extension communication
    ├── src/            # Source code
    │   ├── messaging/  # WebSocket messaging
    │   ├── session/    # Session management
    │   └── index.ts    # Entry point
    ├── package.json    # Dependencies and scripts
    └── README.md       # Component-specific documentation
```

### configs/

Contains configuration files for various tools and environments:

```
configs/
├── eslint/             # ESLint configurations
├── typescript/         # TypeScript configurations
├── jest/               # Jest test configurations
├── webpack/            # Webpack configurations
├── env/                # Environment configurations
│   ├── development.env # Development environment
│   ├── staging.env     # Staging environment
│   └── production.env  # Production environment
└── models.json         # Model registry configuration
```

### docs/

Contains project documentation:

```
docs/
├── architecture/       # Architecture documentation
│   ├── ARCHITECTURE_OVERVIEW.md
│   ├── DATA_MODELS_AND_SCHEMAS.md
│   ├── API_SPECIFICATION.md
│   ├── WEBSOCKET_PROTOCOL.md
│   ├── EXTENSION_ARCHITECTURE_AND_MESSAGING.md
│   ├── WORKFLOW_ENGINE_INTERNALS.md
│   ├── TOKENVAULT_SECURITY.md
│   └── PROJECT_FOLDER_STRUCTURE_GUIDE.md
│
├── guides/             # User and developer guides
│   ├── GETTING_STARTED.md
│   ├── CONTRIBUTING.md
│   ├── TESTING.md
│   └── DEPLOYMENT.md
│
└── examples/           # Example workflows and usage
    ├── workflows/      # Example YAML workflows
    └── templates/      # Example prompt templates
```

### scripts/

Contains build and utility scripts:

```
scripts/
├── build/              # Build scripts
│   ├── build-all.sh    # Build all packages and apps
│   ├── build-web.sh    # Build web app
│   └── build-extension.sh # Build extension
│
├── dev/                # Development scripts
│   ├── start-dev.sh    # Start development environment
│   └── watch.sh        # Watch for changes
│
└── deploy/             # Deployment scripts
    ├── deploy-web.sh   # Deploy web app
    └── deploy-api.sh   # Deploy API
```

### tools/

Contains development tools:

```
tools/
├── generators/         # Code generators
│   ├── adapter/        # Adapter generator
│   └── workflow/       # Workflow generator
│
└── cli-tools/          # CLI development tools
    └── workflow-validator/ # YAML workflow validator
```

## Monorepo Management

The project uses a monorepo approach with the following structure:

### Root package.json

```json
{
  "name": "hybrid-thinking",
  "version": "1.0.0",
  "private": true,
  "workspaces": [
    "apps/*",
    "services/*",
    "packages/*",
    "core/*"
  ],
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "clean": "turbo run clean"
  },
  "devDependencies": {
    "turbo": "^1.10.0"
  }
}
```

### Workspace Configuration

The project uses Turborepo for monorepo management:

```json
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", "build/**"]
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": []
    },
    "lint": {
      "outputs": []
    },
    "dev": {
      "cache": false
    },
    "clean": {
      "cache": false
    }
  }
}
```

## Module Dependencies

The following diagram illustrates the dependencies between major components:

```
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│    Web App    │     │      CLI      │     │  API Gateway  │
└───────┬───────┘     └───────┬───────┘     └───────┬───────┘
        │                     │                     │
        └─────────────┬───────┴─────────────┬───────┘
                      │                     │
              ┌───────▼───────┐     ┌───────▼───────┐
              │ Workflow Engine│     │ Common Types  │
              └───────┬───────┘     └───────────────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
┌───────▼───────┐ ┌───▼───┐ ┌───────▼───────┐
│Model Adapters  │ │ Utils │ │  TokenVault   │
└───────┬───────┘ └───────┘ └───────────────┘
        │
┌───────▼───────┐
│Extension Coord.│
└───────────────┘
```

## Import Conventions

To maintain a clean dependency structure, follow these import conventions:

1. **Absolute imports** for packages:
   ```typescript
   import { TokenData } from '@hybrid-thinking/common-types';
   ```

2. **Relative imports** for files within the same package:
   ```typescript
   import { encryptData } from '../utils/encryption';
   ```

3. **No circular dependencies** between packages.

## Environment-specific Configurations

Different environments (development, staging, production) use different configurations:

```
// Development
DATABASE_URL=sqlite:./dev.db
LOG_LEVEL=debug

// Staging
DATABASE_URL=postgres://user:password@staging-db:5432/hybrid
LOG_LEVEL=info

// Production
DATABASE_URL=postgres://user:password@production-db:5432/hybrid
LOG_LEVEL=warn
```

## Best Practices

1. **Package Isolation**: Each package should have a clear responsibility and minimal dependencies.

2. **Versioning**: Use semantic versioning for all packages.

3. **Documentation**: Each package should have its own README.md with usage examples.

4. **Testing**: Each package should have its own tests in a `__tests__` directory.

5. **Consistent Naming**: Use consistent naming conventions across the project:
   - Directories: kebab-case (e.g., `workflow-engine`)
   - Files: kebab-case for configuration files, PascalCase for React components, camelCase for other TypeScript files
   - Interfaces/Types: PascalCase (e.g., `TokenData`)
   - Functions/Variables: camelCase (e.g., `getValidToken`)

## Implementation Notes

[TODO: Define specific implementation details for folder structure]

1. **Shared Configuration**: Consider using a shared configuration package for ESLint, TypeScript, etc.

2. **Package Visibility**: Use the `"private": true` flag in package.json for packages that should not be published.

3. **Dependency Management**: Use a tool like `syncpack` to ensure consistent dependency versions across packages.
