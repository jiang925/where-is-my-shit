import { getSettings, setSettings } from '../lib/storage';

interface StatusResponse {
  queueSize: number;
  serverOnline: boolean;
  lastCaptureTimestamp: number;
  authRequired: boolean;
}

// DOM elements
const captureToggle = document.getElementById('captureToggle') as HTMLInputElement;
const serverStatus = document.getElementById('serverStatus') as HTMLElement;
const serverStatusText = document.getElementById('serverStatusText') as HTMLElement;
const queueSection = document.getElementById('queueSection') as HTMLElement;
const queueCount = document.getElementById('queueCount') as HTMLElement;
const lastCapture = document.getElementById('lastCapture') as HTMLElement;
const openOptions = document.getElementById('openOptions') as HTMLAnchorElement;

const loginSection = document.getElementById('loginSection') as HTMLElement;
const mainContent = document.getElementById('mainContent') as HTMLElement;
const passwordInput = document.getElementById('passwordInput') as HTMLInputElement;
const loginButton = document.getElementById('loginButton') as HTMLButtonElement;
const loginError = document.getElementById('loginError') as HTMLElement;

// Auto-refresh interval
let refreshInterval: number | null = null;

/**
 * Initialize popup
 */
async function init() {
  // Load initial settings
  const settings = await getSettings();
  captureToggle.checked = settings.captureEnabled;

  // Check if we need login immediately (no token)
  if (!settings.authToken) {
    showLogin(true);
  } else {
    // Update status to check if token is valid or server is reachable
    await updateStatus();
  }

  // Start auto-refresh every 5 seconds
  refreshInterval = window.setInterval(() => {
    updateStatus();
  }, 5000);

  // Set up event listeners
  captureToggle.addEventListener('change', handleToggleChange);
  openOptions.addEventListener('click', handleOpenOptions);
  loginButton.addEventListener('click', handleLogin);
  passwordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleLogin();
  });
}

/**
 * Toggle login UI
 */
function showLogin(show: boolean) {
  if (show) {
    loginSection.style.display = 'flex';
    mainContent.style.display = 'none';
    // Focus password input if showing login
    setTimeout(() => passwordInput.focus(), 100);
  } else {
    loginSection.style.display = 'none';
    mainContent.style.display = 'block';
  }
}

/**
 * Handle login submission
 */
async function handleLogin() {
  const password = passwordInput.value;
  if (!password) return;

  loginButton.disabled = true;
  loginButton.textContent = 'Logging in...';
  loginError.style.display = 'none';

  try {
    const settings = await getSettings();
    const response = await fetch(`${settings.serverUrl}/api/v1/auth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ password })
    });

    if (response.ok) {
      const data = await response.json();
      await setSettings({ authToken: data.access_token });
      passwordInput.value = '';
      showLogin(false);
      await updateStatus();
    } else {
      const errorData = await response.json().catch(() => ({}));
      loginError.textContent = errorData.detail || 'Invalid password';
      loginError.style.display = 'block';
    }
  } catch (error) {
    console.error('[WIMS Popup] Login error:', error);
    loginError.textContent = 'Connection failed';
    loginError.style.display = 'block';
  } finally {
    loginButton.disabled = false;
    loginButton.textContent = 'Login';
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

    // Check if auth is required
    if (response.authRequired) {
      showLogin(true);
      return;
    }

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
