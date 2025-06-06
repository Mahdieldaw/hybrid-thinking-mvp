// background.js - ExtensionCoordinator for Hybrid Thinking browser extension
// Implements message routing and backend WebSocket coordination

// Defines the mapping from abstract model IDs to hostnames for routing
const PROVIDER_HOST_MAP = {
  'browser:chatgpt': 'chatgpt.com',
  'browser:claude': 'claude.ai',
  'browser:gemini': 'gemini.google.com',
  // Add other browser-based models here
};

class ExtensionCoordinator {
  constructor() {
    this.isConnected = false;
    this.socket = null;
    this.activeModelSessions = new Map(); // tabId -> { modelId, tabId }
    this.setupMessageHandlers();
    this.connectWebSocket();
  }

  setupMessageHandlers() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log('Background received message:', message);
      switch (message.type) {
        case 'PROMPT_RESULT':
          this.forwardToBackend(message);
          break;
        case 'SESSION_STATUS': // Sent by content scripts
          if (sender.tab && sender.tab.id && message.modelId) {
            if (message.isActive) {
              this.activeModelSessions.set(sender.tab.id, {
                modelId: message.modelId,
                tabId: sender.tab.id,
              });
            } else {
              this.activeModelSessions.delete(sender.tab.id);
            }
            this.notifyPopupDataChanged();
          }
          this.forwardToBackend(message); // Also forward to backend if needed
          break;
        case 'GET_POPUP_DATA': // Sent by popup
          sendResponse({
            isConnected: this.isConnected,
            sessions: Array.from(this.activeModelSessions.values()),
          });
          return true; // Indicates asynchronous response
        case 'LOGIN_REQUESTED': // Sent by popup
          console.log('Login request received. Placeholder action.');
          // TODO: Implement actual login flow (e.g., open login page)
          sendResponse({ status: 'Login action placeholder triggered' });
          break;
        // INJECT_PROMPT and HEALTH_CHECK are typically initiated by the backend via WebSocket
        // and then routed by routeToProvider, not directly via chrome.runtime.onMessage from other extension parts.
        // If other extension parts need to trigger these, they should go via backend or a new message type.
      }
      // Ensure sendResponse is called for messages expecting a response, or return true for async.
      return false; // Default for messages not handled or not needing async response
    });

    // Listen for tab removal to clean up sessions
    chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
      if (this.activeModelSessions.has(tabId)) {
        this.activeModelSessions.delete(tabId);
        this.notifyPopupDataChanged();
        console.log(`Session for tab ${tabId} removed due to tab closure.`);
      }
    });

    // Optional: Handle external messages if needed
    // chrome.runtime.onMessageExternal && chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
    //   // Handle messages from other extensions or web pages
    // });
  }

  routeToProvider(message) {
    const modelId = message.providerId; // This should be like 'browser:claude'
    const targetHost = PROVIDER_HOST_MAP[modelId];

    if (!targetHost) {
      console.warn(`No host mapping found for providerId: ${modelId}`);
      return;
    }

    chrome.tabs.query({}, (tabs) => {
      let foundTab = false;
      for (const tab of tabs) {
        if (tab.url && tab.url.includes(targetHost)) {
          chrome.tabs.sendMessage(tab.id, message, (response) => {
            if (chrome.runtime.lastError) {
              console.error(`Error sending message to tab ${tab.id} for ${modelId}:`, chrome.runtime.lastError.message);
            } else {
              console.log(`Message sent to tab ${tab.id} for ${modelId}, response:`, response);
              // Optionally, update activeModelSessions here or rely on SESSION_STATUS from content script
            }
          });
          foundTab = true;
          // break; // Uncomment if you only want to send to the first matching tab
        }
      }
      if (!foundTab) {
        console.warn(`No active tab found for ${modelId} (host: ${targetHost})`);
        // Optionally, notify backend or user that the target model tab is not open.
      }
    });
  }

  connectWebSocket() {
    const WS_URL = 'ws://localhost:4000'; // [TODO: update WS_URL if different]
    this.socket = new WebSocket(WS_URL);

    this.socket.onopen = () => {
      console.log('WebSocket connected to backend');
      this.isConnected = true;
      this.notifyPopupDataChanged();
    };

    this.socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        console.log('WebSocket message received from backend:', msg);

        if (msg.type === 'extension:run_prompt') {
          this.routeToProvider({
            type: 'INJECT_PROMPT',
            providerId: msg.payload.model, // This is the modelId like 'browser:claude'
            promptId: msg.payload.promptId,
            text: msg.payload.text,
          });
        } else if (msg.type === 'extension:health_check') {
          this.routeToProvider({
            type: 'HEALTH_CHECK',
            providerId: msg.payload.model, // This is the modelId
          });
        } else {
          console.log('Received unhandled message type from backend:', msg.type);
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error, 'Raw data:', event.data);
      }
    };

    this.socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.isConnected = false;
      this.notifyPopupDataChanged();
      // Reconnect logic is handled by onclose
    };

    this.socket.onclose = (event) => {
      console.log('WebSocket closed. Reason:', event.code, event.reason, 'Clean close:', event.wasClean);
      this.isConnected = false;
      this.notifyPopupDataChanged();
      // Implement more robust reconnection logic (e.g., exponential backoff)
      console.log('Attempting to reconnect WebSocket in 5 seconds...');
      setTimeout(() => this.connectWebSocket(), 5000); // Increased timeout
    };
  }

  forwardToBackend(message) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      try {
        this.socket.send(JSON.stringify(message));
        console.log('Forwarded message to backend:', message);
      } catch (error) {
        console.error('Error forwarding message to backend:', error);
      }
    } else {
      console.warn('Cannot forward message to backend, WebSocket not open. State:', this.socket ? this.socket.readyState : 'null');
    }
  }

  notifyPopupDataChanged() {
    if (chrome.runtime && chrome.runtime.sendMessage) {
      const payload = {
        isConnected: this.isConnected,
        sessions: Array.from(this.activeModelSessions.values()),
      };
      chrome.runtime.sendMessage(
        { type: 'POPUP_DATA_UPDATED', payload },
        () => {
          if (chrome.runtime.lastError) {
            // This error often means no popup is open to receive the message, which is fine.
            // console.log('Popup not open or error sending update:', chrome.runtime.lastError.message);
          }
        }
      );
      // console.log('Sent POPUP_DATA_UPDATED:', payload);
    }
  }
}

// Initialize the coordinator when the background script loads
const coordinator = new ExtensionCoordinator();
console.log('ExtensionCoordinator initialized.');
