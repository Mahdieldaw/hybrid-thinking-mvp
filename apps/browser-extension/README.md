# Hybrid Thinking Browser Extension

A browser extension that enables interaction with multiple AI models through a unified interface. The extension supports ChatGPT, Claude, and Gemini, allowing seamless communication between these models and the Hybrid Thinking platform.

## Features

- **Multi-Model Support**: Integrates with ChatGPT, Claude, and Gemini through their web interfaces.
- **Real-time Communication**: WebSocket-based communication with the Hybrid Thinking backend.
- **Session Management**: Tracks active model sessions and their status.
- **Unified Interface**: Common prompt injection and response handling across different models.
- **Status Monitoring**: Real-time connection and session status display in the popup.

## Architecture

The extension follows Chrome's Manifest V3 architecture and consists of several key components:

```
apps/browser-extension/
├── public/
│   ├── icons/          # Extension icons (icon16.png, icon32.png, icon48.png, icon128.png, icon.svg)
│   ├── popup.html      # HTML for the extension popup
│   ├── popup.css       # CSS for the extension popup
│   └── popup.js        # JavaScript for the extension popup
├── background.js       # Background service worker (ExtensionCoordinator)
├── content.js          # Unified content script for model interaction
├── manifest.json       # Extension manifest
└── README.md           # This file
```

For more detailed architectural information, refer to the main project documentation, particularly `docs/architecture/Extension Architecture and Messaging.md`.

### Background Script (`background.js`)
- Manages the WebSocket connection with the Hybrid Thinking backend (API Gateway).
- Routes messages between content scripts, the popup, and the backend.
- Tracks active model sessions based on information from content scripts and tab events.
- Handles communication with the popup to display status and session information.

### Content Script (`content.js`)
- A single, unified script injected into supported model websites (ChatGPT, Claude, Gemini).
- Detects which model's page it is running on.
- Handles model-specific DOM interaction for:
    - Injecting prompts received from the background script.
    - Extracting responses from the model's UI.
    - Monitoring for response completion.
- Sends `SESSION_STATUS` (active/inactive) and `PROMPT_RESULT` messages to the background script.

### Popup Interface (`public/popup.html`, `public/popup.css`, `public/popup.js`)
- Displays the connection status to the backend WebSocket.
- Shows a list of currently active model sessions (e.g., "ChatGPT on Tab 123").
- Provides basic controls like "Refresh Sessions" and a placeholder "Login" button.

## Development Setup

1.  **Clone the Repository**: If you haven't already, clone the main Hybrid Thinking project.
2.  **Navigate to Extension Directory**:
    ```bash
    cd path/to/hybrid-thinking-mvp/apps/browser-extension
    ```
3.  **Install Dependencies**: This extension currently has no specific build process or npm dependencies beyond what's needed for the overall monorepo (if applicable). The scripts are plain JavaScript.

4.  **Load the Extension in Chrome/Edge**:
    *   Open your browser and go to `chrome://extensions/` (for Chrome) or `edge://extensions/` (for Edge).
    *   Enable "Developer mode" (usually a toggle in the top-right corner).
    *   Click "Load unpacked".
    *   Navigate to and select the `apps/browser-extension` directory within your cloned project.
    *   The extension icon should appear in your browser's toolbar.

## Configuration

### Model Host Mapping (`background.js`)
   The `background.js` script contains `PROVIDER_HOST_MAP` which maps abstract model IDs (e.g., `browser:chatgpt`) to the hostnames of the AI services. This is used for routing messages to the correct content script instances.
   ```javascript
   const PROVIDER_HOST_MAP = {
     'browser:chatgpt': 'chatgpt.com',
     'browser:claude': 'claude.ai',
     'browser:gemini': 'gemini.google.com',
   };
   ```

### WebSocket Connection (`background.js`)
   By default, the extension attempts to connect to the Hybrid Thinking API Gateway WebSocket at `ws://localhost:4000`. This URL is defined in `background.js`:
   ```javascript
   const WS_URL = 'ws://localhost:4000';
   ```
   Ensure your API Gateway is running and accessible at this address.

### Manifest Permissions (`manifest.json`)
   The `manifest.json` file declares necessary permissions, including `tabs`, `storage`, `scripting`, and `host_permissions` for the supported AI model websites and the local WebSocket server.

## Message Protocol (Simplified)

*   **Content Script → Background Script**:
    *   `SESSION_STATUS`: `{ type: 'SESSION_STATUS', modelId: 'browser:chatgpt', isActive: true }`
    *   `PROMPT_RESULT`: `{ type: 'PROMPT_RESULT', promptId: 'xyz', modelId: 'browser:claude', content: '...', error: null, timestamp: ... }`

*   **Background Script → Content Script** (via WebSocket from backend):
    *   `INJECT_PROMPT`: `{ type: 'INJECT_PROMPT', providerId: 'browser:gemini', promptId: 'abc', text: 'Translate this...' }` (providerId is the modelId)
    *   `HEALTH_CHECK`: `{ type: 'HEALTH_CHECK', providerId: 'browser:chatgpt' }`

*   **Popup ↔ Background Script**:
    *   Popup sends `GET_POPUP_DATA` to request current status.
    *   Background sends `POPUP_DATA_UPDATED` to notify popup of changes in connection or sessions.
    *   Popup sends `LOGIN_REQUESTED` (currently a placeholder).

## Development Guidelines

*   **Adding New Model Support**:
    1.  Update `PROVIDER_HOST_MAP` in `background.js`.
    2.  Add new model-specific selectors and handlers in `content.js` under `setupModelSpecificHandlers()` and `getModelSelector()`.
    3.  Update `host_permissions` and `content_scripts.matches` in `manifest.json`.
*   **Testing**:
    *   Ensure the API Gateway is running locally.
    *   Open tabs for each supported AI model (ChatGPT, Claude, Gemini) and log in if necessary.
    *   Test prompt injection by sending `job:run:prompt` events through a WebSocket client connected to the API Gateway.
    *   Verify that responses are correctly extracted and sent back.
    *   Check the popup for correct connection status and session display.
    *   Test WebSocket reconnection handling in `background.js`.
*   **Security**: Be mindful of the permissions requested and the security implications of interacting with third-party websites.

## Contributing

Contributions are welcome! Please follow the general contribution guidelines for the Hybrid Thinking project.

## License

This browser extension is part of the Hybrid Thinking project and is typically licensed under the project's main license (e.g., MIT or Apache 2.0). Refer to the root `LICENSE` file for details.

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
