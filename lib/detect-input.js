// Isolated input detection for AI chat interfaces.
// When the target UI breaks RED, only this file needs patching.

const SELECTORS = [
  '[contenteditable="true"]',
  '[role="textbox"]',
  'div[contenteditable="true"]',
  '.ProseMirror'
];

function findInput() {
  for (const sel of SELECTORS) {
    const el = document.querySelector(sel);
    if (el && el.isConnected) return el;
  }
  return null;
}

function watchInput(onInput, onConnect, onTimeout, onSend) {
  let current = null;
  let reconnectTimer = null;
  let timeoutTimer = null;
  let sendBtnEl = null;
  let sendBtnHandler = null;

  function handleKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey && onSend) {
      onSend();
    }
  }

  function tryAttachSendButton() {
    if (!onSend) return;
    var selectors = [
      'button[data-testid="send-button"]',
      'button[aria-label="Send message"]',
      'button[aria-label="Send"]',
    ];
    for (var si = 0; si < selectors.length; si++) {
      var btn = document.querySelector(selectors[si]);
      if (btn && btn.isConnected && btn !== sendBtnEl) {
        if (sendBtnEl && sendBtnHandler) {
          sendBtnEl.removeEventListener('click', sendBtnHandler);
        }
        sendBtnEl = btn;
        sendBtnHandler = function () { if (onSend) onSend(); };
        btn.addEventListener('click', sendBtnHandler);
        return;
      }
    }
  }

  function connect() {
    const el = findInput();
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

  const observer = new MutationObserver(() => {
    const el = findInput();
    if (el && el !== current) connect();
    tryAttachSendButton();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  let lastUrl = location.href;
  const navObserver = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(() => connect(), 600);
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
