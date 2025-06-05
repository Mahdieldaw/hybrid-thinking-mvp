# Extension Architecture and Messaging

This document details the architecture and messaging protocol for the Hybrid Thinking browser extension, which enables any web-based AI to be used as a programmable model within the platform.

## Overview

The browser extension is a critical component of the Hybrid Thinking platform, allowing users to leverage web-based AI models that don't have public APIs. It uses Chrome's Manifest V3 architecture to inject content scripts into specific AI websites, manipulate the DOM to submit prompts, and extract responses.

## Extension Components

### 1. Manifest

The extension uses Chrome's Manifest V3 format:

```json
{
  "manifest_version": 3,
  "name": "Hybrid Thinking",
  "version": "1.0.0",
  "description": "Intelligence orchestration platform for multiple AI models",
  "permissions": [
    "tabs",
    "storage",
    "webNavigation",
    "scripting"
  ],
  "host_permissions": [
    "https://chat.openai.com/*",
    "https://claude.ai/*",
    "https://perplexity.ai/*",
    "https://bard.google.com/*",
    "https://api.hybridthinking.ai/*"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": ["https://chat.openai.com/*"],
      "js": ["content-scripts/chatgpt.js"]
    },
    {
      "matches": ["https://claude.ai/*"],
      "js": ["content-scripts/claude.js"]
    },
    {
      "matches": ["https://perplexity.ai/*"],
      "js": ["content-scripts/perplexity.js"]
    },
    {
      "matches": ["https://bard.google.com/*"],
      "js": ["content-scripts/bard.js"]
    }
  ],
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  }
}
```

### 2. Background Script

The background script (`background.js`) serves as the central coordinator for the extension, managing:

- WebSocket connection to the Hybrid Thinking backend
- Tab management for different model sessions
- Message routing between content scripts and backend
- Session health monitoring

```typescript
// Background script structure
import { SocketMessageBase } from '../common-types';

// Map of modelId to tabId
const modelTabMap: Record<string, number> = {};

// WebSocket connection to backend
let socket: WebSocket | null = null;

// Connect to backend WebSocket
function connectWebSocket(token: string) {
  socket = new WebSocket(`wss://api.hybridthinking.ai/v1/ws?token=${token}`);
  
  socket.onopen = () => {
    console.log('Connected to Hybrid Thinking backend');
  };
  
  socket.onmessage = (event) => {
    const message: SocketMessageBase = JSON.parse(event.data);
    handleBackendMessage(message);
  };
  
  socket.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
  
  socket.onclose = () => {
    console.log('WebSocket connection closed');
    // Implement reconnection logic with exponential backoff
    setTimeout(() => connectWebSocket(token), 1000);
  };
}

// Handle messages from backend
function handleBackendMessage(message: SocketMessageBase) {
  if (message.type === 'extension:run:prompt') {
    const { promptId, model, text } = message.payload;
    const tabId = modelTabMap[model];
    
    if (!tabId) {
      sendToBackend({
        type: 'extension:prompt:error',
        payload: {
          promptId,
          error: 'No active tab for this model'
        },
        timestamp: new Date().toISOString()
      });
      return;
    }
    
    // Forward prompt to content script in correct tab
    chrome.tabs.sendMessage(tabId, {
      type: 'RUN_PROMPT',
      promptId,
      text
    });
  }
}

// Send message to backend
function sendToBackend(message: SocketMessageBase) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type === 'REGISTER_MODEL_TAB') {
    const { modelId } = message;
    const tabId = sender.tab?.id;
    
    if (tabId) {
      modelTabMap[modelId] = tabId;
      console.log(`Registered tab ${tabId} for model ${modelId}`);
    }
  }
  
  if (message.type === 'PROMPT_RESULT') {
    const { promptId, text } = message;
    
    sendToBackend({
      type: 'extension:prompt:result',
      payload: {
        promptId,
        text
      },
      timestamp: new Date().toISOString()
    });
  }
  
  if (message.type === 'SESSION_INVALID') {
    const { modelId } = message;
    const tabId = sender.tab?.id;
    
    sendToBackend({
      type: 'extension:session:invalid',
      payload: {
        userId: 'current-user', // Will be replaced with actual userId
        providerId: modelId,
        tabId
      },
      timestamp: new Date().toISOString()
    });
    
    // Remove from modelTabMap
    if (modelId in modelTabMap) {
      delete modelTabMap[modelId];
    }
  }
});

