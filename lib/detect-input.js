// Isolated input detection for AI chat interfaces.
// When the target UI breaks RED, only this file needs patching.

function detectPlatform() {
  var h = location.hostname;
  if (h.includes('chatgpt.com')) return 'chatgpt';
  if (h.includes('gemini.google.com')) return 'gemini';
  if (h.includes('chat.deepseek.com')) return 'deepseek';
  if (h.includes('perplexity.ai')) return 'perplexity';
  if (h.includes('grok.com')) return 'grok';
  if (h.includes('chat.mistral.ai')) return 'mistral';
  if (h.includes('copilot.microsoft.com')) return 'copilot';
  if (h.includes('claude.ai')) return 'claude';
  return 'unknown';
}

var PLATFORM = detectPlatform();

var INPUT_SELECTORS = {
  chatgpt:    '#prompt-textarea, [data-testid="message-input"], div.ProseMirror[contenteditable="true"], [contenteditable="true"]',
  gemini:     'rich-textarea .ql-editor, .ql-editor, [contenteditable="true"][role="textbox"], [contenteditable="true"]',
  deepseek:   'textarea#chat-input, textarea[placeholder*="Send a message"], textarea[placeholder*="Message"], textarea',
  perplexity: '#ask-input, textarea[placeholder*="Ask"], textarea[placeholder*="Search"], textarea',
  grok:       '.tiptap.ProseMirror[contenteditable="true"], [contenteditable="true"][role="textbox"], [contenteditable="true"]',
  mistral:    'div.ProseMirror[contenteditable="true"], div.ProseMirror, [contenteditable="true"]',
  copilot:    'textarea#userInput, textarea[data-testid="composer-input"], textarea[placeholder*="Message"], textarea',
  claude:     'div.ProseMirror[contenteditable="true"], [data-testid="composer-input"], [contenteditable="true"][role="textbox"], [contenteditable="true"]',
  unknown:    '[contenteditable="true"], [role="textbox"], textarea',
};

var SEND_BUTTON_SELECTORS = {
  chatgpt:    'button[data-testid="send-button"], button[aria-label*="Send"], button[type="submit"]',
  gemini:     'button[aria-label="Send message"], button.send-button, button[aria-label*="Send"]',
  deepseek:   'button[aria-label="Send message"], [data-testid="send-button"], button[type="submit"]',
  perplexity: 'button[aria-label="Submit"], button[type="submit"], button[aria-label*="Send"]',
  grok:       'button[aria-label="Submit"], button[aria-label="Send message"], button[data-testid="send-button"]',
  mistral:    'button[aria-label="Send"], button[type="submit"], button[aria-label*="send"]',
  copilot:    'button[aria-label="Submit"], button[data-testid="send-button"], button[aria-label*="Send"]',
  claude:     'button[data-testid="send-button"], button[aria-label="Send message"], button[aria-label="Send Message"]',
  unknown:    'button[data-testid="send-button"], button[aria-label="Send message"], button[aria-label="Send"], button[aria-label="Submit"], button[type="submit"]',
};

function findInput() {
  var sels = INPUT_SELECTORS[PLATFORM] || INPUT_SELECTORS.unknown;
  var list = sels.split(',');
  for (var i = 0; i < list.length; i++) {
    var el = document.querySelector(list[i].trim());
    if (el && el.isConnected) return el;
  }
  return null;
}

function findSendButton() {
  var sels = SEND_BUTTON_SELECTORS[PLATFORM] || SEND_BUTTON_SELECTORS.unknown;
  var list = sels.split(',');
  for (var i = 0; i < list.length; i++) {
    var el = document.querySelector(list[i].trim());
    if (el && el.isConnected) return el;
  }
  return null;
}

function watchInput(onInput, onConnect, onTimeout, onSend) {
  var current = null;
  var reconnectTimer = null;
  var timeoutTimer = null;
  var sendBtnEl = null;
  var sendBtnHandler = null;

  function handleKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey && onSend) {
      onSend();
    }
  }

  function tryAttachSendButton() {
    if (!onSend) return;
    var btn = findSendButton();
    if (btn && btn !== sendBtnEl) {
      if (sendBtnEl && sendBtnHandler) {
        sendBtnEl.removeEventListener('click', sendBtnHandler);
      }
      sendBtnEl = btn;
      sendBtnHandler = function () { if (onSend) onSend(); };
      btn.addEventListener('click', sendBtnHandler);
    }
  }

  function connect() {
    var el = findInput();
    if (el && el !== current) {
      if (current) {
        current.removeEventListener('input', onInput);
        current.removeEventListener('keyup', onInput);
        current.removeEventListener('keydown', handleKeydown);
      }
      current = el;
      el.addEventListener('input', onInput);
      el.addEventListener('keyup', onInput);
      el.addEventListener('keydown', handleKeydown);
      if (onConnect) onConnect(el);
      clearTimeout(timeoutTimer);
      timeoutTimer = null;
    }
  }

  connect();

  if (!current && onTimeout) {
    timeoutTimer = setTimeout(function () {
      if (!findInput()) {
        onTimeout();
      }
    }, 10000);
  }

  var observer = new MutationObserver(function () {
    var el = findInput();
    if (el && el !== current) connect();
    tryAttachSendButton();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  var lastUrl = location.href;
  var navObserver = new MutationObserver(function () {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(function () { connect(); }, 600);
    }
  });
  navObserver.observe(document.body, { childList: true, subtree: true });

  tryAttachSendButton();

  return function cleanup() {
    observer.disconnect();
    navObserver.disconnect();
    clearTimeout(timeoutTimer);
    if (current) {
      current.removeEventListener('input', onInput);
      current.removeEventListener('keyup', onInput);
      current.removeEventListener('keydown', handleKeydown);
    }
    if (sendBtnEl && sendBtnHandler) {
      sendBtnEl.removeEventListener('click', sendBtnHandler);
    }
  };
}

window.__RED = window.__RED || {};
window.__RED.watchInput = watchInput;
window.__RED.injectPanel = window.__RED.injectPanel || null;
window.__RED.platform = PLATFORM;
