# Browser Extension

## Overview

The Hybrid Thinking browser extension enables any web-based AI to be used as a programmable model within the platform. It serves as a critical component of the Universal Model Access layer, allowing the platform to interact with AI models that don't have public APIs.

## Features

- Automatic detection and registration of web-based AI models
- DOM manipulation for prompt injection and response extraction
- WebSocket communication with the Hybrid Thinking backend
- Session health monitoring and auto-recovery
- Multi-tab session management
- User-friendly popup interface for status monitoring

## Architecture

The extension follows Chrome's Manifest V3 architecture with the following components:

```
browser-extension/
├── src/
│   ├── background/     # Background service worker
│   ├── content/        # Site-specific content scripts
│   ├── popup/          # Extension popup UI
│   └── utils/          # Shared utilities
├── manifest.json       # Extension manifest
└── package.json        # Dependencies and scripts
```

For detailed architecture information, see the [Extension Architecture and Messaging](../docs/architecture/EXTENSION_ARCHITECTURE_AND_MESSAGING.md) document.

## Content Scripts

The extension includes site-specific content scripts for various AI platforms:

- `chatgpt.js`: For OpenAI's ChatGPT
- `claude.js`: For Anthropic's Claude
- `perplexity.js`: For Perplexity
- `bard.js`: For Google's Bard/Gemini

Each content script is responsible for:
- Locating input elements
- Injecting prompts
- Monitoring for responses
- Extracting completed responses
- Detecting session validity

## Background Script

The background script (`background.js`) serves as the central coordinator, managing:

- WebSocket connection to the Hybrid Thinking backend
- Tab management for different model sessions
- Message routing between content scripts and backend
- Session health monitoring

## Popup UI

The popup UI provides a user-friendly interface for:

- Viewing connection status
- Managing model sessions
- Authenticating with the Hybrid Thinking backend
- Configuring extension settings

## Getting Started

### Prerequisites

- Google Chrome or Microsoft Edge (Chromium-based)
- Node.js 18 or higher
- npm or yarn

### Installation for Development

```bash
# Clone the repository
git clone https://github.com/your-org/hybrid-thinking.git

# Navigate to the browser extension directory
cd hybrid-thinking/apps/browser-extension

# Install dependencies
npm install

# Build the extension
npm run build
```

### Loading the Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top-right corner
3. Click "Load unpacked" and select the `dist` directory from the build output
4. The extension should now be installed and visible in your browser toolbar

## Configuration

The extension can be configured through the popup UI or by editing the configuration file:

```json
{
  "backendUrl": "wss://api.hybridthinking.ai/v1/ws",
  "modelSettings": {
    "browser:chatgpt": {
      "url": "https://chat.openai.com/",
      "checkInterval": 30000
    },
    "browser:claude": {
      "url": "https://claude.ai/",
      "checkInterval": 30000
    },
    "browser:perplexity": {
      "url": "https://perplexity.ai/",
      "checkInterval": 30000
    }
  },
  "sessionCheckInterval": 30000,
  "reconnectInterval": 5000,
  "maxReconnectAttempts": 10
}
```

## Authentication

The extension requires authentication with the Hybrid Thinking backend:

1. Click the extension icon to open the popup
2. Click "Login" to open the authentication page
3. Complete the authentication process
4. The extension will receive and store a JWT token for API access

## Usage

### Setting Up Model Sessions

1. Log in to each AI platform (ChatGPT, Claude, etc.) in separate tabs
2. The extension will automatically detect and register these sessions
3. The popup UI will show the status of each registered model

### Running Prompts

The extension works in the background, responding to prompt requests from the Hybrid Thinking backend:

1. The backend sends a prompt request via WebSocket
2. The background script routes the request to the appropriate content script
3. The content script injects the prompt into the AI interface
4. The content script monitors for and extracts the response
5. The response is sent back to the backend via WebSocket

## Development

### Project Structure

```
src/
├── background/
│   └── index.ts         # Background script entry point
├── content/
│   ├── chatgpt.ts       # ChatGPT-specific content script
│   ├── claude.ts        # Claude-specific content script
│   ├── perplexity.ts    # Perplexity-specific content script
│   └── common.ts        # Shared content script utilities
├── popup/
│   ├── index.html       # Popup HTML
│   ├── index.ts         # Popup script entry point
│   └── styles.css       # Popup styles
└── utils/
    ├── messaging.ts     # Message handling utilities
    ├── storage.ts       # Storage utilities
    └── dom.ts           # DOM manipulation utilities
```

### Build System

The extension uses webpack for building:

```bash
# Development build with watch mode
npm run dev

# Production build
npm run build
```

### Adding Support for New AI Platforms

To add support for a new AI platform:

1. Create a new content script in the `src/content/` directory
2. Implement the required functions:
   - `getInputElement()`: Find the input element
   - `getSubmitButton()`: Find the submit button
   - `isOnChatInterface()`: Check if we're on the chat interface
   - `isResponseComplete()`: Check if the response is complete
   - `extractResponseText()`: Extract the response text
3. Add the content script to `manifest.json`
4. Add the model to the configuration

Example:

```typescript
// src/content/new-model.ts
import { setupCommonHandlers } from './common';

const MODEL_ID = 'browser:new-model';

// Find input textarea
function getInputElement() {
  return document.querySelector('textarea.input-area');
}

// Find submit button
function getSubmitButton() {
  return document.querySelector('button.submit-button');
}

// Check if we're on the chat interface
function isOnChatInterface() {
  return !!getInputElement() && !!getSubmitButton();
}

// Check if response is complete (no loading indicator)
function isResponseComplete() {
  return !document.querySelector('.loading-indicator');
}

// Extract response text
function extractResponseText() {
  const responseElement = document.querySelector('.response-text');
  return responseElement ? responseElement.textContent : null;
}

// Set up handlers
setupCommonHandlers({
  modelId: MODEL_ID,
  getInputElement,
  getSubmitButton,
  isOnChatInterface,
  isResponseComplete,
  extractResponseText
});
```

## Testing

The extension includes comprehensive tests:

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
│   ├── background/
│   ├── content/
│   └── utils/
└── e2e/
    └── puppeteer/      # End-to-end tests using Puppeteer
```

## Troubleshooting

### Common Issues

1. **Session Invalid Errors**
   - Ensure you're logged into the AI platform
   - Try refreshing the page
   - Check if your session has expired

2. **Connection Issues**
   - Verify the backend URL in the configuration
   - Check your internet connection
   - Ensure the backend server is running

3. **Prompt Injection Failures**
   - The AI platform's DOM structure may have changed
   - Check the browser console for errors
   - Update the content script selectors

## Security Considerations

The extension follows security best practices:

- No storage of AI platform credentials
- JWT tokens stored in `chrome.storage.local` (encrypted by Chrome)
- Content script isolation to prevent interference with page scripts
- Minimal permissions requested in the manifest

## Future Enhancements

[TODO: Define specific enhancements for the browser extension]

1. **Firefox Support**: Adapt the extension for Firefox using the WebExtensions API
2. **Safari Support**: Create a Safari extension version
3. **Enhanced Error Recovery**: Improve automatic recovery from various error states
4. **Visual Debugging Tools**: Add tools for troubleshooting content script issues