// Check session health periodically
function checkSessionHealth() {
  Object.entries(modelTabMap).forEach(([modelId, tabId]) => {
    chrome.tabs.sendMessage(tabId, { type: 'CHECK_SESSION' }, (response) => {
      if (chrome.runtime.lastError || !response || !response.valid) {
        sendToBackend({
          type: 'extension:session:invalid',
          payload: {
            userId: 'current-user', // Will be replaced with actual userId
            providerId: modelId,
            tabId
          },
          timestamp: new Date().toISOString()
        });
        
        delete modelTabMap[modelId];
      }
    });
  });
}

// Initialize extension
function initialize() {
  // Get token from storage
  chrome.storage.local.get(['token'], (result) => {
    if (result.token) {
      connectWebSocket(result.token);
    }
  });
  
  // Set up periodic health checks
  setInterval(checkSessionHealth, 30000);
}

initialize();
```

### 3. Content Scripts

Content scripts are model-specific and handle the interaction with each AI website's DOM. Each script follows a similar pattern but with site-specific selectors and interaction logic.

Example for ChatGPT (`content-scripts/chatgpt.js`):

```typescript
// ChatGPT content script
const MODEL_ID = 'browser:chatgpt';
let promptIdInProgress: string | null = null;

// Register this tab with the background script
chrome.runtime.sendMessage({
  type: 'REGISTER_MODEL_TAB',
  modelId: MODEL_ID
});

// Find input textarea
function getInputElement() {
  return document.querySelector('textarea[data-id="root"]');
}

// Find submit button
function getSubmitButton() {
  return document.querySelector('button[data-testid="send-button"]');
}

// Check if we're on the chat interface
function isOnChatInterface() {
  return !!getInputElement() && !!getSubmitButton();
}

// Check if response is complete (no loading indicator)
function isResponseComplete() {
  return !document.querySelector('.result-streaming');
}

// Extract response text
function extractResponseText() {
  // Get the latest response element
  const responseElements = document.querySelectorAll('.markdown');
  if (responseElements.length === 0) return null;
  
  // Get the last response
  const lastResponse = responseElements[responseElements.length - 1];
  return lastResponse.textContent;
}

// Set up mutation observer to detect when response is complete
const observer = new MutationObserver((mutations) => {
  if (promptIdInProgress && isResponseComplete()) {
    const responseText = extractResponseText();
    
    if (responseText) {
      chrome.runtime.sendMessage({
        type: 'PROMPT_RESULT',
        promptId: promptIdInProgress,
        text: responseText
      });
      
      promptIdInProgress = null;
    }
  }
});

// Start observing
observer.observe(document.body, {
  childList: true,
  subtree: true
});

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'RUN_PROMPT') {
    const { promptId, text } = message;
    
    if (!isOnChatInterface()) {
      chrome.runtime.sendMessage({
        type: 'SESSION_INVALID',
        modelId: MODEL_ID
      });
      return;
    }
    
    // Set the prompt text in the input field
    const inputElement = getInputElement() as HTMLTextAreaElement;
    if (!inputElement) return;
    
    // Store the promptId for later
    promptIdInProgress = promptId;
    
    // Set value and dispatch input event
    inputElement.value = text;
    inputElement.dispatchEvent(new Event('input', { bubbles: true }));
    
    // Click the submit button
    const submitButton = getSubmitButton() as HTMLButtonElement;
    if (submitButton) {
      submitButton.click();
    }
  }
  
  if (message.type === 'CHECK_SESSION') {
    sendResponse({ valid: isOnChatInterface() });
  }
});

