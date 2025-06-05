# Testing Strategy and Onboarding Documentation

This document outlines the testing strategy for the Hybrid Thinking platform and provides onboarding documentation for new developers.

## Testing Strategy

### Overview

The Hybrid Thinking platform employs a comprehensive testing strategy that covers all components and integration points. The testing approach follows a pyramid structure:

1. **Unit Tests**: Testing individual functions and classes
2. **Integration Tests**: Testing interactions between components
3. **End-to-End Tests**: Testing complete user flows
4. **Performance Tests**: Testing system performance under load

### Test Coverage Goals

| Component | Unit Test Coverage | Integration Test Coverage |
|-----------|-------------------|--------------------------|
| Core Components | 90% | 80% |
| API Services | 85% | 75% |
| Web Application | 80% | 70% |
| Browser Extension | 80% | 70% |

### Testing Tools

#### Backend Testing

- **Jest**: Primary testing framework
- **Supertest**: HTTP assertions for API testing
- **SQLite in-memory**: Database testing
- **Sinon**: Mocking and stubbing
- **Istanbul**: Code coverage

```typescript
// Example API test
import request from 'supertest';
import { app } from '../src/app';
import { createTestToken } from './utils/auth';

describe('API: /run-hybrid', () => {
  it('should run a hybrid prompt', async () => {
    const token = createTestToken('user-123');
    
    const response = await request(app)
      .post('/run-hybrid')
      .set('Authorization', `Bearer ${token}`)
      .send({
        promptText: 'Test prompt',
        requestedModels: ['openai:gpt-4', 'anthropic:claude']
      });
    
    expect(response.status).toBe(202);
    expect(response.body).toHaveProperty('jobId');
  });
});
```

#### Frontend Testing

- **Jest**: Primary testing framework
- **React Testing Library**: Component testing
- **MSW (Mock Service Worker)**: API mocking
- **Cypress**: End-to-end testing

```typescript
// Example React component test
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { createTestStore } from '../utils/test-store';
import PromptEditor from '../src/components/PromptEditor';

describe('PromptEditor', () => {
  it('should submit prompt when button is clicked', () => {
    const store = createTestStore();
    const onSubmit = jest.fn();
    
    render(
      <Provider store={store}>
        <PromptEditor onSubmit={onSubmit} />
      </Provider>
    );
    
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Test prompt' } });
    
    const button = screen.getByText('Submit');
    fireEvent.click(button);
    
    expect(onSubmit).toHaveBeenCalledWith('Test prompt');
  });
});
```

#### Extension Testing

- **Jest**: Unit testing
- **Puppeteer**: Browser automation
- **Chrome Extension Testing Library**: Extension-specific testing utilities

```typescript
// Example extension test
import puppeteer from 'puppeteer';

describe('Extension Content Script', () => {
  let browser;
  let page;
  
  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: false,
      args: [
        '--disable-extensions-except=./dist',
        '--load-extension=./dist'
      ]
    });
    
    page = await browser.newPage();
  });
  
  afterAll(async () => {
    await browser.close();
  });
  
  test('should inject content script', async () => {
    await page.goto('https://chat.openai.com/');
    
    const injected = await page.evaluate(() => {
      return window.hasOwnProperty('__HYBRID_THINKING_INJECTED__');
    });
    
    expect(injected).toBe(true);
  });
});
```

### Continuous Integration

The project uses GitHub Actions for continuous integration:

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Lint
      run: npm run lint
    
    - name: Type check
      run: npm run type-check
    
    - name: Unit tests
      run: npm test
    
    - name: Build
      run: npm run build
    
    - name: Integration tests
      run: npm run test:integration
    
    - name: Upload coverage
      uses: codecov/codecov-action@v3
```

### Test Data Management

The project uses a combination of:

1. **Fixtures**: Static test data stored in JSON files
2. **Factories**: Dynamic test data generation
3. **Mocks**: Simulated external dependencies

```typescript
// Example test data factory
import { faker } from '@faker-js/faker';

export function createUser(overrides = {}) {
  return {
    id: faker.string.uuid(),
    name: faker.person.fullName(),
    email: faker.internet.email(),
    createdAt: faker.date.recent(),
    ...overrides
  };
}

export function createPromptLog(overrides = {}) {
  return {
    jobId: faker.string.uuid(),
    userId: faker.string.uuid(),
    promptText: faker.lorem.paragraph(),
    requestedModels: ['openai:gpt-4', 'anthropic:claude'],
    results: {},
    status: 'pending',
    createdAt: faker.date.recent(),
    updatedAt: faker.date.recent(),
    ...overrides
  };
}
```

### Performance Testing

Performance testing is conducted using:

- **k6**: Load testing tool
- **Prometheus**: Metrics collection
- **Grafana**: Visualization

```javascript
// Example k6 load test
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 20 },
    { duration: '1m', target: 20 },
    { duration: '30s', target: 0 }
  ]
};

