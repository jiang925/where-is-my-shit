import { getSettings } from '../lib/storage';
import type { BrowseItem } from '../lib/api';

interface StatusResponse {
  queueSize: number;
  serverOnline: boolean;
  lastCaptureTimestamp: number;
}

interface RecentResponse {
  items: BrowseItem[];
  serverOnline: boolean;
}

// Platform abbreviation map
const PLATFORM_ABBREV: Record<string, string> = {
  'chatgpt': 'GPT',
  'claude': 'CL',
  'claude-code': 'CC',
  'gemini': 'GEM',
  'perplexity': 'PPX',
  'cursor': 'CUR'
};

// Known platform CSS classes
const KNOWN_PLATFORMS = new Set([
  'chatgpt', 'claude', 'claude-code', 'gemini', 'perplexity', 'cursor'
]);

// DOM elements
const captureToggle = document.getElementById('captureToggle') as HTMLInputElement;
const serverStatus = document.getElementById('serverStatus') as HTMLElement;
const serverStatusText = document.getElementById('serverStatusText') as HTMLElement;
const queueSection = document.getElementById('queueSection') as HTMLElement;
const queueCount = document.getElementById('queueCount') as HTMLElement;
const lastCapture = document.getElementById('lastCapture') as HTMLElement;
const openOptions = document.getElementById('openOptions') as HTMLAnchorElement;

const configWarning = document.getElementById('configWarning') as HTMLElement;
const openOptionsLink = document.getElementById('openOptionsLink') as HTMLAnchorElement;

const searchInput = document.getElementById('searchInput') as HTMLInputElement;
const recentList = document.getElementById('recentList') as HTMLElement;
const seeAllLink = document.getElementById('seeAllLink') as HTMLAnchorElement;
const openWimsBtn = document.getElementById('openWimsBtn') as HTMLButtonElement;

// Auto-refresh interval
let refreshInterval: number | null = null;

/**
 * Initialize popup
 */
async function init() {
  // Load initial settings
  const settings = await getSettings();
  captureToggle.checked = settings.captureEnabled;

  // Check if we need configuration (no API key)
  if (!settings.apiKey) {
    showConfigWarning(true);
  } else {
    showConfigWarning(false);
    // Update status to check if server is reachable
    await updateStatus();
    // Load recent items after status check
    await loadRecentItems();
  }

  // Start auto-refresh every 5 seconds
  refreshInterval = window.setInterval(() => {
    updateStatus();
  }, 5000);

  // Set up event listeners
  captureToggle.addEventListener('change', handleToggleChange);
  openOptions.addEventListener('click', handleOpenOptions);
  openOptionsLink.addEventListener('click', handleOpenOptions);
  searchInput.addEventListener('keydown', handleSearchKeydown);
  seeAllLink.addEventListener('click', handleSeeAll);
  openWimsBtn.addEventListener('click', handleOpenWIMS);
}

/**
 * Toggle configuration warning
 */
function showConfigWarning(show: boolean) {
  if (show) {
    configWarning.style.display = 'block';
  } else {
    configWarning.style.display = 'none';
  }
}

/**
 * Handle capture toggle change
 */
async function handleToggleChange() {
  const enabled = captureToggle.checked;

  try {
    await chrome.runtime.sendMessage({
      type: 'TOGGLE_CAPTURE',
      payload: { enabled }
    });
    console.log(`[WIMS Popup] Capture ${enabled ? 'enabled' : 'disabled'}`);
  } catch (error) {
    console.error('[WIMS Popup] Failed to toggle capture:', error);
    // Revert toggle on error
    captureToggle.checked = !enabled;
  }
}

/**
 * Update status display
 */
async function updateStatus() {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'GET_STATUS'
    }) as StatusResponse;

    // Update server status
    if (response.serverOnline) {
      serverStatus.className = 'status-dot online';
      serverStatusText.textContent = 'Connected';
    } else {
      serverStatus.className = 'status-dot offline';
      serverStatusText.textContent = 'Offline';
    }

    // Update queue count (only show if > 0)
    if (response.queueSize > 0) {
      queueSection.style.display = 'flex';
      queueCount.textContent = `${response.queueSize} messages`;
    } else {
      queueSection.style.display = 'none';
    }

    // Update last capture time
    if (response.lastCaptureTimestamp > 0) {
      const timeAgo = formatTimeAgo(response.lastCaptureTimestamp);
      lastCapture.textContent = timeAgo;
    } else {
      lastCapture.textContent = 'Never';
    }
  } catch (error) {
    console.error('[WIMS Popup] Failed to get status:', error);
    serverStatus.className = 'status-dot offline';
    serverStatusText.textContent = 'Error';
  }
}

