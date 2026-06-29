import { vi } from 'vitest';

globalThis.__RED = globalThis.__RED || {};

globalThis.chrome = {
  storage: {
    local: {
      _data: {},
      get: vi.fn((keys) => {
        return Promise.resolve({});
      }),
      set: vi.fn((items) => {
        return Promise.resolve();
      }),
      remove: vi.fn((keys) => {
        return Promise.resolve();
      }),
    },
    onChanged: {
      addListener: vi.fn(),
    },
  },
  runtime: {
    id: 'test-extension-id',
    getURL: vi.fn((path) => `chrome-extension://test/${path}`),
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
    },
  },
  action: {
    openPopup: vi.fn(),
  },
  identity: {
    launchWebAuthFlow: vi.fn(),
  },
};