export default function() {
  const url = 'https://api.hybridthinking.ai/v1/run-hybrid';
  const payload = JSON.stringify({
    promptText: 'Test prompt for performance testing',
    requestedModels: ['openai:gpt-3.5-turbo']
  });
  
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${__ENV.API_TOKEN}`
    }
  };
  
  const res = http.post(url, payload, params);
  
  check(res, {
    'status is 202': (r) => r.status === 202,
    'has jobId': (r) => r.json('jobId') !== undefined
  });
  
  sleep(1);
}
```

### Testing Best Practices

1. **Test Isolation**: Each test should be independent and not rely on the state from other tests
2. **Arrange-Act-Assert**: Structure tests with clear setup, action, and verification phases
3. **Mock External Dependencies**: Use mocks for external services to ensure tests are reliable
4. **Test Edge Cases**: Include tests for error conditions and boundary cases
5. **Readable Tests**: Write descriptive test names and clear assertions
6. **Fast Tests**: Optimize tests to run quickly to support rapid development

## Developer Onboarding

### Getting Started

#### Prerequisites

- Node.js 18 or higher
- npm or yarn
- Git
- Docker (optional, for containerized development)
- Chrome or Edge (for extension development)

#### Initial Setup

1. Clone the repository:

```bash
git clone https://github.com/your-org/hybrid-thinking.git
cd hybrid-thinking
```

2. Install dependencies:

```bash
npm install
```

3. Set up environment variables:

```bash
cp .env.example .env
# Edit .env with your local configuration
```

4. Start the development environment:

```bash
npm run dev
```

### Development Workflow

#### Monorepo Structure

The project uses a monorepo structure managed by Turborepo. To work with specific packages:

```bash
# Build a specific package
npm run build --filter=@hybrid-thinking/workflow-engine

# Run tests for a specific package
npm run test --filter=@hybrid-thinking/adapters

# Start development mode for a specific app
npm run dev --filter=web-app
```

#### Code Style and Linting

The project uses ESLint and Prettier for code style:

```bash
# Run linter
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format
```

#### Git Workflow

1. Create a feature branch:

```bash
git checkout -b feature/your-feature-name
```

2. Make changes and commit:

```bash
git add .
git commit -m "feat: add your feature"
```

3. Push changes:

```bash
git push origin feature/your-feature-name
```

4. Create a pull request on GitHub

#### Commit Message Convention

The project follows the Conventional Commits specification:

- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code changes that neither fix bugs nor add features
- `perf`: Performance improvements
- `test`: Adding or fixing tests
- `chore`: Changes to the build process or tools

Example: `feat(workflow-engine): add support for conditional branching`

### Architecture Overview

For a comprehensive understanding of the architecture, refer to the [Architecture Overview](../architecture/ARCHITECTURE_OVERVIEW.md) document.

### Key Components

#### Core Components

- **WorkflowEngine**: Orchestrates execution across multiple models
- **Adapters**: Connect to various AI models
- **TokenVault**: Securely manages credentials
- **ExtensionCoordinator**: Communicates with the browser extension

#### Services

- **API Gateway**: Main REST API
- **WebSocket Server**: Real-time communication

#### Applications

- **Web App**: React-based user interface
- **Browser Extension**: Chrome extension for web-based models
- **CLI**: Command-line interface

### Common Development Tasks

#### Adding a New Model Adapter

1. Create a new adapter class in `core/adapters/src/[type]/`
2. Implement the `ModelAdapter` interface
3. Register the adapter in `core/adapters/src/index.ts`
4. Add model metadata to `configs/models.json`

For detailed instructions, see the [Adapter Development Guide](../../core/adapters/ADAPTER_DEVELOPMENT_GUIDE.md).

#### Creating a New API Endpoint

1. Create a new controller in `services/api-gateway/src/controllers/`
2. Create route definitions in `services/api-gateway/src/routes/`
3. Add service logic in `services/api-gateway/src/services/`
4. Update API documentation in `docs/architecture/API_SPECIFICATION.md`

#### Adding a New React Component

1. Create the component in `apps/web-app/src/components/`
2. Create a test file in `apps/web-app/src/components/__tests__/`
3. Export the component from the appropriate index file
4. Use the component in your pages or other components

### Debugging

#### Backend Debugging

Use the built-in Node.js debugger:

```bash
# Start API with debugging enabled
NODE_OPTIONS='--inspect' npm run dev --filter=api-gateway
```

Then connect using Chrome DevTools or VS Code.

#### Frontend Debugging

Use React DevTools and Redux DevTools browser extensions.

#### Extension Debugging

1. Load the extension in developer mode
2. Use Chrome's extension debugging tools
3. Check the background script console and content script console

### Documentation

For comprehensive documentation, refer to the following resources:

- [Architecture Documentation](../architecture/)
- [API Specification](../architecture/API_SPECIFICATION.md)
- [WebSocket Protocol](../architecture/WEBSOCKET_PROTOCOL.md)
- [Extension Architecture](../architecture/EXTENSION_ARCHITECTURE_AND_MESSAGING.md)
- [Workflow Engine Internals](../architecture/WORKFLOW_ENGINE_INTERNALS.md)
- [TokenVault & Security](../architecture/TOKENVAULT_SECURITY.md)
- [Project Folder Structure](../architecture/PROJECT_FOLDER_STRUCTURE_GUIDE.md)
- [Content & Background Script Guide](../guides/CONTENT_BACKGROUND_SCRIPT_GUIDE.md)
- [Adapter Development Guide](../../core/adapters/ADAPTER_DEVELOPMENT_GUIDE.md)

### Troubleshooting

#### Common Issues

1. **WebSocket Connection Failures**
   - Check if the WebSocket server is running
   - Verify that the WebSocket URL is correct
   - Check for CORS issues

2. **Model Adapter Errors**
   - Verify that tokens are correctly stored in TokenVault
   - Check if the model provider is available
   - Look for rate limiting issues

3. **Extension Communication Issues**
   - Ensure the extension is loaded and active
   - Check if content scripts are injected correctly
   - Verify WebSocket connection between extension and backend

#### Getting Help

- Check the project wiki for known issues
- Search existing GitHub issues
- Ask in the developer Slack channel
- Create a new GitHub issue with detailed information

## Future Enhancements

[TODO: Define specific enhancements for testing and onboarding]

1. **Automated E2E Testing**: Expand Cypress test coverage for critical user flows
2. **Visual Regression Testing**: Add visual testing for UI components
3. **Interactive Onboarding**: Create an interactive onboarding experience for new developers
4. **Performance Testing Dashboard**: Implement a dashboard for tracking performance metrics over time
