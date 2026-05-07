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
 * Tab target - a (windowId, tabIndex) pair identifying a specific Safari tab
 */
type TabTarget = { windowId: number; index: number };

/**
 * Error message thrown by observe operations when Safari has no windows open
 */
const NO_WINDOW_ERROR = 'No Safari window is open. Use an act operation (navigate, open) first or open a window in Safari.';

/**
 * Safari AppleScript automation client
 *
 * Provides Safari browser automation through AppleScript and JXA,
 * controlling the user's actual Safari session with full cookie
 * and authentication state.
 *
 * Drive operations (navigate, click, type, scroll, refresh, execute)
 * target a working tab the client maintains - created on first navigate
 * or first openTab. Look operations (read, screenshot, listTabs,
 * getConsoleErrors, getTitle, getUrl) target the front window's current
 * tab, so the user can point Safari at content and ask for inspection
 * without ceremony.
 *
 * @class Client
 */
export class Client {
  private automation: Automation;
  private browser: Browser;
  private pageLoadTimeout: number;
  private windowBounds: number;
  private windowHeight: number;
  private windowWidth: number;
  private workingTab: TabTarget | null;

  /**
   * Creates a new Client instance
   */
  constructor() {
    this.automation = new Automation();
    this.browser = new Browser();
    this.pageLoadTimeout = parseInt(process.env.SAFARI_PAGE_TIMEOUT || '10000', 10);
    this.windowBounds = parseInt(process.env.SAFARI_WINDOW_BOUNDS || '20', 10);
    this.windowHeight = parseInt(process.env.SAFARI_WINDOW_HEIGHT || '1024', 10);
    this.windowWidth = parseInt(process.env.SAFARI_WINDOW_WIDTH || '1280', 10);
    this.workingTab = null;
  }

  /**
   * Executes an AppleScript string and returns the result
   *
   * @private
   * @param {string} script - AppleScript source code
   * @returns {Promise<string>} Script output
   */
  private async appleScript(script: string): Promise<string> {
    return this.runExec('osascript', ['-e', script]);
  }

  /**
   * Constructs a search URL using the user's configured default search engine
   *
   * @private
   * @param {string} query - Search query text
   * @returns {Promise<string>} Full search URL with encoded query
   */
  private async getSearchUrl(query: string): Promise<string> {
    const output = await this.runExec('defaults', ['read', '-g', 'NSPreferredWebServices'], false);
    const match = output.match(/NSProviderIdentifier\s*=\s*"([^"]+)"/);
    if (!match || !match[1]) {
      throw new Error('Could not determine default search engine from NSPreferredWebServices');
    }
    const domain = match[1].split('.').reverse().join('.');
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
   * @param {TabTarget} target - Tab to inject into
   * @returns {Promise<void>}
   */
  private async injectErrorCapture(target: TabTarget): Promise<void> {
    await this.executeScript(target, this.browser.errorCapture());
  }