/**
 * Load recent items from service worker
 */
async function loadRecentItems() {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'GET_RECENT'
    }) as RecentResponse;

    if (!response.serverOnline && response.items.length === 0) {
      renderRecentOffline();
      return;
    }

    renderRecentItems(response.items);
  } catch (error) {
    console.error('[WIMS Popup] Failed to load recent items:', error);
    renderRecentOffline();
  }
}

/**
 * Render recent items in the popup
 */
function renderRecentItems(items: BrowseItem[]) {
  recentList.innerHTML = '';

  if (items.length === 0) {
    const emptyMsg = document.createElement('div');
    emptyMsg.className = 'recent-offline';
    emptyMsg.textContent = 'No captures yet';
    recentList.appendChild(emptyMsg);
    seeAllLink.style.display = 'none';
    return;
  }

  for (const item of items) {
    const el = createRecentItem(item);
    recentList.appendChild(el);
  }

  seeAllLink.style.display = 'block';
}

/**
 * Show offline message in recent section
 */
function renderRecentOffline() {
  recentList.innerHTML = '';
  const msg = document.createElement('div');
  msg.className = 'recent-offline';
  msg.textContent = 'Connect to server to see recent captures';
  recentList.appendChild(msg);
  seeAllLink.style.display = 'none';
}

/**
 * Create DOM element for a single recent item
 */
function createRecentItem(item: BrowseItem): HTMLElement {
  const el = document.createElement('div');
  el.className = 'recent-item';
  el.addEventListener('click', () => {
    chrome.tabs.create({ url: item.url });
  });

  // Platform badge
  const badge = document.createElement('span');
  const platformClass = KNOWN_PLATFORMS.has(item.platform)
    ? `platform-${item.platform}`
    : 'platform-unknown';
  badge.className = `platform-badge ${platformClass}`;
  badge.textContent = PLATFORM_ABBREV[item.platform] || item.platform.slice(0, 3).toUpperCase();

  // Info container
  const info = document.createElement('div');
  info.className = 'recent-item-info';

  // Title row (title + time)
  const titleRow = document.createElement('div');
  titleRow.className = 'recent-item-title-row';

  const title = document.createElement('span');
  title.className = 'recent-item-title';
  title.textContent = item.title || 'Untitled';

  const time = document.createElement('span');
  time.className = 'recent-item-time';
  time.textContent = formatTimeAgo(item.timestamp * 1000);

  titleRow.append(title, time);

  // Content preview
  const preview = document.createElement('div');
  preview.className = 'recent-item-preview';
  const previewText = item.content.replace(/\n/g, ' ').trim();
  preview.textContent = previewText.length > 60
    ? previewText.slice(0, 60) + '...'
    : previewText;

  info.append(titleRow, preview);

  // WIMS button (secondary action)
  const wimsBtn = document.createElement('button');
  wimsBtn.className = 'recent-item-wims-btn';
  wimsBtn.title = 'View in WIMS';
  wimsBtn.textContent = 'W';
  wimsBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const settings = await getSettings();
    chrome.tabs.create({ url: `${settings.serverUrl}/browse` });
  });

  el.append(badge, info, wimsBtn);
  return el;
}

/**
 * Handle quick search on Enter key
 */
function handleSearchKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    handleQuickSearch();
  }
}

/**
 * Open WIMS web UI with search query
 */
async function handleQuickSearch() {
  const query = searchInput.value.trim();
  if (!query) return;

  const settings = await getSettings();
  const url = `${settings.serverUrl}/?q=${encodeURIComponent(query)}`;
  chrome.tabs.create({ url });
}

/**
 * Handle "See all in WIMS" link click
 */
async function handleSeeAll(e: Event) {
  e.preventDefault();
  const settings = await getSettings();
  chrome.tabs.create({ url: `${settings.serverUrl}/browse` });
}

/**
 * Handle "Open WIMS" button click
 */
async function handleOpenWIMS() {
  const settings = await getSettings();
  chrome.tabs.create({ url: settings.serverUrl });
}

/**
 * Format timestamp as relative time
 */
function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ago`;
  } else if (hours > 0) {
    return `${hours}h ago`;
  } else if (minutes > 0) {
    return `${minutes}m ago`;
  } else {
    return `${seconds}s ago`;
  }
}

/**
 * Open options page
 */
function handleOpenOptions(e: Event) {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
}

// Cleanup on unload
window.addEventListener('beforeunload', () => {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
});

// Initialize
init().catch(err => {
  console.error('[WIMS Popup] Initialization error:', err);
});
