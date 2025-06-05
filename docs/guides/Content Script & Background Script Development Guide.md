# Content Script & Background Script Development Guide

This document provides detailed guidance for developing content scripts and background scripts for the Hybrid Thinking browser extension, which enables web-based AI models to be used within the platform.

## Overview

The browser extension consists of two main script types:

1. **Content Scripts**: Model-specific scripts that run in the context of AI websites to interact with their interfaces
2. **Background Script**: A central coordinator that manages communication between content scripts and the backend

## Content Script Development

Content scripts are responsible for interacting with specific AI websites by manipulating the DOM to submit prompts and extract responses.

### Basic Structure

Each content script follows this general structure:

```typescript
// Example: content-scripts/chatgpt.js

// Model identifier
const MODEL_ID = 'browser:chatgpt';

// Track current prompt
let promptIdInProgress: string | null = null;

// Register with background script
chrome.runtime.sendMessage({
  type: 'REGISTER_MODEL_TAB',
  modelId: MODEL_ID
});

// Core functions
function getInputElement() { /* ... */ }
function getSubmitButton() { /* ... */ }
function isOnChatInterface() { /* ... */ }
function isResponseComplete() { /* ... */ }
function extractResponseText() { /* ... */ }

// Set up observer for response monitoring
const observer = new MutationObserver((mutations) => {
  /* ... */
});

// Start observing
observer.observe(document.body, {
  childList: true,
  subtree: true
});

// Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  /* ... */
});

// Initial check
if (!isOnChatInterface()) {
  chrome.runtime.sendMessage({
    type: 'SESSION_INVALID',
    modelId: MODEL_ID
  });
}
```

### Core Functions

Each content script must implement these core functions:

#### 1. getInputElement

Locates the input element where prompts should be entered:

```typescript
function getInputElement() {
  // ChatGPT example
  return document.querySelector('textarea[data-id="root"]');
  
  // Claude example
  // return document.querySelector('.claude-textarea');
  
  // Perplexity example
  // return document.querySelector('.search-input');
}
```

#### 2. getSubmitButton

Locates the submit button to send prompts:

```typescript
function getSubmitButton() {
  // ChatGPT example
  return document.querySelector('button[data-testid="send-button"]');
  
  // Claude example
  // return document.querySelector('.send-button');
  
  // Perplexity example
  // return document.querySelector('.search-button');
}
```

#### 3. isOnChatInterface

Checks if the current page is the chat interface:

```typescript
function isOnChatInterface() {
  return !!getInputElement() && !!getSubmitButton();
}
```

#### 4. isResponseComplete

Determines if the model has finished generating a response:

```typescript
function isResponseComplete() {
  // ChatGPT example
  return !document.querySelector('.result-streaming');
  
  // Claude example
  // return !document.querySelector('.typing-indicator');
  
  // Perplexity example
  // return !document.querySelector('.loading-indicator');
}
```

#### 5. extractResponseText

Extracts the completed response text:

```typescript
function extractResponseText() {
  // ChatGPT example
  const responseElements = document.querySelectorAll('.markdown');
  if (responseElements.length === 0) return null;
  
  // Get the last response
  const lastResponse = responseElements[responseElements.length - 1];
  return lastResponse.textContent;
  
  // Claude example
  /*
  const responseElement = document.querySelector('.claude-response');
  return responseElement ? responseElement.textContent : null;
  */
  
  // Perplexity example
  /*
  const responseElement = document.querySelector('.answer-container');
  return responseElement ? responseElement.textContent : null;
  */
}
```

### Response Monitoring

Use MutationObserver to detect when responses are complete:

```typescript
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
```

### Message Handling

Handle messages from the background script:

```typescript
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
```

### Common Challenges and Solutions

#### 1. Dynamic UI Changes

Many AI interfaces use dynamic frameworks that can change DOM structure:

```typescript
// More robust selector approach
function getInputElement() {
  // Try multiple selectors
  const selectors = [
    'textarea[data-id="root"]',
    '.chat-input textarea',
    '[role="textbox"]'
  ];
  
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) return element;
  }
  
  return null;
}
```

