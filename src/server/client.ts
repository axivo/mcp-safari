/**
 * SafariDriver WebDriver client
 *
 * @module server/client
 * @author AXIVO
 * @license BSD-3-Clause
 */

import { ChildProcess, spawn } from 'child_process';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

/**
 * SafariDriver WebDriver client
 *
 * Provides Safari browser automation through the W3C WebDriver protocol,
 * communicating directly with SafariDriver over HTTP.
 *
 * @class Client
 */
export class Client {
  private driver: ChildProcess | null = null;
  private port: number;
  private readonly BASE: string;

  /**
   * Creates a new Client instance
   *
   * @param {number} [port=9515] - Port for SafariDriver
   */
  constructor(port: number = 9515) {
    this.port = port;
    this.BASE = `http://localhost:${this.port}`;
  }

  /**
   * Starts the SafariDriver process
   *
   * @private
   * @returns {Promise<void>}
   */
  private async start(): Promise<void> {
    if (this.driver) {
      return;
    }
    this.driver = spawn('safaridriver', ['-p', String(this.port)], {
      stdio: 'ignore'
    });
    this.driver.on('error', (error) => {
      console.error('SafariDriver process error:', error.message);
    });
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  /**
   * Stops the SafariDriver process
   *
   * @private
   */
  private stop(): void {
    if (this.driver) {
      this.driver.kill();
      this.driver = null;
    }
  }

  /**
   * Creates a new WebDriver session
   *
   * @returns {Promise<string>} Session ID
   */
  async createSession(): Promise<string> {
    await this.start();
    const response = await fetch(`${this.BASE}/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        capabilities: {
          alwaysMatch: {
            browserName: 'safari'
          }
        }
      })
    });
    const data = await response.json();
    return data.value.sessionId;
  }

  /**
   * Terminates a WebDriver session
   *
   * @param {string} sessionId - Session to terminate
   * @returns {Promise<void>}
   */
  async deleteSession(sessionId: string): Promise<void> {
    await fetch(`${this.BASE}/session/${sessionId}`, {
      method: 'DELETE'
    });
  }

  /**
   * Executes JavaScript in the browser context
   *
   * @param {string} sessionId - Active session ID
   * @param {string} script - JavaScript code to execute
   * @returns {Promise<any>} Script execution result
   */
  async executeScript(sessionId: string, script: string): Promise<any> {
    const response = await fetch(`${this.BASE}/session/${sessionId}/execute/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ script, args: [] })
    });
    const data = await response.json();
    return data.value;
  }

  /**
   * Gets the current page title
   *
   * @param {string} sessionId - Active session ID
   * @returns {Promise<string>} Page title
   */
  async getTitle(sessionId: string): Promise<string> {
    const response = await fetch(`${this.BASE}/session/${sessionId}/title`);
    const data = await response.json();
    return data.value;
  }

  /**
   * Gets the current page URL
   *
   * @param {string} sessionId - Active session ID
   * @returns {Promise<string>} Current URL
   */
  async getUrl(sessionId: string): Promise<string> {
    const response = await fetch(`${this.BASE}/session/${sessionId}/url`);
    const data = await response.json();
    return data.value;
  }

  /**
   * Creates an image response for screenshot results
   *
   * @param {string} base64Png - Base64-encoded PNG data
   * @returns {Object} MCP image content response
   */
  imageResponse(base64Png: string): any {
    return {
      content: [
        {
          type: 'image',
          data: base64Png,
          mimeType: 'image/png'
        }
      ]
    };
  }

  /**
   * Navigates to a URL
   *
   * @param {string} sessionId - Active session ID
   * @param {string} url - URL to navigate to
   * @returns {Promise<void>}
   */
  async navigateTo(sessionId: string, url: string): Promise<void> {
    await fetch(`${this.BASE}/session/${sessionId}/url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
  }

  /**
   * Creates a standardized text response for tool execution
   *
   * @param {any} response - The response data
   * @param {boolean} stringify - Whether to JSON stringify the response
   * @returns {Object} Standardized MCP response format
   */
  response(response: any, stringify: boolean = false): any {
    const text = stringify ? JSON.stringify(response) : response;
    return { content: [{ type: 'text', text }] };
  }

  /**
   * Captures a screenshot of the visible page
   *
   * @param {string} sessionId - Active session ID
   * @returns {Promise<string>} Base64-encoded PNG screenshot
   */
  async takeScreenshot(sessionId: string): Promise<string> {
    const response = await fetch(`${this.BASE}/session/${sessionId}/screenshot`);
    const data = await response.json();
    return data.value;
  }

  /**
   * Gets package version
   *
   * @returns {string} Package version
   */
  version(): string {
    try {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      const packagePath = join(__dirname, '../../package.json');
      const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
      return packageJson.version;
    } catch (error) {
      return this.response(`Failed to read package.json version: ${error}`);
    }
  }
}
