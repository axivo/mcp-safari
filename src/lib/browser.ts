/**
 * Browser script library for Safari MCP Server
 *
 * Provides JavaScript scripts that execute in Safari's browser context
 * via AppleScript's `do JavaScript`. Each method returns a self-contained
 * script string ready for execution.
 *
 * @module lib/browser
 * @author AXIVO
 * @license BSD-3-Clause
 */

declare global {
  interface Window {
    __safariErrors?: string[];
    __safariWarnings?: string[];
  }
}

/**
 * Browser script builder for Safari automation
 *
 * Each method contains a real function with proper indentation and
 * editor support. The serialize helper converts functions to IIFE
 * strings using toString() and JSON.stringify for safe parameter
 * injection.
 *
 * @class Browser
 */
export class Browser {
  /**
   * Serializes a function into an IIFE string with arguments
   *
   * @private
   * @param {Function} fn - Function to serialize
   * @param {...*} args - Arguments to pass to the function
   * @returns {string} IIFE string ready for browser execution
   */
  private serialize<T extends unknown[]>(fn: (...args: T) => unknown, ...args: T): string {
    const params = args.map((a) => JSON.stringify(a)).join(', ');
    return '(' + fn.toString() + ')(' + params + ')';
  }

  /**
   * Builds a script to click an element at specific viewport coordinates
   *
   * Uses document.elementFromPoint to find the element at the given x/y
   * position, then scrolls it into view and clicks it.
   *
   * @param {number} x - X coordinate (pixels from left of viewport)
   * @param {number} y - Y coordinate (pixels from top of viewport)
   * @returns {string} Browser script string
   */
  clickCoordinates(x: number, y: number): string {
    function script(x: number, y: number): string {
      const el = document.elementFromPoint(x, y) as HTMLElement | null;
      if (!el) {
        return 'No element found at coordinates: ' + x + ', ' + y;
      }
      el.scrollIntoView({ block: 'center' });
      el.click();
      const text = el.textContent || el.getAttribute('alt') || el.getAttribute('aria-label') || el.tagName.toLowerCase();
      return 'Clicked: ' + el.tagName.toLowerCase() + ' at (' + x + ', ' + y + ') "' + text.trim().substring(0, 80) + '"';
    }
    return this.serialize(script, x, y);
  }

  /**
   * Builds a script to click an element directly by CSS selector
   *
   * Clicks the first element matching the CSS selector without text matching.
   * Scrolls the element into view before clicking.
   *
   * @param {string} selector - CSS selector for the element to click
   * @returns {string} Browser script string
   */
  clickDirect(selector: string): string {
    function script(selector: string): string {
      const el = document.querySelector<HTMLElement>(selector);
      if (!el) {
        return 'No element found for selector: ' + selector;
      }
      el.scrollIntoView({ block: 'center' });
      el.click();
      const text = el.textContent || el.getAttribute('alt') || el.tagName.toLowerCase();
      return 'Clicked: ' + el.tagName.toLowerCase() + ' "' + text.trim().substring(0, 80) + '"';
    }
    return this.serialize(script, selector);
  }

