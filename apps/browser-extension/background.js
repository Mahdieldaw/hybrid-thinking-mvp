// background.js - ExtensionCoordinator for Hybrid Thinking browser extension
// Implements message routing and backend WebSocket coordination

class ExtensionCoordinator {
  constructor() {
    this.activeConnections = new Map();
    this.setupMessageHandlers();
    this.connectWebSocket();
  }

  setupMessageHandlers() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'PROMPT_RESULT' || message.type === 'SESSION_STATUS') {
        this.forwardToBackend(message);
      }
      if (message.type === 'INJECT_PROMPT' || message.type === 'HEALTH_CHECK') {
        this.routeToProvider(message);
      }
    });
    chrome.runtime.onMessageExternal && chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
      // [Optional: handle external messages]
    });
  }

  routeToProvider(message) {
    // Example: message.providerId must be set
    chrome.tabs.query({}, (tabs) => {
      for (const tab of tabs) {
        if (tab.url && message.providerId && tab.url.includes(message.providerId)) {
          chrome.tabs.sendMessage(tab.id, message);
        }
      }
    });
  }

  connectWebSocket() {
    const WS_URL = 'ws://localhost:4000'; // [TODO: update WS_URL if different]
    this.socket = new WebSocket(WS_URL);
    this.socket.onopen = () => {
      console.log('Connected to backend');
    };
    this.socket.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'extension:run_prompt') {
        this.routeToProvider({
          type: 'INJECT_PROMPT',
          providerId: msg.payload.model,
          promptId: msg.payload.promptId,
          text: msg.payload.text,
        });
      }
      if (msg.type === 'extension:health_check') {
        this.routeToProvider({
          type: 'HEALTH_CHECK',
          providerId: msg.payload.model,
        });
      }
    };
    this.socket.onerror = (err) => {
      console.error('WebSocket error', err);
    };
    this.socket.onclose = () => {
      console.log('WebSocket closed, reconnecting...');
      setTimeout(() => this.connectWebSocket(), 1000); // [TODO: error-handling timeouts]
    };
  }

  forwardToBackend(message) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }
}

const coordinator = new ExtensionCoordinator();