#### 2. Shadow DOM

Some interfaces use Shadow DOM to encapsulate components:

```typescript
function getElementInShadowDOM(selector: string, root: Document | Element = document): Element | null {
  // Check regular DOM first
  const element = root.querySelector(selector);
  if (element) return element;
  
  // Check shadow roots
  const shadowRoots = Array.from(root.querySelectorAll('*'))
    .filter(el => el.shadowRoot)
    .map(el => el.shadowRoot);
  
  for (const shadowRoot of shadowRoots) {
    const element = getElementInShadowDOM(selector, shadowRoot);
    if (element) return element;
  }
  
  return null;
}
```

#### 3. Rate Limiting

Handle rate limiting by implementing delays:

```typescript
async function submitPromptWithRateLimiting(text: string): Promise<void> {
  const inputElement = getInputElement() as HTMLTextAreaElement;
  if (!inputElement) return;
  
  // Check for rate limiting indicators
  const rateLimited = document.querySelector('.rate-limit-warning');
  if (rateLimited) {
    // Wait before trying again
    await new Promise(resolve => setTimeout(resolve, 5000));
    return submitPromptWithRateLimiting(text);
  }
  
  // Proceed with submission
  inputElement.value = text;
  inputElement.dispatchEvent(new Event('input', { bubbles: true }));
  
  const submitButton = getSubmitButton() as HTMLButtonElement;
  if (submitButton) {
    submitButton.click();
  }
}
```

#### 4. Authentication Detection

Detect when authentication is required:

```typescript
function checkAuthentication(): boolean {
  // ChatGPT example
  const loginButton = document.querySelector('button:contains("Log in")');
  const signupButton = document.querySelector('button:contains("Sign up")');
  
  return !(loginButton || signupButton);
}

// Initial check
if (!checkAuthentication()) {
  chrome.runtime.sendMessage({
    type: 'AUTH_REQUIRED',
    modelId: MODEL_ID
  });
}
```

## Background Script Development

The background script coordinates communication between content scripts and the backend.

### Basic Structure

```typescript
// background.js

// Map of modelId to tabId
const modelTabMap: Record<string, number> = {};

// WebSocket connection to backend
let socket: WebSocket | null = null;

// Connect to backend WebSocket
function connectWebSocket(token: string) { /* ... */ }

// Handle messages from backend
function handleBackendMessage(message: SocketMessageBase) { /* ... */ }

// Send message to backend
function sendToBackend(message: SocketMessageBase) { /* ... */ }

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender) => { /* ... */ });

// Check session health periodically
function checkSessionHealth() { /* ... */ }

// Initialize extension
function initialize() { /* ... */ }

initialize();
```

### WebSocket Connection

Establish and maintain a WebSocket connection to the backend:

```typescript
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
```

### Message Handling

Handle messages from the backend:

```typescript
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
```

### Tab Management

Manage model-to-tab mapping:

```typescript
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
```

### Session Health Monitoring

Periodically check the health of model sessions:

```typescript
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

// Set up periodic health checks
setInterval(checkSessionHealth, 30000);
```

### Authentication Management

Handle authentication and token storage:

```typescript
// Store token in local storage
function storeToken(token: string) {
  chrome.storage.local.set({ token }, () => {
    console.log('Token stored');
    connectWebSocket(token);
  });
}

// Get token from local storage
function getToken(): Promise<string | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get(['token'], (result) => {
      resolve(result.token || null);
    });
  });
}

// Initialize extension
async function initialize() {
  // Get token from storage
  const token = await getToken();
  if (token) {
    connectWebSocket(token);
  }
  
  // Set up periodic health checks
  setInterval(checkSessionHealth, 30000);
}
```

## Common Utilities

Create shared utilities for both content and background scripts:

```typescript
// utils/dom.ts

/**
 * Safely get text content from an element
 * @param selector CSS selector
 * @param root Root element to search from
 * @returns Text content or null
 */
export function getTextContent(selector: string, root: Document | Element = document): string | null {
  const element = root.querySelector(selector);
  return element ? element.textContent : null;
}

/**
 * Wait for an element to appear in the DOM
 * @param selector CSS selector
 * @param timeout Timeout in milliseconds
 * @returns Promise resolving to the element or null
 */
export function waitForElement(selector: string, timeout = 5000): Promise<Element | null> {
  return new Promise((resolve) => {
    // Check if element already exists
    const element = document.querySelector(selector);
    if (element) {
      resolve(element);
      return;
    }
    
    // Set up observer
    const observer = new MutationObserver((mutations, obs) => {
      const element = document.querySelector(selector);
      if (element) {
        obs.disconnect();
        resolve(element);
      }
    });
    
    // Start observing
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    // Set timeout
    setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, timeout);
  });
}

/**
 * Simulate typing in an input element
 * @param element Input element
 * @param text Text to type
 * @param delay Delay between characters in milliseconds
 */
export async function simulateTyping(element: HTMLInputElement | HTMLTextAreaElement, text: string, delay = 10): Promise<void> {
  // Focus element
  element.focus();
  
  // Clear existing text
  element.value = '';
  
  // Type characters with delay
  for (let i = 0; i < text.length; i++) {
    element.value += text[i];
    element.dispatchEvent(new Event('input', { bubbles: true }));
    
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

## Testing

### Content Script Testing

Test content scripts using Jest and Puppeteer:

```typescript
// __tests__/content/chatgpt.test.js
import puppeteer from 'puppeteer';

describe('ChatGPT Content Script', () => {
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
  
  test('should detect chat interface', async () => {
    await page.goto('https://chat.openai.com/');
    
    // Wait for login
    await page.waitForSelector('textarea[data-id="root"]', { timeout: 60000 });
    
    // Check if content script registered the model
    const backgroundPage = await browser.waitForTarget(
      target => target.type() === 'background_page'
    ).page();
    
    const modelTabMap = await backgroundPage.evaluate(() => {
      return window.modelTabMap;
    });
    
    expect(modelTabMap).toHaveProperty('browser:chatgpt');
  });
  
  test('should submit prompt and extract response', async () => {
    // Inject test prompt
    await page.evaluate(() => {
      chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'RUN_PROMPT') {
          return true;
        }
      });
      
      // Simulate receiving a prompt
      chrome.runtime.dispatchMessage({
        type: 'RUN_PROMPT',
        promptId: 'test-prompt',
        text: 'Hello, ChatGPT'
      });
    });
    
    // Wait for response
    await page.waitForFunction(() => {
      const responseElements = document.querySelectorAll('.markdown');
      return responseElements.length > 0 && !document.querySelector('.result-streaming');
    }, { timeout: 30000 });
    
    // Check if response was sent back
    const backgroundPage = await browser.waitForTarget(
      target => target.type() === 'background_page'
    ).page();
    
    const sentMessages = await backgroundPage.evaluate(() => {
      return window.sentMessages;
    });
    
    expect(sentMessages).toContainEqual(
      expect.objectContaining({
        type: 'extension:prompt:result',
        payload: expect.objectContaining({
          promptId: 'test-prompt'
        })
      })
    );
  });
});
```

### Background Script Testing

Test the background script using Jest:

```typescript
// __tests__/background/index.test.js
import { createBackgroundScript } from '../../src/background';

// Mock chrome API
global.chrome = {
  runtime: {
    onMessage: {
      addListener: jest.fn()
    },
    sendMessage: jest.fn()
  },
  tabs: {
    sendMessage: jest.fn()
  },
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn()
    }
  }
};

// Mock WebSocket
global.WebSocket = jest.fn().mockImplementation(() => ({
  onopen: null,
  onmessage: null,
  onerror: null,
  onclose: null,
  send: jest.fn(),
  close: jest.fn(),
  readyState: 1
}));

