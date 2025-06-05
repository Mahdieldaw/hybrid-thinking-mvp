// UniversalLLMHandler content script for Hybrid Thinking browser extension
// Handles prompt injection and health checks for multiple AI sites

const site_configs = {
  'chat.openai.com': {
    inputSelector: 'textarea[data-id="root"]',
    submitSelector: 'button[data-testid="send-button"]',
    responseSelector: '.markdown',
    loadingSelector: '.result-streaming',
  },
  'claude.ai': {
    // [TODO: fill in selectors for new sites]
  },
  'perplexity.ai': {
    // [TODO: fill in selectors for new sites]
  },
  'bard.google.com': {
    // [TODO: fill in selectors for new sites]
  },
};

const hostname = window.location.hostname;
const config = site_configs[hostname];
let promptIdInProgress = null;

function getInputElement() {
  return config && config.inputSelector ? document.querySelector(config.inputSelector) : null;
}
function getSubmitButton() {
  return config && config.submitSelector ? document.querySelector(config.submitSelector) : null;
}
function isOnChatInterface() {
  return !!getInputElement() && !!getSubmitButton();
}
function isResponseComplete() {
  return config && config.loadingSelector ? !document.querySelector(config.loadingSelector) : true;
}
function extractResponseText() {
  if (!config || !config.responseSelector) return null;
  const responseElements = document.querySelectorAll(config.responseSelector);
  if (responseElements.length === 0) return null;
  const lastResponse = responseElements[responseElements.length - 1];
  return lastResponse.textContent;
}

const observer = new MutationObserver(() => {
  if (promptIdInProgress && isResponseComplete()) {
    const responseText = extractResponseText();
    if (responseText) {
      chrome.runtime.sendMessage({
        type: 'PROMPT_RESULT',
        promptId: promptIdInProgress,
        text: responseText,
      });
      promptIdInProgress = null;
    }
  }
});
if (document.body) {
  observer.observe(document.body, { childList: true, subtree: true });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'INJECT_PROMPT') {
    const { promptId, text } = message;
    if (!isOnChatInterface()) {
      chrome.runtime.sendMessage({ type: 'SESSION_STATUS', valid: false });
      return;
    }
    const inputElement = getInputElement();
    if (!inputElement) return;
    promptIdInProgress = promptId;
    inputElement.value = text;
    inputElement.dispatchEvent(new Event('input', { bubbles: true }));
    const submitButton = getSubmitButton();
    if (submitButton) submitButton.click();
  }
  if (message.type === 'HEALTH_CHECK') {
    sendResponse({ valid: isOnChatInterface() });
  }
});

if (!isOnChatInterface()) {
  chrome.runtime.sendMessage({ type: 'SESSION_STATUS', valid: false });
}
