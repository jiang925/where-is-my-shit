import { vi } from 'vitest';

// Mock chrome.storage.local
const storageData: Record<string, unknown> = {};

const chromeStorageLocal = {
  get: vi.fn(async (keys: string | string[]) => {
    if (typeof keys === 'string') {
      return { [keys]: storageData[keys] };
    }
    const result: Record<string, unknown> = {};
    for (const key of keys) {
      result[key] = storageData[key];
    }
    return result;
  }),
  set: vi.fn(async (items: Record<string, unknown>) => {
    Object.assign(storageData, items);
  }),
  remove: vi.fn(async (keys: string | string[]) => {
    const keyList = typeof keys === 'string' ? [keys] : keys;
    for (const key of keyList) {
      delete storageData[key];
    }
  }),
};

const chromeStorageOnChanged = {
  addListener: vi.fn(),
  removeListener: vi.fn(),
};

// Mock chrome.runtime
const chromeRuntime = {
  sendMessage: vi.fn().mockResolvedValue(undefined),
  onMessage: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
  },
};

// Mock chrome.alarms
const chromeAlarms = {
  create: vi.fn(),
  clear: vi.fn(),
  onAlarm: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
  },
};

// Assign to global
Object.defineProperty(globalThis, 'chrome', {
  value: {
    storage: {
      local: chromeStorageLocal,
      onChanged: chromeStorageOnChanged,
    },
    runtime: chromeRuntime,
    alarms: chromeAlarms,
  },
  writable: true,
});

// Mock crypto.subtle for fingerprint tests
if (!globalThis.crypto?.subtle) {
  // jsdom should provide this, but just in case
}

// Helper to reset storage between tests
export function resetChromeStorage() {
  for (const key of Object.keys(storageData)) {
    delete storageData[key];
  }
  vi.clearAllMocks();
}