  /**
   * Injects error capture early during page load to catch inline script errors
   *
   * @private
   * @param {TabTarget} target - Tab to inject into
   * @returns {Promise<void>}
   */
  private async injectErrorCaptureEarly(target: TabTarget): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < this.pageLoadTimeout) {
      try {
        const state = await this.executeScript(target, 'document.readyState');
        if (state === 'loading' || state === 'interactive') {
          await this.executeScript(target, this.browser.errorCapture());
          return;
        }
        if (state === 'complete') {
          return;
        }
      } catch {
        // Page not yet ready for script injection; retry next iteration.
      }
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
    return this.runExec('osascript', ['-l', 'JavaScript', '-e', script]);
  }

  /**
   * Resolves the target for an observe operation
   *
   * Called by read-only operations (read, screenshot, listTabs, getConsoleErrors,
   * getTitle, getUrl). When `index` is omitted, targets the front window's current
   * tab (the user's focus). When `index` is provided, targets that tab in the front
   * window without changing focus. Does not create windows or tabs. Throws if Safari
   * has no windows open.
   *
   * @private
   * @param {number} [index] - Optional tab index in the front window
   * @returns {Promise<TabTarget>} The resolved tab target
   */
  private async resolveTarget(index?: number): Promise<TabTarget> {
    if (index !== undefined) {
      const frontId = await this.appleScript(this.automation.frontWindowId());
      if (!frontId) {
        throw new Error(NO_WINDOW_ERROR);
      }
      return { windowId: parseInt(frontId, 10), index };
    }
    const result = await this.appleScript(this.automation.frontWindowAndTab());
    if (!result) {
      throw new Error(NO_WINDOW_ERROR);
    }
    const [windowId, currentIndex] = result.split(',').map((n) => parseInt(n, 10));
    return { windowId, index: currentIndex };
  }

  /**
   * Executes a child process and returns trimmed stdout
   *
   * Wraps the callback-based `execFile` in a promise with a 50MB buffer.
   * Used as the foundation for `appleScript`, `jxa`, and any other shell
   * invocation. Trimming the output is opt-in via the `trim` flag.
   *
   * @private
   * @param {string} cmd - Command to execute
   * @param {string[]} args - Command arguments
   * @param {boolean} [trim=true] - Whether to trim trailing whitespace from stdout
   * @returns {Promise<string>} Process stdout
   */
  private async runExec(cmd: string, args: string[], trim: boolean = true): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile(cmd, args, { maxBuffer: 50 * 1024 * 1024 }, (error, stdout) => {
        if (error) {
          reject(new Error(error.message));
          return;
        }
        resolve(trim ? stdout.trim() : stdout);
      });
    });
  }

  /**
   * Waits for a page to finish loading by polling document.readyState and document.title
   *
   * Two phases. First waits for readyState to reach 'complete'. Then waits for
   * document.title to be non-empty and stable across two consecutive reads.
   * The title phase covers SPAs that reach readyState=complete before their
   * router has rendered and set the document title.
   *
   * @private
   * @param {TabTarget} target - Tab to poll
   * @returns {Promise<void>}
   */
  private async waitForPageLoad(target: TabTarget): Promise<void> {
    const start = Date.now();
    let state = '';
    while (state !== 'complete' && Date.now() - start < this.pageLoadTimeout) {
      state = await this.executeScript(target, 'document.readyState');
      if (state !== 'complete') {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
    let lastTitle = '';
    while (Date.now() - start < this.pageLoadTimeout) {
      const title = await this.executeScript(target, 'document.title');
      if (title !== '' && title === lastTitle) {
        return;
      }
      lastTitle = title;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  /**
   * Waits for an element matching a CSS selector to appear on the page
   *
   * @private
   * @param {TabTarget} target - Tab to poll
   * @param {string} selector - CSS selector to wait for
   * @returns {Promise<boolean>} Whether the element was found within pageLoadTimeout
   */
  private async waitForSelector(target: TabTarget, selector: string): Promise<boolean> {
    const escaped = this.escapeForJs(selector);
    const start = Date.now();
    while (Date.now() - start < this.pageLoadTimeout) {
      const found = await this.executeScript(target, `document.querySelector('${escaped}') !== null`);
      if (found === 'true') {
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return false;
  }

  /**
   * Clicks an element on the working tab by visible text or CSS selector
   *
   * @param {string} [selector] - CSS selector to scope the search
   * @param {string} [text] - The visible text to search for (case-insensitive partial match)
   * @param {string} [wait] - CSS selector to wait for after click
   * @param {number} [x] - X coordinate (pixels from left of viewport)
   * @param {number} [y] - Y coordinate (pixels from top of viewport)
   * @returns {Promise<{result: string, selectorFound?: boolean}>} Click result with optional wait status
   */
  async clickElement(selector?: string, text?: string, wait?: string, x?: number, y?: number): Promise<{ result: string; selectorFound?: boolean }> {
    const target = await this.getCurrentTab();
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
    const result = await this.executeScript(target, script);
    await new Promise((resolve) => setTimeout(resolve, 500));
    if (wait) {
      const selectorFound = await this.waitForSelector(target, wait);
      return { result, selectorFound };
    }
    return { result };
  }

  /**
   * Closes a tab by index in the front window
   *
   * @param {number} index - Tab index (1-based)
   * @returns {Promise<void>}
   */
  async closeTab(index: number): Promise<void> {
    const target = await this.resolveTarget();
    await this.appleScript(this.automation.closeTab(target.windowId, index));
    if (this.workingTab && this.workingTab.windowId === target.windowId && this.workingTab.index === index) {
      this.workingTab = null;
    }
  }

  /**
   * Closes the working tab if any, dropping the working tab reference
   *
   * @returns {Promise<void>}
   */
  async closeWorkingTab(): Promise<void> {
    if (!this.workingTab) {
      return;
    }
    try {
      await this.appleScript(this.automation.closeTab(this.workingTab.windowId, this.workingTab.index));
    } catch {
      // Tab may already be closed by the user; drop the reference unconditionally below.
    }
    this.workingTab = null;
  }

  /**
   * Escapes a string for safe interpolation into a JavaScript script literal
   *
   * Escapes backslashes and single quotes so the value can be wrapped in
   * single quotes without breaking out of the string context.
   *
   * @param {string} value - String to escape
   * @returns {string} Escaped string safe for single-quoted JavaScript literal
   */
  escapeForJs(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  }

  /**
   * Executes JavaScript in a specific tab
   *
   * @param {TabTarget} target - Tab to execute in
   * @param {string} script - JavaScript to execute
   * @returns {Promise<string>} Script result
   */
  async executeScript(target: TabTarget, script: string): Promise<string> {
    const trimmed = script.trimStart();
    const hasReturn = script.includes('return ');
    const hasFunction = trimmed.startsWith('(function') || trimmed.startsWith('(() =>') || trimmed.startsWith('(()=>');
    const wrapped = hasReturn && !hasFunction ? `(function(){${script}})()` : script;
    return await this.appleScript(this.automation.executeScript(target.windowId, target.index, wrapped));
  }

  /**
   * Gets captured console errors and warnings from a tab in the front window
   *
   * @param {number} [index] - Optional tab index; defaults to current tab
   * @returns {Promise<{errors: string[], warnings: string[]}>} Captured errors and warnings
   */
  async getConsoleErrors(index?: number): Promise<{ errors: string[]; warnings: string[] }> {
    const target = await this.resolveTarget(index);
    const result = await this.executeScript(target, this.browser.consoleErrors());
    try {
      return JSON.parse(result);
    } catch {
      return { errors: [], warnings: [] };
    }
  }

  /**
   * Returns the working tab, creating it if absent or if the prior one was closed
   *
   * Called by every act operation (navigate, click, type, scroll, refresh, execute).
   * Activates Safari, ensures a window exists, opens a new tab if no working tab is
   * remembered or the remembered one is gone, and returns the (windowId, index) pair.
   * After ensuring the tab, the tab is set as the current tab of its window so the
   * user sees what is being acted on.
   *
   * @returns {Promise<TabTarget>} The active working tab
   */
  async getCurrentTab(): Promise<TabTarget> {
    if (this.workingTab) {
      const exists = await this.appleScript(this.automation.tabExists(this.workingTab.windowId, this.workingTab.index));
      if (exists !== 'true') {
        this.workingTab = null;
      }
    }
    if (!this.workingTab) {
      await this.openTab();
    }
    if (!this.workingTab) {
      throw new Error('Failed to establish a working tab');
    }
    await this.appleScript(this.automation.setCurrentTab(this.workingTab.windowId, this.workingTab.index));
    return this.workingTab;
  }

  /**
   * Gets page dimensions and calculates the number of viewport pages
   *
   * @param {number} [index] - Optional tab index; defaults to current tab
   * @returns {Promise<{innerHeight: number, scrollHeight: number, scrollOffset: number, pages: number}>} Page dimension info
   */
  async getPageInfo(index?: number): Promise<{ innerHeight: number; scrollHeight: number; scrollOffset: number; pages: number }> {
    const target = await this.resolveTarget(index);
    const result = await this.executeScript(target, this.browser.pageInfo());
    const { innerHeight, scrollHeight, scrollOffset } = JSON.parse(result);
    return { innerHeight, scrollHeight, scrollOffset, pages: Math.ceil(scrollHeight / innerHeight) };
  }

  /**
   * Gets the title of a tab in the front window
   *
   * @param {number} [index] - Optional tab index; defaults to current tab
   * @returns {Promise<string>} Tab title
   */
  async getTitle(index?: number): Promise<string> {
    const target = await this.resolveTarget(index);
    return await this.appleScript(this.automation.getTitle(target.windowId, target.index));
  }

  /**
   * Gets the URL of a tab in the front window
   *
   * @param {number} [index] - Optional tab index; defaults to current tab
   * @returns {Promise<string>} Tab URL
   */
  async getUrl(index?: number): Promise<string> {
    const target = await this.resolveTarget(index);
    return await this.appleScript(this.automation.getUrl(target.windowId, target.index));
  }

  /**
   * Gets package version
   *
   * @returns {string} Package version
   */
  getVersion(): string {
    try {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      const packagePath = join(__dirname, '../../package.json');
      const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
      return packageJson.version;
    } catch (error) {
      throw new Error(`Failed to read package.json version: ${error}`);
    }
  }
  /**
   * Navigates the working tab through browser history
   *
   * @param {number} steps - Number of steps (negative for back, positive for forward)
   * @param {string} [selector] - CSS selector to wait for after page load
   * @returns {Promise<boolean>} Whether the selector was found (true if no selector specified)
   */
  async goHistory(steps: number, selector?: string): Promise<boolean> {
    const target = await this.getCurrentTab();
    await this.executeScript(target, `history.go(${steps})`);
    await this.injectErrorCaptureEarly(target);
    await this.waitForPageLoad(target);
    await this.injectErrorCapture(target);
    if (selector) {
      return await this.waitForSelector(target, selector);
    }
    return true;
  }

  /**
   * Hovers over an element on the working tab
   *
   * @param {string} [selector] - CSS selector for the target element
   * @param {string} [text] - Visible text to match
   * @returns {Promise<string>} Description of the action taken
   */
  async hover(selector?: string, text?: string): Promise<string> {
    const target = await this.getCurrentTab();
    const script = this.browser.hover(selector, text);
    const result = await this.executeScript(target, script);
    await new Promise((resolve) => setTimeout(resolve, 300));
    return result;
  }

  /**
   * Inspects the first element matching a CSS selector
   *
   * @param {string} selector - CSS selector for the target element
   * @param {number} [index] - Optional tab index; defaults to current tab
   * @returns {Promise<object>} Element descriptor including tag, text, visibility, attributes, rect
   */
  async inspect(selector: string, index?: number): Promise<Record<string, unknown>> {
    const target = await this.resolveTarget(index);
    const result = await this.executeScript(target, this.browser.inspect(selector));
    try {
      return JSON.parse(result);
    } catch {
      return { found: false };
    }
  }

  /**
   * Dispatches a keyboard event on the working tab
   *
   * @param {string} key - Key name (e.g., 'Escape', 'ArrowRight', 'Enter')
   * @param {string} [selector] - CSS selector for target element
   * @returns {Promise<string>} Description of the action taken
   */
  async keypress(key: string, selector?: string): Promise<string> {
    const target = await this.getCurrentTab();
    const script = this.browser.keypress(key, selector);
    const result = await this.executeScript(target, script);
    await new Promise((resolve) => setTimeout(resolve, 300));
    return result;
  }

  /**
   * Lists all tabs in the front window if any window is open, otherwise an empty array
   *
   * Non-throwing variant of listTabs for environment introspection. Returns
   * an empty array when Safari has no windows open instead of throwing.
   *
   * @returns {Promise<{index: number, title: string, url: string, active: boolean}[]>} Array of tab info or empty array
   */
  async listFrontTabs(): Promise<{ active: boolean; index: number; title: string; url: string }[]> {
    const frontId = await this.appleScript(this.automation.frontWindowId());
    if (!frontId) {
      return [];
    }
    const result = await this.appleScript(this.automation.listTabs(parseInt(frontId, 10)));
    try {
      return JSON.parse(result);
    } catch {
      return [];
    }
  }

  /**
   * Lists all tabs in the front window
   *
   * @returns {Promise<{index: number, title: string, url: string, active: boolean}[]>} Array of tab info
   */
  async listTabs(): Promise<{ active: boolean; index: number; title: string; url: string }[]> {
    const target = await this.resolveTarget();
    const result = await this.appleScript(this.automation.listTabs(target.windowId));
    try {
      return JSON.parse(result);
    } catch {
      return [];
    }
  }

  /**
   * Navigates the working tab to a URL
   *
   * @param {string} url - URL to navigate to
   * @param {string} [selector] - CSS selector to wait for after page load
   * @returns {Promise<boolean>} Whether the selector was found (true if no selector specified)
   */
  async navigateTo(url: string, selector?: string): Promise<boolean> {
    const target = await this.getCurrentTab();
    await this.appleScript(this.automation.setTabUrl(target.windowId, target.index, url));
    await this.injectErrorCaptureEarly(target);
    await this.waitForPageLoad(target);
    await this.injectErrorCapture(target);
    if (selector) {
      return await this.waitForSelector(target, selector);
    }
    return true;
  }

  /**
   * Opens a new tab as the working target
   *
   * If no Safari window is open, creates a window and adopts its first
   * tab as the working tab. If a window is already open, adds a new tab
   * to the front window.
   *
   * @param {string} [url] - URL to open in the new tab
   * @returns {Promise<void>}
   */
  async openTab(url?: string): Promise<void> {
    const frontId = await this.appleScript(this.automation.frontWindowId());
    if (frontId === '') {
      const windowId = parseInt(await this.appleScript(this.automation.ensureWindow()), 10);
      this.workingTab = { windowId, index: 1 };
      if (url) {
        await this.appleScript(this.automation.setTabUrl(windowId, 1, url));
      }
    } else {
      const windowId = parseInt(frontId, 10);
      const tabIndex = parseInt(await this.appleScript(this.automation.createTab(windowId, url)), 10);
      this.workingTab = { windowId, index: tabIndex };
    }
    if (url) {
      await this.injectErrorCaptureEarly(this.workingTab);
      await this.waitForPageLoad(this.workingTab);
      await this.injectErrorCapture(this.workingTab);
    }
  }

  /**
   * Extracts anchor links from a tab in the front window
   *
   * @param {string} [selector] - Optional CSS selector to scope extraction
   * @param {number} [index] - Optional tab index; defaults to current tab
   * @returns {Promise<{text: string, href: string}[]>} Array of link descriptors
   */
  async readLinks(selector?: string, index?: number): Promise<{ text: string; href: string }[]> {
    const target = await this.resolveTarget(index);
    const result = await this.executeScript(target, this.browser.links(selector));
    try {
      return JSON.parse(result);
    } catch {
      return [];
    }
  }

  /**
   * Reads JavaScript expression result from a tab in the front window without creating tabs
   *
   * Used by observe-mode operations like `read`. Distinct from `executeScript`,
   * which uses act-mode semantics and creates a working tab if needed.
   *
   * @param {string} script - JavaScript expression to evaluate
   * @param {number} [index] - Optional tab index; defaults to current tab
   * @returns {Promise<string>} Script result
   */
  async readScript(script: string, index?: number): Promise<string> {
    const target = await this.resolveTarget(index);
    return await this.executeScript(target, script);
  }

  /**
   * Refreshes the working tab, optionally bypassing the browser cache
   *
   * @param {boolean} [hard=false] - Whether to bypass browser cache
   * @param {string} [selector] - CSS selector to wait for after reload
   * @returns {Promise<boolean>} Whether the selector was found (true if no selector specified)
   */
  async refresh(hard: boolean = false, selector?: string): Promise<boolean> {
    const target = await this.getCurrentTab();
    await this.executeScript(target, `location.reload(${hard ? 'true' : ''})`);
    await this.injectErrorCaptureEarly(target);
    await this.waitForPageLoad(target);
    await this.injectErrorCapture(target);
    if (selector) {
      return await this.waitForSelector(target, selector);
    }
    return true;
  }

  /**
   * Creates a standardized text response for tool execution
   *
   * @param {any} data - The payload to wrap in the MCP response envelope
   * @param {boolean} stringify - Whether to JSON stringify the payload
   * @returns {object} Standardized MCP response format
   */
  response(data: unknown, stringify: boolean = false): { content: { type: 'text'; text: string }[] } {
    const text = stringify ? JSON.stringify(data) : (data as string);
    return { content: [{ type: 'text', text }] };
  }

  /**
   * Scrolls the front window's current tab by a pixel amount
   *
   * @param {string} direction - Scroll direction ('up' or 'down')
   * @param {number} pixels - Number of pixels to scroll
   * @returns {Promise<void>}
   */
  async scrollByPixels(direction: 'up' | 'down', pixels: number): Promise<void> {
    const target = await this.resolveTarget();
    const delta = direction === 'up' ? -pixels : pixels;
    await this.executeScript(target, `window.scrollBy(0, ${delta})`);
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  /**
   * Scrolls the front window's current tab to a viewport-page index
   *
   * @param {number} page - Page number to scroll to (1-based)
   * @returns {Promise<void>}
   */
  async scrollToPage(page: number = 1): Promise<void> {
    const target = await this.resolveTarget();
    if (page > 1) {
      const result = await this.executeScript(target, this.browser.pageInfo());
      const { innerHeight, scrollHeight } = JSON.parse(result);
      const pages = Math.ceil(scrollHeight / innerHeight);
      const targetPage = Math.min(page, pages);
      const scrollY = (targetPage - 1) * innerHeight;
      await this.executeScript(target, `window.scrollTo(0, ${scrollY})`);
    } else {
      await this.executeScript(target, 'window.scrollTo(0, 0)');
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
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
   * Selects an option in a <select> element on the working tab
   *
   * @param {string} selector - CSS selector for the target <select>
   * @param {string} [value] - Option value attribute to match
   * @param {string} [text] - Option visible text (case-insensitive partial match)
   * @returns {Promise<string>} Description of the action taken
   */
  async selectOption(selector: string, value?: string, text?: string): Promise<string> {
    const target = await this.getCurrentTab();
    const script = this.browser.selectOption(selector, value, text);
    return await this.executeScript(target, script);
  }

  /**
   * Switches the front window to a specific tab
   *
   * Focus shift only. Does not change the working tab; subsequent act
   * operations still target the previously captured working tab.
   *
   * @param {number} index - Tab index (1-based)
   * @returns {Promise<void>}
   */
  async switchTab(index: number): Promise<void> {
    const target = await this.resolveTarget();
    await this.appleScript(this.automation.setCurrentTab(target.windowId, index));
  }

  /**
   * Captures a screenshot of the front window's current tab
   *
   * @returns {Promise<string>} Base64-encoded PNG screenshot
   */
  async takeScreenshot(): Promise<string> {
    const target = await this.resolveTarget();
    const tmpFile = join(tmpdir(), `safari-screenshot-${Date.now()}.png`);
    await new Promise<void>((resolve, reject) => {
      execFile('screencapture', ['-l', String(target.windowId), '-o', '-x', tmpFile], (error) => {
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
   * Types text into an input element on the working tab
   *
   * @param {string} text - The text to type
   * @param {string} [selector] - CSS selector for the target input
   * @param {boolean} [append=false] - Whether to append to existing value
   * @param {boolean} [submit=false] - Whether to press Enter after typing
   * @returns {Promise<string>} Description of the action taken
   */
  async typeText(text: string, selector?: string, append: boolean = false, submit: boolean = false): Promise<string> {
    const target = await this.getCurrentTab();
    const script = this.browser.typeText(text, selector, append, submit);
    const result = await this.executeScript(target, script);
    if (submit) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    return result;
  }

  /**
   * Waits for a condition on the working tab
   *
   * Supported conditions:
   * - `selector`: wait for an element matching the selector to be present
   * - `selectorGone`: wait for no element matching the selector to be present
   * - `text`: wait for the page to contain the given text
   *
   * Polls every 100ms up to `timeoutMs` (defaults to the page-load timeout).
   *
   * @param {object} opts - Wait options
   * @returns {Promise<{matched: boolean, elapsedMs: number}>} Whether the condition was met before timeout
   */
  async wait(opts: { selector?: string; selectorGone?: string; text?: string; timeoutMs?: number }): Promise<{ matched: boolean; elapsedMs: number }> {
    const target = await this.resolveTarget();
    const start = Date.now();
    const timeout = opts.timeoutMs ?? this.pageLoadTimeout;
    const escapedSelector = opts.selector ? this.escapeForJs(opts.selector) : '';
    const escapedGone = opts.selectorGone ? this.escapeForJs(opts.selectorGone) : '';
    const escapedText = opts.text ? this.escapeForJs(opts.text) : '';
    while (Date.now() - start < timeout) {
      if (opts.selector) {
        const found = await this.executeScript(target, `document.querySelector('${escapedSelector}') !== null`);
        if (found === 'true') {
          return { matched: true, elapsedMs: Date.now() - start };
        }
      }
      if (opts.selectorGone) {
        const found = await this.executeScript(target, `document.querySelector('${escapedGone}') !== null`);
        if (found === 'false') {
          return { matched: true, elapsedMs: Date.now() - start };
        }
      }
      if (opts.text) {
        const has = await this.executeScript(target, `(document.body.innerText || '').indexOf('${escapedText}') !== -1 ? 'true' : 'false'`);
        if (has === 'true') {
          return { matched: true, elapsedMs: Date.now() - start };
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return { matched: false, elapsedMs: Date.now() - start };
  }
}
