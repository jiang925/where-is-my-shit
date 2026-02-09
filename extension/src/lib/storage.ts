export interface Settings {
  captureEnabled: boolean;
  serverUrl: string;
  lastCaptureTimestamp: number;
  authToken?: string;
}

const DEFAULT_SETTINGS: Settings = {
  captureEnabled: true,
  serverUrl: 'http://localhost:8000',
  lastCaptureTimestamp: 0,
  authToken: ''
};

/**
 * Get extension settings from chrome.storage.local
 */
export async function getSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get('settings');
  return { ...DEFAULT_SETTINGS, ...result.settings };
}

/**
 * Update extension settings
 */
export async function setSettings(partial: Partial<Settings>): Promise<void> {
  const current = await getSettings();
  const updated = { ...current, ...partial };
  await chrome.storage.local.set({ settings: updated });
}

/**
 * Get seen message fingerprints from storage
 */
export async function getSeenFingerprints(): Promise<string[]> {
  const result = await chrome.storage.local.get('seen_fingerprints');
  return result.seen_fingerprints || [];
}

/**
 * Add a fingerprint to the seen list with LRU eviction
 */
export async function addSeenFingerprint(fp: string, maxSize: number = 10000): Promise<void> {
  const seen = await getSeenFingerprints();

  // Add to front (most recent)
  seen.unshift(fp);

  // Evict old entries if over limit
  const trimmed = seen.slice(0, maxSize);

  await chrome.storage.local.set({ seen_fingerprints: trimmed });
}

/**
 * Clear all seen fingerprints
 */
export async function clearSeenFingerprints(): Promise<void> {
  await chrome.storage.local.remove('seen_fingerprints');
}