  /**
   * Builds a script to click an element by visible text or image alt text
   *
   * Searches prioritized interactive elements first, then falls back to all
   * visible elements. Uses shortest-text-wins heuristic to avoid parent containers.
   * Checks textContent, value, aria-label, alt attribute, and child img alt text.
   *
   * @param {string} text - Text to search for (case-insensitive partial match)
   * @returns {string} Browser script string
   */
  clickElement(text: string): string {
    function script(searchText: string): string {
      function getText(el: Element): string {
        let text = el.textContent || (el as HTMLInputElement).value || el.getAttribute('aria-label') || el.getAttribute('alt') || '';
        if (!text.trim()) {
          const img = el.querySelector('img[alt]');
          if (img) {
            text = img.getAttribute('alt') || '';
          }
        }
        return text.trim().toLowerCase();
      }
      function isVisible(el: Element): boolean {
        if (!el.getBoundingClientRect) return false;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return false;
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
      }
      let best: HTMLElement | null = null;
      let bestLen = Infinity;
      const ariaSelectors = 'button, [role="button"], a, [role="link"], [role="menuitem"], [role="tab"]';
      const ariaElements = document.querySelectorAll<HTMLElement>(ariaSelectors);
      for (let a = 0; a < ariaElements.length; a++) {
        const ariaEl = ariaElements[a];
        const ariaLabel = (ariaEl.getAttribute('aria-label') || '').trim().toLowerCase();
        if (ariaLabel && ariaLabel.indexOf(searchText) !== -1 && ariaLabel.length < bestLen && isVisible(ariaEl)) {
          best = ariaEl;
          bestLen = ariaLabel.length;
        }
      }
      if (!best) {
        const selectors = [
          'a', 'button', '[role="button"]', '[role="link"]', '[role="menuitem"]',
          '[role="tab"]', 'input[type="submit"]', 'input[type="button"]',
          '[onclick]', 'label', 'summary'
        ];
        for (let i = 0; i < selectors.length; i++) {
          const elements = document.querySelectorAll<HTMLElement>(selectors[i]);
          for (let j = 0; j < elements.length; j++) {
            const el = elements[j];
            const elText = getText(el);
            if (elText.indexOf(searchText) !== -1 && elText.length < bestLen && isVisible(el)) {
              best = el;
              bestLen = elText.length;
            }
          }
        }
      }
      if (!best) {
        const all = document.querySelectorAll<HTMLElement>('*');
        for (let k = 0; k < all.length; k++) {
          const el2 = all[k];
          const elText2 = getText(el2);
          if (elText2.indexOf(searchText) !== -1 && elText2.length < bestLen && isVisible(el2)) {
            best = el2;
            bestLen = elText2.length;
          }
        }
      }
      if (!best) {
        return 'No element found with text: ' + searchText;
      }
      best.scrollIntoView({ block: 'center' });
      best.click();
      return 'Clicked: ' + best.tagName.toLowerCase() + ' "' + getText(best).substring(0, 80) + '"';
    }
    return this.serialize(script, text.toLowerCase());
  }

  /**
   * Builds a script to click an element by CSS selector scoped text search
   *
   * Searches elements matching the CSS selector for visible text or image alt text.
   * Uses shortest-text-wins heuristic to avoid parent containers.
   * Checks textContent, value, aria-label, alt attribute, and child img alt text.
   *
   * @param {string} text - Text to search for (case-insensitive partial match)
   * @param {string} selector - CSS selector to scope the search
   * @returns {string} Browser script string
   */
  clickSelector(text: string, selector: string): string {
    function script(searchText: string, selector: string): string {
      function getText(el: Element): string {
        let text = el.textContent || (el as HTMLInputElement).value || el.getAttribute('aria-label') || el.getAttribute('alt') || '';
        if (!text.trim()) {
          const img = el.querySelector('img[alt]');
          if (img) {
            text = img.getAttribute('alt') || '';
          }
        }
        return text.trim().toLowerCase();
      }
      function isVisible(el: Element): boolean {
        if (!el.getBoundingClientRect) return false;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return false;
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
      }
      const elements = document.querySelectorAll<HTMLElement>(selector);
      if (elements.length === 0) {
        return 'No element found for selector: ' + selector;
      }
      let best: HTMLElement | null = null;
      let bestLen = Infinity;
      for (let a = 0; a < elements.length; a++) {
        const ariaLabel = (elements[a].getAttribute('aria-label') || '').trim().toLowerCase();
        if (ariaLabel && ariaLabel.indexOf(searchText) !== -1 && ariaLabel.length < bestLen && isVisible(elements[a])) {
          best = elements[a];
          bestLen = ariaLabel.length;
        }
      }
      if (!best) {
        for (let i = 0; i < elements.length; i++) {
          const el = elements[i];
          const elText = getText(el);
          if (elText.indexOf(searchText) !== -1 && elText.length < bestLen && isVisible(el)) {
            best = el;
            bestLen = elText.length;
          }
        }
      }
      if (!best) {
        return 'No element found with text: ' + searchText;
      }
      best.scrollIntoView({ block: 'center' });
      best.click();
      return 'Clicked: ' + best.tagName.toLowerCase() + ' "' + getText(best).substring(0, 80) + '"';
    }
    return this.serialize(script, text.toLowerCase(), selector);
  }

