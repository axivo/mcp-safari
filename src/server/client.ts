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
  private active: boolean = false;
  private pageLoadTimeout: number;
  private windowHeight: number;
  private windowWidth: number;

  /**
   * Creates a new Client instance
   */
  constructor() {
    this.pageLoadTimeout = parseInt(process.env.SAFARI_PAGE_LOAD_TIMEOUT || '10000', 10);
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
      throw new Error('No active session. Use the open tool first.');
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
   * Navigates through browser history by the specified number of steps
   *
   * @param {number} steps - Number of steps (negative for back, positive for forward)
   * @returns {Promise<void>}
   */
  async goHistory(steps: number): Promise<void> {
    this.assertActive();
    await this.executeScript(`history.go(${steps})`);
    await this.waitForPageLoad();
  }

  /**
   * Clicks an element on the page by its visible text content
   *
   * @param {string} text - The visible text to search for (case-insensitive partial match)
   * @returns {Promise<string>} Description of the clicked element
   */
  async clickElement(text: string): Promise<string> {
    this.assertActive();
    const escaped = text.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const script = `(function() {
      var searchText = '${escaped}'.toLowerCase();
      var selectors = ['a', 'button', '[role="button"]', '[role="link"]', '[role="menuitem"]', '[role="tab"]', 'input[type="submit"]', 'input[type="button"]', '[onclick]', 'label', 'summary'];
      var best = null;
      var bestLen = Infinity;
      for (var i = 0; i < selectors.length; i++) {
        var elements = document.querySelectorAll(selectors[i]);
        for (var j = 0; j < elements.length; j++) {
          var el = elements[j];
          var elText = (el.textContent || el.value || el.getAttribute('aria-label') || '').trim().toLowerCase();
          if (elText.indexOf(searchText) !== -1 && elText.length < bestLen) {
            best = el;
            bestLen = elText.length;
          }
        }
      }
      if (!best) {
        var all = document.querySelectorAll('*');
        for (var k = 0; k < all.length; k++) {
          var el2 = all[k];
          var elText2 = (el2.textContent || '').trim().toLowerCase();
          if (elText2.indexOf(searchText) !== -1 && elText2.length < bestLen && el2.offsetParent !== null) {
            best = el2;
            bestLen = elText2.length;
          }
        }
      }
      if (!best) return 'No element found with text: ${escaped}';
      best.scrollIntoView({block: 'center'});
      best.click();
      return 'Clicked: ' + best.tagName.toLowerCase() + ' "' + (best.textContent || '').trim().substring(0, 80) + '"';
    })()`;
    const result = await this.executeScript(script);
    await new Promise((resolve) => setTimeout(resolve, 500));
    return result;
  }

  /**
   * Closes the Safari window and ends the session
   *
   * @returns {Promise<void>}
   */
  async closeSession(): Promise<void> {
    this.assertActive();
    await this.appleScript('tell application "Safari" to close window 1');
    this.active = false;
  }

  /**
   * Executes JavaScript in the current Safari tab
   *
   * @param {string} script - JavaScript code to execute
   * @returns {Promise<any>} Script execution result
   */
  async executeScript(script: string): Promise<any> {
    this.assertActive();
    const wrapped = script.includes('return ') ? `(function(){${script}})()` : script;
    const escaped = wrapped.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return await this.appleScript(`tell application "Safari" to do JavaScript "${escaped}" in current tab of window 1`);
  }

  /**
   * Gets the current page title
   *
   * @returns {Promise<string>} Page title
   */
  async getTitle(): Promise<string> {
    this.assertActive();
    return await this.appleScript('tell application "Safari" to return name of current tab of window 1');
  }

  /**
   * Gets the current page URL
   *
   * @returns {Promise<string>} Current URL
   */
  async getUrl(): Promise<string> {
    this.assertActive();
    return await this.appleScript('tell application "Safari" to return URL of current tab of window 1');
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
   * Gets page dimensions and calculates the number of viewport pages
   *
   * @returns {Promise<{scrollHeight: number, innerHeight: number, pages: number}>} Page dimension info
   */
  async getPageInfo(): Promise<{ scrollHeight: number; innerHeight: number; pages: number }> {
    this.assertActive();
    const result = await this.executeScript('JSON.stringify({scrollHeight:document.body.scrollHeight,innerHeight:window.innerHeight})');
    const { scrollHeight, innerHeight } = JSON.parse(result);
    return { scrollHeight, innerHeight, pages: Math.ceil(scrollHeight / innerHeight) };
  }

  /**
   * Navigates to a URL in the current Safari tab
   *
   * @param {string} url - URL to navigate to
   * @returns {Promise<void>}
   */
  async navigateTo(url: string): Promise<void> {
    this.assertActive();
    const escaped = url.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    await this.appleScript(`tell application "Safari" to set URL of current tab of window 1 to "${escaped}"`);
    await this.waitForPageLoad();
  }

  /**
   * Opens a new Safari window and starts the session
   *
   * @returns {Promise<void>}
   */
  async openSession(): Promise<void> {
    if (this.active) {
      throw new Error('A session is already active. Use the close tool first.');
    }
    await this.appleScript('tell application "Safari" to activate');
    await this.appleScript('tell application "Safari" to make new document');
    await this.appleScript(`tell application "Safari" to set bounds of window 1 to {0, 0, ${this.windowWidth}, ${this.windowHeight}}`);
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
   * Captures a screenshot of the Safari window at the specified page
   *
   * @param {number} page - Page number to capture (1-based)
   * @returns {Promise<string>} Base64-encoded PNG screenshot
   */
  async takeScreenshot(page: number = 1): Promise<string> {
    this.assertActive();
    if (page > 1) {
      const { innerHeight, pages } = await this.getPageInfo();
      const targetPage = Math.min(page, pages);
      const scrollY = (targetPage - 1) * innerHeight;
      await this.executeScript(`window.scrollTo(0, ${scrollY})`);
      await new Promise((resolve) => setTimeout(resolve, 300));
    } else {
      await this.executeScript('window.scrollTo(0, 0)');
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    const windowId = await this.jxa(`
      const app = Application("Safari");
      const windows = app.windows();
      if (windows.length === 0) throw new Error("No Safari window");
      windows[0].id();
    `);
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
   * @param {boolean} [submit=false] - Whether to press Enter after typing
   * @returns {Promise<string>} Description of the action taken
   */
  async typeText(text: string, selector?: string, submit: boolean = false): Promise<string> {
    this.assertActive();
    const escapedText = text.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const escapedSelector = selector ? selector.replace(/\\/g, '\\\\').replace(/'/g, "\\'") : '';
    const submitFlag = submit ? 'true' : 'false';
    const script = `(function() {
      var el;
      if ('${escapedSelector}') {
        el = document.querySelector('${escapedSelector}');
        if (!el) return 'No element found for selector: ${escapedSelector}';
      } else {
        el = document.activeElement;
        if (!el || el === document.body || (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA' && !el.isContentEditable)) {
          var inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]), textarea');
          el = null;
          for (var i = 0; i < inputs.length; i++) {
            if (inputs[i].offsetParent !== null) {
              el = inputs[i];
              break;
            }
          }
        }
      }
      if (!el) return 'No input element found';
      el.focus();
      el.scrollIntoView({block: 'center'});
      var nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value') || Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value');
      if (nativeSetter && nativeSetter.set) {
        nativeSetter.set.call(el, '${escapedText}');
      } else {
        el.value = '${escapedText}';
      }
      el.dispatchEvent(new Event('input', {bubbles: true}));
      el.dispatchEvent(new Event('change', {bubbles: true}));
      var desc = el.tagName.toLowerCase() + (el.name ? '[name=' + el.name + ']' : '') + (el.id ? '#' + el.id : '');
      if (${submitFlag}) {
        var enterOpts = {key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true};
        el.dispatchEvent(new KeyboardEvent('keydown', enterOpts));
        el.dispatchEvent(new KeyboardEvent('keypress', enterOpts));
        el.dispatchEvent(new KeyboardEvent('keyup', enterOpts));
        if (el.form) el.form.submit();
        return 'Typed and submitted in: ' + desc;
      }
      return 'Typed in: ' + desc;
    })()`;
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
