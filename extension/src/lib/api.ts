import { IngestPayload } from '../types/message';
import { getSettings } from './storage';

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

export class ApiClient {
  private serverUrl: string;
  private readonly REQUEST_TIMEOUT_MS = 10000;

  constructor(serverUrl: string) {
    this.serverUrl = serverUrl;
  }

  private async getHeaders(): Promise<HeadersInit> {
    const settings = await getSettings();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (settings.apiKey) {
      headers['X-API-Key'] = settings.apiKey;
    } else {
      throw new AuthError('API Key is missing. Please configure it in extension options.');
    }

    return headers;
  }

  /**
   * Send message to WIMS server
   * @returns true on success, throws on failure
   */
  async sendMessage(payload: IngestPayload): Promise<boolean> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT_MS);

    try {
      const headers = await this.getHeaders();
      const response = await fetch(`${this.serverUrl}/api/v1/ingest`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.status === 401 || response.status === 403) {
        throw new AuthError(`Authentication failed: ${response.status}`);
      }

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }

      return true;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout', { cause: error });
      }
      throw error;
    }
  }

  /**
   * Check server health
   * @returns true if server is reachable
   */
  async checkHealth(): Promise<boolean> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${this.serverUrl}/api/v1/health`, {
        method: 'GET',
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      clearTimeout(timeoutId);
      return false;
    }
  }
}
