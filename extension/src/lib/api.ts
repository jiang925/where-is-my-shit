import { IngestPayload } from '../types/message';

export class ApiClient {
  private serverUrl: string;
  private readonly REQUEST_TIMEOUT_MS = 10000;

  constructor(serverUrl: string) {
    this.serverUrl = serverUrl;
  }

  /**
   * Send message to WIMS server
   * @returns true on success, throws on failure
   */
  async sendMessage(payload: IngestPayload): Promise<boolean> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${this.serverUrl}/api/v1/ingest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

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