// Check if we're logged in
if (!isOnChatInterface()) {
  chrome.runtime.sendMessage({
    type: 'SESSION_INVALID',
    modelId: MODEL_ID
  });
}
```

Similar content scripts would be created for other AI platforms (Claude, Perplexity, Bard, etc.), each with site-specific DOM selectors and interaction patterns.

### 4. Popup UI

The popup UI (`popup.html` and `popup.js`) provides a user interface for:

- Viewing connection status
- Managing model sessions
- Authenticating with the Hybrid Thinking backend
- Configuring extension settings

```html
<!-- popup.html -->
<!DOCTYPE html>
<html>
<head>
  <title>Hybrid Thinking</title>
  <style>
    body {
      width: 320px;
      padding: 16px;
      font-family: system-ui, sans-serif;
    }
    .status {
      display: flex;
      align-items: center;
      margin-bottom: 16px;
    }
    .status-indicator {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      margin-right: 8px;
    }
    .connected { background-color: #4CAF50; }
    .disconnected { background-color: #F44336; }
    .model-session {
      padding: 8px;
      margin-bottom: 8px;
      border: 1px solid #ccc;
      border-radius: 4px;
    }
    .model-session.invalid {
      border-color: #F44336;
      background-color: rgba(244, 67, 54, 0.1);
    }
    button {
      padding: 8px 16px;
      background-color: #2196F3;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <h2>Hybrid Thinking</h2>
  
  <div class="status">
    <div id="status-indicator" class="status-indicator disconnected"></div>
    <span id="status-text">Disconnected</span>
  </div>
  
  <h3>Model Sessions</h3>
  <div id="model-sessions"></div>
  
  <button id="login-button">Login</button>
  <button id="refresh-button">Refresh Sessions</button>
  
  <script src="popup.js"></script>
</body>
</html>
```

```typescript
// popup.js
document.addEventListener('DOMContentLoaded', () => {
  const statusIndicator = document.getElementById('status-indicator');
  const statusText = document.getElementById('status-text');
  const modelSessionsContainer = document.getElementById('model-sessions');
  const loginButton = document.getElementById('login-button');
  const refreshButton = document.getElementById('refresh-button');
  
  // Check connection status
  chrome.runtime.sendMessage({ type: 'GET_CONNECTION_STATUS' }, (response) => {
    if (response && response.connected) {
      statusIndicator.classList.remove('disconnected');
      statusIndicator.classList.add('connected');
      statusText.textContent = 'Connected';
    }
  });
  
  // Get model sessions
  function updateModelSessions() {
    chrome.runtime.sendMessage({ type: 'GET_MODEL_SESSIONS' }, (response) => {
      if (response && response.sessions) {
        modelSessionsContainer.innerHTML = '';
        
        Object.entries(response.sessions).forEach(([modelId, status]) => {
          const sessionElement = document.createElement('div');
          sessionElement.className = `model-session ${status.valid ? '' : 'invalid'}`;
          
          sessionElement.innerHTML = `
            <div><strong>${modelId}</strong></div>
            <div>Status: ${status.valid ? 'Active' : 'Invalid'}</div>
            <div>Tab ID: ${status.tabId}</div>
          `;
          
          modelSessionsContainer.appendChild(sessionElement);
        });
      }
    });
  }
  
  updateModelSessions();
  
  // Login button
  loginButton.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'OPEN_LOGIN_PAGE' });
  });
  
  // Refresh button
  refreshButton.addEventListener('click', () => {
    updateModelSessions();
  });
});
```

## Messaging Protocol

### 1. Background Script ↔ Content Script Messages

#### Background → Content Script

| Message Type | Payload | Description |
|-------------|---------|-------------|
| `RUN_PROMPT` | `{ promptId: string, text: string }` | Execute a prompt in the AI interface |
| `CHECK_SESSION` | None | Check if the session is still valid |

#### Content Script → Background

| Message Type | Payload | Description |
|-------------|---------|-------------|
| `REGISTER_MODEL_TAB` | `{ modelId: string }` | Register a tab as hosting a specific model |
| `PROMPT_RESULT` | `{ promptId: string, text: string }` | Return the result of a prompt |
| `SESSION_INVALID` | `{ modelId: string }` | Notify that the session is no longer valid |

### 2. Background Script ↔ Backend WebSocket Messages

#### Background → Backend

| Message Type | Payload | Description |
|-------------|---------|-------------|
| `extension:prompt:result` | `{ promptId: string, text: string }` | Return the result of a prompt |
| `extension:session:invalid` | `{ userId: string, providerId: string, tabId: number }` | Notify that a session is invalid |
| `extension:prompt:error` | `{ promptId: string, error: string }` | Report an error executing a prompt |

#### Backend → Background

| Message Type | Payload | Description |
|-------------|---------|-------------|
| `extension:run:prompt` | `{ promptId: string, model: string, text: string }` | Request to run a prompt |

### 3. Popup ↔ Background Script Messages

#### Popup → Background

| Message Type | Payload | Description |
|-------------|---------|-------------|
| `GET_CONNECTION_STATUS` | None | Request connection status |
| `GET_MODEL_SESSIONS` | None | Request active model sessions |
| `OPEN_LOGIN_PAGE` | None | Open the login page |

#### Background → Popup

| Message Type | Payload | Description |
|-------------|---------|-------------|
| `CONNECTION_STATUS` | `{ connected: boolean }` | Current connection status |
| `MODEL_SESSIONS` | `{ sessions: Record<string, { valid: boolean, tabId: number }> }` | Active model sessions |

## Session Management

### Session Establishment

1. User logs into an AI platform (e.g., ChatGPT) in a browser tab
2. The content script detects the login state and registers with the background script
3. The background script maps the model ID to the tab ID
4. The background script notifies the backend that the model is available

### Session Health Monitoring

1. The background script periodically sends `CHECK_SESSION` messages to content scripts
2. Content scripts verify they are still on the chat interface and respond with validity
3. If a session is invalid, the background script notifies the backend
4. The backend can request the user to re-authenticate

### Session Recovery

1. When a session becomes invalid, the backend is notified
2. The user is prompted to re-authenticate with the AI platform
3. Once re-authenticated, the content script registers the new session
4. The background script updates its model-to-tab mapping

## Security Considerations

### Token Storage

- JWT tokens are stored in `chrome.storage.local` for authentication with the backend
- No AI platform credentials are stored by the extension

### Content Script Isolation

- Content scripts operate in an isolated world, preventing interference with page scripts
- Communication between content scripts and the background script is done via the Chrome messaging API

### Permission Model

- The extension requires minimal permissions:
  - `tabs`: To manage and communicate with tabs
  - `storage`: To store authentication tokens
  - `webNavigation`: To detect page navigation events
  - `scripting`: To inject scripts into specific pages
- Host permissions are limited to specific AI platforms and the Hybrid Thinking backend

## Implementation Considerations

### Cross-Browser Compatibility

While the initial implementation targets Chrome and Edge (both Chromium-based), future versions should consider:

- Firefox compatibility (using the WebExtensions API)
- Safari compatibility (using the Safari Extensions API)

[TODO: Define browser-specific adaptations needed]

### Error Handling

The extension implements robust error handling:

- DOM element not found: Retry with exponential backoff
- Session invalidation: Notify backend and request user re-authentication
- WebSocket disconnection: Reconnect with exponential backoff
- Prompt execution timeout: Cancel after configurable timeout period

[TODO: Define specific error recovery strategies for each AI platform]

### Performance Optimization

To ensure optimal performance:

- Use MutationObserver efficiently by observing only necessary DOM subtrees
- Implement debouncing for frequent events
- Minimize DOM operations in content scripts
- Use efficient selectors for DOM element lookup

[TODO: Define performance benchmarks and optimization targets]