  /**
   * Builds a script to retrieve captured console errors and warnings
   *
   * Returns the arrays populated by errorCapture, with fallback
   * to empty arrays if capture was not injected.
   *
   * @returns {string} Browser script string
   */
  consoleErrors(): string {
    function script(): string {
      return JSON.stringify({
        errors: window.__safariErrors || [],
        warnings: window.__safariWarnings || []
      });
    }
    return this.serialize(script);
  }

  /**
   * Builds a script to inject console error and warning capture
   *
   * Overrides console.error, console.warn, window.onerror, and
   * unhandledrejection to capture errors with source context.
   * Idempotent - safe to call multiple times on the same page.
   *
   * @returns {string} Browser script string
   */
  errorCapture(): string {
    function script(): void {
      if (window.__safariErrors) {
        return;
      }
      const errors: string[] = [];
      const warnings: string[] = [];
      window.__safariErrors = errors;
      window.__safariWarnings = warnings;
      const origError = console.error;
      const origWarn = console.warn;
      console.error = function (...args: unknown[]): void {
        const msg = args.map((a) => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
        errors.push(msg);
        origError.apply(console, args);
      };
      console.warn = function (...args: unknown[]): void {
        const msg = args.map((a) => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
        warnings.push(msg);
        origWarn.apply(console, args);
      };
      window.onerror = function (message, source, lineno, colno): void {
        const loc = source ? ' (' + source.split('/').pop() + ':' + lineno + ':' + colno + ')' : '';
        errors.push(String(message) + loc);
      };
      window.addEventListener('unhandledrejection', function (e: PromiseRejectionEvent): void {
        const reason = e.reason;
        const msg = reason instanceof Error ? reason.message : String(reason);
        errors.push('Unhandled rejection: ' + msg);
      });
    }
    return this.serialize(script);
  }

  /**
   * Builds a script to dispatch hover events on an element
   *
   * Fires mouseenter and mouseover at the element, plus pointerenter and
   * pointerover, to trigger CSS :hover and any JS hover handlers. Resolves
   * the element by selector or by visible text (text uses the same
   * shortest-text-wins heuristic as click).
   *
   * @param {string} [selector] - CSS selector for the target element
   * @param {string} [text] - Visible text to match (case-insensitive partial match)
   * @returns {string} Browser script string
   */
  hover(selector?: string, text?: string): string {
    function script(selector: string, searchText: string): string {
      let el: HTMLElement | null = null;
      if (selector) {
        el = document.querySelector<HTMLElement>(selector);
        if (!el) {
          return 'No element found for selector: ' + selector;
        }
      } else if (searchText) {
        const all = document.querySelectorAll<HTMLElement>('a, button, [role="button"], [role="menuitem"], [role="tab"], summary, label, span, div');
        let best: HTMLElement | null = null;
        let bestLen = Infinity;
        for (let i = 0; i < all.length; i++) {
          const candidate = all[i];
          const candidateText = (candidate.textContent || candidate.getAttribute('aria-label') || '').trim().toLowerCase();
          if (candidateText.indexOf(searchText) !== -1 && candidateText.length < bestLen) {
            const rect = candidate.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              best = candidate;
              bestLen = candidateText.length;
            }
          }
        }
        el = best;
        if (!el) {
          return 'No element matched text: ' + searchText;
        }
      } else {
        return 'Missing required argument: selector or text';
      }
      el.scrollIntoView({ block: 'center' });
      const rect = el.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const opts: MouseEventInit = { bubbles: true, cancelable: true, clientX: x, clientY: y };
      el.dispatchEvent(new PointerEvent('pointerenter', opts));
      el.dispatchEvent(new PointerEvent('pointerover', opts));
      el.dispatchEvent(new MouseEvent('mouseenter', opts));
      el.dispatchEvent(new MouseEvent('mouseover', opts));
      el.dispatchEvent(new MouseEvent('mousemove', opts));
      const desc = el.tagName.toLowerCase() + (el.id ? '#' + el.id : '');
      return 'Hovered: ' + desc;
    }
    return this.serialize(script, selector || '', (text || '').toLowerCase());
  }

  /**
   * Builds a script to inspect the first element matching a CSS selector
   *
   * Returns descriptive metadata about the element: tag name, visible text,
   * visibility and disabled state, key attributes, and viewport bounding rect.
   *
   * @param {string} selector - CSS selector for the target element
   * @returns {string} Browser script string
   */
  inspect(selector: string): string {
    function script(selector: string): string {
      const el = document.querySelector(selector) as HTMLElement | null;
      if (!el) {
        return JSON.stringify({ found: false });
      }
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      const visible = !(rect.width === 0 && rect.height === 0) && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
      const disabled = (el as HTMLInputElement).disabled === true || el.getAttribute('aria-disabled') === 'true';
      const text = (el.textContent || (el as HTMLInputElement).value || el.getAttribute('aria-label') || el.getAttribute('alt') || '').trim().replace(/\s+/g, ' ').substring(0, 200);
      const attrs: Record<string, string> = {};
      const interesting = ['id', 'class', 'name', 'type', 'role', 'href', 'src', 'alt', 'aria-label', 'placeholder', 'value', 'title'];
      for (let i = 0; i < interesting.length; i++) {
        const v = el.getAttribute(interesting[i]);
        if (v !== null) {
          attrs[interesting[i]] = v.length > 200 ? v.substring(0, 200) + '...' : v;
        }
      }
      return JSON.stringify({
        found: true,
        tag: el.tagName.toLowerCase(),
        text,
        visible,
        disabled,
        attributes: attrs,
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
      });
    }
    return this.serialize(script, selector);
  }

  /**
   * Builds a script to dispatch a keyboard event on the page
   *
   * Dispatches keydown and keyup events on the target element,
   * with proper key, code, and bubbles properties.
   *
   * @param {string} key - Key name (e.g., 'Escape', 'ArrowRight', 'Enter')
   * @param {string} [selector] - CSS selector for target element
   * @returns {string} Browser script string
   */
  keypress(key: string, selector?: string): string {
    function script(key: string, selector: string): string {
      let el: Element | null;
      if (selector) {
        el = document.querySelector(selector);
        if (!el) {
          return 'No element found for selector: ' + selector;
        }
      } else {
        el = document.activeElement || document.body;
      }
      const opts = { key: key, code: key, bubbles: true, cancelable: true };
      el.dispatchEvent(new KeyboardEvent('keydown', opts));
      el.dispatchEvent(new KeyboardEvent('keyup', opts));
      let desc = el.tagName.toLowerCase();
      if (el.id) {
        desc += '#' + el.id;
      }
      return 'Pressed: ' + key + ' on ' + desc;
    }
    return this.serialize(script, key, selector || '');
  }

  /**
   * Builds a script to extract anchor links from the page
   *
   * Returns an array of { text, href } pairs for visible anchors.
   * Skips anchors with empty href, javascript: schemes, and empty text.
   * Optionally scopes extraction to a CSS selector subtree.
   *
   * @param {string} [selector] - Optional CSS selector to scope extraction
   * @returns {string} Browser script string
   */
  links(selector?: string): string {
    function script(selector: string): string {
      const root: ParentNode = selector ? (document.querySelector(selector) || document) : document;
      const anchors = root.querySelectorAll('a[href]');
      const out: { text: string; href: string }[] = [];
      const seen = new Set<string>();
      for (let i = 0; i < anchors.length; i++) {
        const a = anchors[i] as HTMLAnchorElement;
        const href = a.href;
        if (!href || href.startsWith('javascript:')) continue;
        const text = (a.textContent || a.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ');
        if (!text) continue;
        const key = text + '|' + href;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ text: text.substring(0, 200), href });
      }
      return JSON.stringify(out);
    }
    return this.serialize(script, selector || '');
  }

