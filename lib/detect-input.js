// Isolated input detection for Claude.ai.
// When Claude's UI breaks RED, only this file needs patching.

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

function watchInput(onInput, onConnect, onTimeout) {
  let current = null;
  let reconnectTimer = null;
  let timeoutTimer = null;

  function connect() {
    const el = findInput();
    if (el && el !== current) {
      if (current) {
        current.removeEventListener('input', onInput);
        current.removeEventListener('keyup', onInput);
      }
      current = el;
      el.addEventListener('input', onInput);
      el.addEventListener('keyup', onInput);
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

  return function cleanup() {
    observer.disconnect();
    navObserver.disconnect();
    clearTimeout(timeoutTimer);
    if (current) {
      current.removeEventListener('input', onInput);
      current.removeEventListener('keyup', onInput);
    }
  };
}

window.__RED = window.__RED || {};
window.__RED.watchInput = watchInput;
window.__RED.injectPanel = window.__RED.injectPanel || null;
