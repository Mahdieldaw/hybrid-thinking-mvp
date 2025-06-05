# Hybrid Thinking MVP

## Description

Hybrid Thinking is an intelligence orchestration platform that turns any web-accessible AI into a programmable model, then runs Generate→Synthesize workflows. The system transforms diverse AI perspectives into coherent, actionable outputs through structured workflows that leverage model diversity for superior results.

## Table of Contents

### Architecture Documentation
- [Architecture Overview](docs/architecture/ARCHITECTURE_OVERVIEW.md)
- [Data Models and Schemas](docs/architecture/DATA_MODELS_AND_SCHEMAS.md)
- [API Specification](docs/architecture/API_SPECIFICATION.md)
- [WebSocket Protocol](docs/architecture/WEBSOCKET_PROTOCOL.md)
- [Extension Architecture and Messaging](docs/architecture/EXTENSION_ARCHITECTURE_AND_MESSAGING.md)
- [Workflow Engine Internals](docs/architecture/WORKFLOW_ENGINE_INTERNALS.md)
- [TokenVault Security](docs/architecture/TOKENVAULT_SECURITY.md)
- [Project Folder Structure Guide](docs/architecture/PROJECT_FOLDER_STRUCTURE_GUIDE.md)

### Component Documentation
- [API Gateway](services/api-gateway/README.md)
- [Browser Extension](apps/browser-extension/README.md)
- [Web App](apps/web-app/README.md)
- [Adapter Development Guide](core/adapters/ADAPTER_DEVELOPMENT_GUIDE.md)

## High-Level Component Overview

Hybrid Thinking is organized as a monorepo with the following structure:
- `packages/`: Shared libraries and utilities
- `services/`: Backend services
- `apps/`: Frontend applications
- `configs/`: Configuration files
- `docs/`: Documentation

The system consists of five core components:

1. **UniversalModelRegistry**: Abstracts any AI model into a common interface through API, Browser, and Local adapters.

2. **TokenVault**: Securely stores and manages credentials for various model providers.

3. **ExtensionCoordinator**: Enables browser-based model access through a Chrome extension.

4. **WorkflowEngine**: Orchestrates intelligence workflows with staged execution.

5. **ExecutionContext & TransportLayer**: Maintains state and provides I/O across multiple interfaces.

## Getting Started

### Prerequisites
- Node.js 18 or higher
- npm or yarn
- Google Chrome (for extension development)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/hybrid-thinking.git

# Install dependencies
cd hybrid-thinking
npm install
```

### Running the Components

#### Backend
```bash
cd services/api-gateway
npm run dev
```

#### CLI
```bash
cd apps/cli
npm run build
./bin/hybrid-cli run --workflow content_research.yaml
```

#### Browser Extension
```bash
cd apps/browser-extension
npm run build
# Load the extension from dist/ folder in Chrome's extension page
```

#### Web App
```bash
cd apps/web-app
npm run dev
```

## Contribution Guidelines

See [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