  /**
   * Builds a script to get page dimensions for viewport pagination
   *
   * Returns scroll height and inner height used to calculate
   * the total number of viewport pages.
   *
   * @returns {string} Browser script string
   */
  pageInfo(): string {
    function script(): string {
      return JSON.stringify({
        innerHeight: window.innerHeight,
        scrollHeight: document.body.scrollHeight,
        scrollOffset: window.scrollY
      });
    }
    return this.serialize(script);
  }

  /**
   * Builds a script to select an option in a <select> element
   *
   * Either `value` or `text` is provided. If both, `value` takes precedence.
   * Sets the selectedIndex to the matching option, fires change/input events
   * for framework reactivity.
   *
   * @param {string} selector - CSS selector for the target <select> element
   * @param {string} [value] - Option value attribute to match
   * @param {string} [text] - Option visible text (case-insensitive partial match)
   * @returns {string} Browser script string
   */
  selectOption(selector: string, value?: string, text?: string): string {
    function script(selector: string, value: string, text: string): string {
      const el = document.querySelector(selector) as HTMLSelectElement | null;
      if (!el) {
        return 'No element found for selector: ' + selector;
      }
      if (el.tagName !== 'SELECT') {
        return 'Element at ' + selector + ' is a <' + el.tagName.toLowerCase() + '>, not a <select>';
      }
      const options = Array.from(el.options);
      let matchIndex = -1;
      if (value) {
        matchIndex = options.findIndex((o) => o.value === value);
      } else if (text) {
        const needle = text.toLowerCase();
        matchIndex = options.findIndex((o) => (o.text || '').toLowerCase().indexOf(needle) !== -1);
      }
      if (matchIndex === -1) {
        const sample = options.map((o) => o.text + ' [' + o.value + ']').slice(0, 10).join(', ');
        return 'No option matched in <select>; first options: ' + sample;
      }
      el.selectedIndex = matchIndex;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      const chosen = options[matchIndex];
      return 'Selected: ' + (chosen.text || '(empty)') + ' [value=' + chosen.value + ']';
    }
    return this.serialize(script, selector, value || '', text || '');
  }

