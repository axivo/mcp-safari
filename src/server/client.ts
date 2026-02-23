/**
 * Safari AppleScript automation client
 *
 * @module server/client
 * @author AXIVO
 * @license BSD-3-Clause
 */

import { execFile } from 'child_process';
import { readFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { Automation } from '../lib/automation.js';
import { Browser } from '../lib/browser.js';

/**
 * Safari AppleScript automation client
 *
 * Provides Safari browser automation through AppleScript and JXA,
 * controlling the user's actual Safari session with full cookie
 * and authentication state.
 *
 * @class Client
 */
export class Client {
  private active: boolean;
  private automation: Automation;
  private browser: Browser;
  private pageLoadTimeout: number;
  private windowBounds: number;
  private windowHeight: number;
  private windowWidth: number;

  /**
   * Creates a new Client instance
   */
  constructor() {
    this.active = false;
    this.automation = new Automation();
    this.browser = new Browser();
    this.pageLoadTimeout = parseInt(process.env.SAFARI_PAGE_TIMEOUT || '10000', 10);
    this.windowBounds = parseInt(process.env.SAFARI_WINDOW_BOUNDS || '20', 10);
    this.windowHeight = parseInt(process.env.SAFARI_WINDOW_HEIGHT || '1024', 10);
    this.windowWidth = parseInt(process.env.SAFARI_WINDOW_WIDTH || '1280', 10);
  }

  /**
   * Executes an AppleScript string and returns the result
   *
   * @private
   * @param {string} script - AppleScript source code
   * @returns {Promise<string>} Script output
   */
  private async appleScript(script: string): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile('osascript', ['-e', script], { maxBuffer: 50 * 1024 * 1024 }, (error, stdout) => {
        if (error) {
          reject(new Error(error.message));
          return;
        }
        resolve(stdout.trim());
      });
    });
  }

  /**
   * Verifies an active session exists
   *
   * @private
   * @throws {Error} When no session is active
   */
  private assertActive(): void {
    if (!this.active) {
      throw new Error('No active session, use `open` tool first.');
    }
  }

  /**
   * Constructs a search URL using the user's configured default search engine
   *
   * @private
   * @param {string} query - Search query text
   * @returns {Promise<string>} Full search URL with encoded query
   */
  private async getSearchUrl(query: string): Promise<string> {
    const output = await new Promise<string>((resolve, reject) => {
      execFile('defaults', ['read', '-g', 'NSPreferredWebServices'], (error, stdout) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(stdout);
      });
    });
    const match = output.match(/NSProviderIdentifier\s*=\s*"([^"]+)"/);
    const domain = match![1].split('.').reverse().join('.');
    const url = new URL(`/search?q=${encodeURIComponent(query)}`, `https://${domain}`);
    return url.toString();
  }

  /**
   * Injects console error and warning capture into the current page
   *
   * Overrides console.error, console.warn, window.onerror, and
   * unhandledrejection to capture errors with source context.
   *
   * @private
   * @returns {Promise<void>}
   */
  private async injectErrorCapture(): Promise<void> {
    await this.executeScript(this.browser.errorCapture());
  }

  /**
   * Injects error capture early during page load to catch inline script errors
   *
   * Polls for the new document to appear (readyState changes to 'loading'),
   * then injects error capture overrides before inline scripts execute.
   * Best-effort — if the page parses faster than the polling interval,
   * the post-load injection in navigateTo/goHistory serves as fallback.
   *
   * @private
   * @returns {Promise<void>}
   */
  private async injectErrorCaptureEarly(): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < this.pageLoadTimeout) {
      try {
        const state = await this.executeScript('document.readyState');
        if (state === 'loading' || state === 'interactive') {
          await this.executeScript(this.browser.errorCapture());
          return;
        }
        if (state === 'complete') {
          return;
        }
      } catch { }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  /**
   * Executes a JXA (JavaScript for Automation) script and returns the result
   *
   * @private
   * @param {string} script - JXA source code
   * @returns {Promise<string>} Script output
   */
  private async jxa(script: string): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile('osascript', ['-l', 'JavaScript', '-e', script], { maxBuffer: 50 * 1024 * 1024 }, (error, stdout) => {
        if (error) {
          reject(new Error(error.message));
          return;
        }
        resolve(stdout.trim());
      });
    });
  }

  /**
   * Waits for the page to finish loading by polling document.readyState
   *
   * @private
   * @returns {Promise<void>}
   */
  private async waitForPageLoad(): Promise<void> {
    const start = Date.now();
    let state = '';
    while (state !== 'complete' && Date.now() - start < this.pageLoadTimeout) {
      state = await this.executeScript('document.readyState');
      if (state !== 'complete') {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
  }

  /**
   * Waits for an element matching a CSS selector to appear on the page
   *
   * @private
   * @param {string} selector - CSS selector to wait for
   * @returns {Promise<boolean>} Whether the element was found within pageLoadTimeout
   */
  private async waitForSelector(selector: string): Promise<boolean> {
    const escaped = selector.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const start = Date.now();
    while (Date.now() - start < this.pageLoadTimeout) {
      const found = await this.executeScript(`document.querySelector('${escaped}') !== null`);
      if (found === 'true') {
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return false;
  }

  /**
   * Clicks an element on the page by its visible text content or CSS selector
   *
   * @param {string} [selector] - CSS selector to scope the search
   * @param {string} [text] - The visible text to search for (case-insensitive partial match)
   * @param {string} [wait] - CSS selector to wait for after click
   * @param {number} [x] - X coordinate (pixels from left of viewport)
   * @param {number} [y] - Y coordinate (pixels from top of viewport)
   * @returns {Promise<{result: string, selectorFound?: boolean}>} Click result with optional wait status
   */
  async clickElement(selector?: string, text?: string, wait?: string, x?: number, y?: number): Promise<{ result: string; selectorFound?: boolean }> {
    this.assertActive();
    let script: string;
    if (text && selector) {
      script = this.browser.clickSelector(text, selector);
    } else if (text) {
      script = this.browser.clickElement(text);
    } else if (x !== undefined && y !== undefined) {
      script = this.browser.clickCoordinates(x, y);
    } else {
      script = this.browser.clickDirect(selector!);
    }
    const result = await this.executeScript(script);
    await new Promise((resolve) => setTimeout(resolve, 500));
    if (wait) {
      const selectorFound = await this.waitForSelector(wait);
      return { result, selectorFound };
    }
    return { result };
  }

  /**
   * Closes the Safari window and ends the session
   *
   * @returns {Promise<void>}
   */
  async closeSession(): Promise<void> {
    this.assertActive();
    await this.appleScript(this.automation.closeWindow());
    this.active = false;
  }

  /**
   * Closes a specific tab by index without closing the window
   *
   * @param {number} index - Tab index (1-based)
   * @returns {Promise<void>}
   */
  async closeTab(index: number): Promise<void> {
    this.assertActive();
    await this.appleScript(this.automation.closeTab(index));
  }

  /**
   * Executes JavaScript in the current Safari tab
   *
   * @param {string} script - JavaScript code to execute
   * @returns {Promise<any>} Script execution result
   */
  async executeScript(script: string): Promise<any> {
    this.assertActive();
    const trimmed = script.trimStart();
    const hasReturn = script.includes('return ');
    const hasFunction = trimmed.startsWith('(function') || trimmed.startsWith('(() =>') || trimmed.startsWith('(()=>');
    const wrapped = hasReturn && !hasFunction ? `(function(){${script}})()` : script;
    return await this.appleScript(this.automation.executeScript(wrapped));
  }

  /**
   * Gets captured console errors and warnings from the current page
   *
   * @returns {Promise<{errors: string[], warnings: string[]}>} Captured errors and warnings
   */
  async getConsoleErrors(): Promise<{ errors: string[]; warnings: string[] }> {
    this.assertActive();
    const result = await this.executeScript(this.browser.consoleErrors());
    try {
      return JSON.parse(result);
    } catch {
      return { errors: [], warnings: [] };
    }
  }

  /**
   * Gets page dimensions and calculates the number of viewport pages
   *
   * @returns {Promise<{innerHeight: number, scrollHeight: number, scrollOffset: number, pages: number}>} Page dimension info
   */
  async getPageInfo(): Promise<{ innerHeight: number; scrollHeight: number; scrollOffset: number; pages: number }> {
    this.assertActive();
    const result = await this.executeScript(this.browser.pageInfo());
    const { innerHeight, scrollHeight, scrollOffset } = JSON.parse(result);
    return { innerHeight, scrollHeight, scrollOffset, pages: Math.ceil(scrollHeight / innerHeight) };
  }

  /**
   * Gets the current page title
   *
   * @returns {Promise<string>} Page title
   */
  async getTitle(): Promise<string> {
    this.assertActive();
    return await this.appleScript(this.automation.getTitle());
  }

  /**
   * Gets the current page URL
   *
   * @returns {Promise<string>} Current URL
   */
  async getUrl(): Promise<string> {
    this.assertActive();
    return await this.appleScript(this.automation.getUrl());
  }

  /**
   * Navigates through browser history by the specified number of steps
   *
   * @param {number} steps - Number of steps (negative for back, positive for forward)
   * @param {string} [selector] - CSS selector to wait for after page load
   * @returns {Promise<boolean>} Whether the selector was found (true if no selector specified)
   */
  async goHistory(steps: number, selector?: string): Promise<boolean> {
    this.assertActive();
    await this.executeScript(`history.go(${steps})`);
    await this.injectErrorCaptureEarly();
    await this.waitForPageLoad();
    await this.injectErrorCapture();
    if (selector) {
      return await this.waitForSelector(selector);
    }
    return true;
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
   * Dispatches a keyboard event on the page
   *
   * @param {string} key - Key name (e.g., 'Escape', 'ArrowRight', 'Enter')
   * @param {string} [selector] - CSS selector for target element
   * @returns {Promise<string>} Description of the action taken
   */
  async keypress(key: string, selector?: string): Promise<string> {
    this.assertActive();
    const script = this.browser.keypress(key, selector);
    const result = await this.executeScript(script);
    await new Promise((resolve) => setTimeout(resolve, 300));
    return result;
  }

  /**
   * Lists all open tabs in the current window
   *
   * @returns {Promise<{index: number, title: string, url: string, active: boolean}[]>} Array of tab info
   */
  async listTabs(): Promise<{ active: boolean; index: number; title: string; url: string }[]> {
    this.assertActive();
    const result = await this.appleScript(this.automation.listTabs());
    try {
      return JSON.parse(result);
    } catch {
      return [];
    }
  }

  /**
   * Navigates to a URL in the current Safari tab
   *
   * @param {string} url - URL to navigate to
   * @param {string} [selector] - CSS selector to wait for after page load
   * @returns {Promise<boolean>} Whether the selector was found (true if no selector specified)
   */
  async navigateTo(url: string, selector?: string): Promise<boolean> {
    this.assertActive();
    await this.appleScript(this.automation.navigateTo(url));
    await this.injectErrorCaptureEarly();
    await this.waitForPageLoad();
    await this.injectErrorCapture();
    if (selector) {
      return await this.waitForSelector(selector);
    }
    return true;
  }

  /**
   * Opens a new tab in the current window, optionally navigating to a URL
   *
   * @param {string} [url] - URL to open in the new tab
   * @returns {Promise<void>}
   */
  async openTab(url?: string): Promise<void> {
    this.assertActive();
    await this.appleScript(this.automation.createTab(url));
    if (url) {
      await this.injectErrorCaptureEarly();
      await this.waitForPageLoad();
      await this.injectErrorCapture();
    }
  }

  /**
   * Opens a new Safari window and starts the session
   *
   * @returns {Promise<void>}
   */
  async openSession(): Promise<void> {
    if (this.active) {
      throw new Error('A session is already active, use `close` tool first.');
    }
    await this.appleScript(this.automation.activate());
    await this.appleScript(this.automation.createDocument());
    const x = this.windowBounds;
    const y = this.windowBounds + 30;
    await this.appleScript(this.automation.setBounds(x, y, this.windowWidth, this.windowHeight));
    this.active = true;
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
   * Searches the web using the user's default search engine
   *
   * @param {string} query - Search query text
   * @param {string} [selector] - CSS selector to wait for after page load
   * @returns {Promise<boolean>} Whether the selector was found (true if no selector specified)
   */
  async search(query: string, selector?: string): Promise<boolean> {
    const url = await this.getSearchUrl(query);
    return await this.navigateTo(url, selector);
  }

  /**
   * Scrolls the page by a pixel amount in the specified direction
   *
   * @param {string} direction - Scroll direction ('up' or 'down')
   * @param {number} pixels - Number of pixels to scroll
   * @returns {Promise<void>}
   */
  async scrollByPixels(direction: 'up' | 'down', pixels: number): Promise<void> {
    this.assertActive();
    const delta = direction === 'up' ? -pixels : pixels;
    await this.executeScript(`window.scrollBy(0, ${delta})`);
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  /**
   * Scrolls the page to the specified viewport page number
   *
   * @param {number} page - Page number to scroll to (1-based)
   * @returns {Promise<void>}
   */
  async scrollToPage(page: number = 1): Promise<void> {
    this.assertActive();
    if (page > 1) {
      const { innerHeight, pages } = await this.getPageInfo();
      const targetPage = Math.min(page, pages);
      const scrollY = (targetPage - 1) * innerHeight;
      await this.executeScript(`window.scrollTo(0, ${scrollY})`);
    } else {
      await this.executeScript('window.scrollTo(0, 0)');
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  /**
   * Switches to a specific tab by index
   *
   * @param {number} index - Tab index (1-based)
   * @returns {Promise<void>}
   */
  async switchTab(index: number): Promise<void> {
    this.assertActive();
    await this.appleScript(this.automation.switchTab(index));
  }

  /**
   * Captures a screenshot of the current Safari viewport
   *
   * @returns {Promise<string>} Base64-encoded PNG screenshot
   */
  async takeScreenshot(): Promise<string> {
    this.assertActive();
    const windowId = await this.jxa(this.automation.windowId());
    const tmpFile = join(tmpdir(), `safari-screenshot-${Date.now()}.png`);
    await new Promise<void>((resolve, reject) => {
      execFile('screencapture', ['-l', windowId, '-o', '-x', tmpFile], (error) => {
        if (error) {
          reject(new Error(error.message));
          return;
        }
        resolve();
      });
    });
    const buffer = readFileSync(tmpFile);
    unlinkSync(tmpFile);
    return buffer.toString('base64');
  }

  /**
   * Types text into an input element on the page
   *
   * @param {string} text - The text to type
   * @param {string} [selector] - CSS selector for the target input
   * @param {boolean} [append=false] - Whether to append to existing value
   * @param {boolean} [submit=false] - Whether to press Enter after typing
   * @returns {Promise<string>} Description of the action taken
   */
  async typeText(text: string, selector?: string, append: boolean = false, submit: boolean = false): Promise<string> {
    this.assertActive();
    const script = this.browser.typeText(text, selector, append, submit);
    const result = await this.executeScript(script);
    if (submit) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    return result;
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
