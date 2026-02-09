import { getSettings, setSettings } from '../lib/storage';
import { ApiClient } from '../lib/api';

// DOM elements
const serverUrlInput = document.getElementById('serverUrl') as HTMLInputElement;
const apiKeyInput = document.getElementById('apiKey') as HTMLInputElement;
const saveButton = document.getElementById('saveButton') as HTMLButtonElement;
const testButton = document.getElementById('testButton') as HTMLButtonElement;
const statusDiv = document.getElementById('status') as HTMLDivElement;

/**
 * Initialize options page
 */
async function init() {
  // Load current settings
  const settings = await getSettings();
  serverUrlInput.value = settings.serverUrl;
  apiKeyInput.value = settings.apiKey;

  // Set up event listeners
  saveButton.addEventListener('click', handleSave);
  testButton.addEventListener('click', handleTest);
}

/**
 * Validate URL format
 */
function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Show status message
 */
function showStatus(message: string, type: 'success' | 'error' | 'info') {
  statusDiv.textContent = message;
  statusDiv.className = type;

  // Auto-hide success messages after 3 seconds
  if (type === 'success') {
    setTimeout(() => {
      statusDiv.className = '';
      statusDiv.style.display = 'none';
    }, 3000);
  }
}

/**
 * Handle save button click
 */
async function handleSave() {
  const url = serverUrlInput.value.trim();
  const apiKey = apiKeyInput.value.trim();

  // Validate URL
  if (!url) {
    showStatus('Server URL is required', 'error');
    return;
  }

  if (!isValidUrl(url)) {
    showStatus('Invalid URL format. Must start with http:// or https://', 'error');
    return;
  }

  // Save settings
  try {
    await setSettings({ serverUrl: url, apiKey });
    showStatus('Settings saved successfully!', 'success');
  } catch (error) {
    console.error('[WIMS Options] Failed to save settings:', error);
    showStatus('Failed to save settings', 'error');
  }
}

/**
 * Handle test connection button click
 */
async function handleTest() {
  const url = serverUrlInput.value.trim();

  // Validate URL first
  if (!url) {
    showStatus('Server URL is required', 'error');
    return;
  }

  if (!isValidUrl(url)) {
    showStatus('Invalid URL format. Must start with http:// or https://', 'error');
    return;
  }

  // Disable buttons during test
  testButton.disabled = true;
  saveButton.disabled = true;
  showStatus('Testing connection...', 'info');

  try {
    const client = new ApiClient(url);
    const isHealthy = await client.checkHealth();

    if (isHealthy) {
      showStatus('Connection successful! Server is reachable.', 'success');
    } else {
      showStatus('Connection failed: Server returned an error', 'error');
    }
  } catch (error) {
    console.error('[WIMS Options] Connection test failed:', error);
    showStatus('Connection failed: ' + (error instanceof Error ? error.message : 'Unknown error'), 'error');
  } finally {
    // Re-enable buttons
    testButton.disabled = false;
    saveButton.disabled = false;
  }
}

// Initialize
init().catch(err => {
  console.error('[WIMS Options] Initialization error:', err);
});