describe('Background Script', () => {
  let background;
  let mockSocket;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock storage.local.get to return a token
    chrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({ token: 'mock-token' });
    });
    
    background = createBackgroundScript();
    mockSocket = WebSocket.mock.instances[0];
  });
  
  test('should connect to WebSocket on initialization', () => {
    expect(WebSocket).toHaveBeenCalledWith('wss://api.hybridthinking.ai/v1/ws?token=mock-token');
  });
  
  test('should register model tab', () => {
    // Simulate content script message
    const listener = chrome.runtime.onMessage.addListener.mock.calls[0][0];
    
    listener(
      { type: 'REGISTER_MODEL_TAB', modelId: 'browser:chatgpt' },
      { tab: { id: 123 } }
    );
    
    expect(background.getModelTabMap()).toEqual({
      'browser:chatgpt': 123
    });
  });
  
  test('should forward prompt to content script', () => {
    // Register a model tab
    const listener = chrome.runtime.onMessage.addListener.mock.calls[0][0];
    listener(
      { type: 'REGISTER_MODEL_TAB', modelId: 'browser:chatgpt' },
      { tab: { id: 123 } }
    );
    
    // Simulate WebSocket message
    mockSocket.onmessage({
      data: JSON.stringify({
        type: 'extension:run:prompt',
        payload: {
          promptId: 'test-prompt',
          model: 'browser:chatgpt',
          text: 'Hello, ChatGPT'
        }
      })
    });
    
    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
      123,
      {
        type: 'RUN_PROMPT',
        promptId: 'test-prompt',
        text: 'Hello, ChatGPT'
      }
    );
  });
  
  test('should send prompt result to backend', () => {
    // Simulate content script message
    const listener = chrome.runtime.onMessage.addListener.mock.calls[0][0];
    
    listener(
      {
        type: 'PROMPT_RESULT',
        promptId: 'test-prompt',
        text: 'Hello, I am ChatGPT'
      },
      { tab: { id: 123 } }
    );
    
    expect(mockSocket.send).toHaveBeenCalledWith(
      expect.stringContaining('extension:prompt:result')
    );
    
    const sentMessage = JSON.parse(mockSocket.send.mock.calls[0][0]);
    expect(sentMessage).toEqual({
      type: 'extension:prompt:result',
      payload: {
        promptId: 'test-prompt',
        text: 'Hello, I am ChatGPT'
      },
      timestamp: expect.any(String)
    });
  });
});
```

## Best Practices

### 1. Robust DOM Selection

- Use multiple selector strategies
- Implement fallbacks for different UI versions
- Use attribute selectors when possible (more stable than class names)
- Consider using XPath for complex selections

### 2. Error Handling

- Implement comprehensive error handling
- Log errors for debugging
- Report errors to the background script
- Recover gracefully when possible

### 3. Performance Optimization

- Use efficient DOM selectors
- Minimize DOM operations
- Use debouncing for frequent events
- Observe only necessary DOM subtrees

### 4. Security Considerations

- Never expose sensitive information
- Use content script isolation
- Validate all messages
- Follow the principle of least privilege

### 5. Maintainability

- Use TypeScript for type safety
- Document code thoroughly
- Create reusable utilities
- Follow consistent naming conventions

## Troubleshooting

### Common Issues

1. **Content Script Not Injecting**
   - Check manifest.js matches patterns
   - Verify content script is being bundled correctly
   - Check for console errors during injection

2. **DOM Selectors Not Working**
   - Website may have updated its UI
   - Use browser devtools to inspect current DOM structure
   - Update selectors to match new structure

3. **Communication Failures**
   - Check if content script is registered with background script
   - Verify message format is correct
   - Check for errors in message handlers

4. **WebSocket Connection Issues**
   - Verify token is valid
   - Check network connectivity
   - Implement reconnection logic

## Future Enhancements

[TODO: Define specific enhancements for content and background scripts]

1. **Adaptive DOM Selection**: Machine learning-based DOM selection that adapts to UI changes
2. **Enhanced Error Recovery**: More sophisticated error recovery strategies
3. **Performance Monitoring**: Collect and report performance metrics
4. **Cross-Browser Support**: Extend support to Firefox and Safari
