# Project Folder Structure Guide

This document outlines the recommended folder structure for the Hybrid Thinking MVP project, providing a clear organization for the monorepo architecture.

### Updated Anatomy

As of the latest refactoring, the project structure has been updated with the following key changes:

```
hybrid-thinking/
├── apps/               # Frontend applications
│   ├── web-app/       # React web application
│   ├── browser-extension/ # Chrome extension
│   └── cli/           # Command-line interface
├── services/          # Backend services
│   └── api-gateway/   # Main API service
├── packages/          # Shared libraries and utilities
│   └── core-libs/     # Core libraries
│       ├── common-types/ # Shared TypeScript interfaces
│       ├── engine/    # Workflow engine and adapters (NEW)
│       └── utils/     # Shared utility functions
├── configs/           # Configuration files
├── docs/              # Documentation
├── scripts/           # Build and utility scripts
└── tools/             # Development tools
```

## Overview

The Hybrid Thinking project is organized as a monorepo with the following top-level directories:

```
hybrid-thinking/
├── apps/               # Frontend applications
├── services/           # Backend services
├── packages/           # Shared libraries and utilities
├── core/               # Core platform components (DEPRECATED - moved to packages/core-libs/engine)
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
    │   └── index.ts   # Main CLI client logic
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
└── websocket-server/   # WebSocket server (DEPRECATED - integrated into api-gateway)
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
│   ├── engine/         # Workflow engine and adapters (NEW)
│   │   ├── src/        # Source code
│   │   │   ├── adapters/# Model adapters
│   │   │   └── WorkflowEngine.ts # Core engine
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

### core/ (DEPRECATED)

Legacy core platform components (moved to packages/core-libs/engine):

```
core/
├── workflow-engine/    # Workflow execution engine (DEPRECATED - moved to packages/core-libs/engine)
│   ├── src/            # Source code
│   │   ├── execution/  # Execution logic
│   │   ├── parser/     # YAML parser
│   │   ├── templates/  # Template rendering
│   │   └── index.ts    # Entry point
│   ├── package.json    # Dependencies and scripts
│   └── README.md       # Component-specific documentation
│
├── adapters/           # Model adapters (DEPRECATED - moved to packages/core-libs/engine/src/adapters)
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

[Rest of the original content remains unchanged...]