  /**
   * Builds a script to type text into an input element
   *
   * Resolves target element through three tiers: CSS selector, focused element,
   * or first visible text input/textarea. Uses native property descriptor setter
   * for React/Vue/Angular compatibility. Dispatches input + change events for
   * framework reactivity. Optional submit mode with full Enter key sequence.
   *
   * @param {string} text - Text to type into the input
   * @param {string} [selector] - CSS selector for target input
   * @param {boolean} [append] - Whether to append to existing value
   * @param {boolean} [submit] - Whether to press Enter after typing
   * @returns {string} Browser script string
   */
  typeText(text: string, selector?: string, append?: boolean, submit?: boolean): string {
    function script(text: string, selector: string, append: boolean, submit: boolean): string {
      let el: HTMLInputElement | HTMLTextAreaElement | null = null;
      if (selector) {
        el = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector);
        if (!el) {
          return 'No element found for selector: ' + selector;
        }
      } else {
        const active = document.activeElement as HTMLElement | null;
        if (active && active !== document.body && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) {
          el = active as HTMLInputElement | HTMLTextAreaElement;
        }
        if (!el) {
          const inputs = document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
            'input:not([type="hidden"]):not([type="submit"]):not([type="button"])'
            + ':not([type="checkbox"]):not([type="radio"]), textarea'
          );
          for (let i = 0; i < inputs.length; i++) {
            if (inputs[i].offsetParent !== null) {
              el = inputs[i];
              break;
            }
          }
        }
      }
      if (!el) {
        return 'No input element found';
      }
      el.focus();
      el.scrollIntoView({ block: 'center' });
      const newVal = append ? (el.value || '') + text : text;
      const proto = el.tagName === 'TEXTAREA'
        ? window.HTMLTextAreaElement.prototype
        : window.HTMLInputElement.prototype;
      const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value');
      if (nativeSetter && nativeSetter.set) {
        nativeSetter.set.call(el, newVal);
      } else {
        el.value = newVal;
      }
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      const desc = el.tagName.toLowerCase() + (el.name ? '[name=' + el.name + ']' : '') + (el.id ? '#' + el.id : '');
      if (submit) {
        const enterOpts = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true };
        el.dispatchEvent(new KeyboardEvent('keydown', enterOpts));
        el.dispatchEvent(new KeyboardEvent('keypress', enterOpts));
        el.dispatchEvent(new KeyboardEvent('keyup', enterOpts));
        if (el.form) {
          el.form.submit();
        }
        return 'Typed and submitted in: ' + desc;
      }
      return 'Typed in: ' + desc;
    }
    return this.serialize(script, text, selector || '', append || false, submit || false);
  }
}
