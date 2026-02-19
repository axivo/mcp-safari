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
  serialize(fn, ...args) {
    const params = args.map((a) => JSON.stringify(a)).join(', ');
    return '(' + fn.toString() + ')(' + params + ')';
  }

  /**
   * Builds a script to click an element by visible text content
   *
   * Searches prioritized interactive elements first, then falls back to all
   * visible elements. Uses shortest-text-wins heuristic to avoid parent containers.
   *
   * @param {string} text - Text to search for (case-insensitive partial match)
   * @returns {string} Browser script string
   */
  clickElement(text) {
    function script(searchText) {
      var selectors = [
        'a', 'button', '[role="button"]', '[role="link"]', '[role="menuitem"]',
        '[role="tab"]', 'input[type="submit"]', 'input[type="button"]',
        '[onclick]', 'label', 'summary'
      ];
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
      if (!best) {
        return 'No element found with text: ' + searchText;
      }
      best.scrollIntoView({block: 'center'});
      best.click();
      return 'Clicked: ' + best.tagName.toLowerCase() + ' "' + (best.textContent || '').trim().substring(0, 80) + '"';
    }
    return this.serialize(script, text.toLowerCase());
  }

  /**
   * Builds a script to click an element by CSS selector scoped text search
   *
   * Searches elements matching the CSS selector for visible text content.
   * Uses shortest-text-wins heuristic to avoid parent containers.
   *
   * @param {string} text - Text to search for (case-insensitive partial match)
   * @param {string} selector - CSS selector to scope the search
   * @returns {string} Browser script string
   */
  clickSelector(text, selector) {
    function script(searchText, selector) {
      var elements = document.querySelectorAll(selector);
      if (elements.length === 0) {
        return 'No element found for selector: ' + selector;
      }
      var best = null;
      var bestLen = Infinity;
      for (var i = 0; i < elements.length; i++) {
        var el = elements[i];
        var elText = (el.textContent || el.value || el.getAttribute('aria-label') || '').trim().toLowerCase();
        if (elText.indexOf(searchText) !== -1 && elText.length < bestLen) {
          best = el;
          bestLen = elText.length;
        }
      }
      if (!best) {
        return 'No element found with text: ' + searchText;
      }
      best.scrollIntoView({block: 'center'});
      best.click();
      return 'Clicked: ' + best.tagName.toLowerCase() + ' "' + (best.textContent || '').trim().substring(0, 80) + '"';
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
  consoleErrors() {
    function script() {
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
   * Idempotent — safe to call multiple times on the same page.
   *
   * @returns {string} Browser script string
   */
  errorCapture() {
    function script() {
      if (window.__safariErrors) {
        return;
      }
      window.__safariErrors = [];
      window.__safariWarnings = [];
      var origError = console.error;
      var origWarn = console.warn;
      console.error = function() {
        var args = Array.prototype.slice.call(arguments);
        var msg = args.map(function(a) {
          return typeof a === 'object' ? JSON.stringify(a) : String(a);
        }).join(' ');
        window.__safariErrors.push(msg);
        origError.apply(console, arguments);
      };
      console.warn = function() {
        var args = Array.prototype.slice.call(arguments);
        var msg = args.map(function(a) {
          return typeof a === 'object' ? JSON.stringify(a) : String(a);
        }).join(' ');
        window.__safariWarnings.push(msg);
        origWarn.apply(console, arguments);
      };
      window.onerror = function(message, source, lineno, colno) {
        var loc = source ? ' (' + source.split('/').pop() + ':' + lineno + ':' + colno + ')' : '';
        window.__safariErrors.push(String(message) + loc);
      };
      window.addEventListener('unhandledrejection', function(e) {
        var reason = e.reason;
        var msg = reason instanceof Error ? reason.message : String(reason);
        window.__safariErrors.push('Unhandled rejection: ' + msg);
      });
    }
    return this.serialize(script);
  }

  /**
   * Builds a script to get page dimensions for viewport pagination
   *
   * Returns scroll height and inner height used to calculate
   * the total number of viewport pages.
   *
   * @returns {string} Browser script string
   */
  pageInfo() {
    function script() {
      return JSON.stringify({
        scrollHeight: document.body.scrollHeight,
        innerHeight: window.innerHeight
      });
    }
    return this.serialize(script);
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
  typeText(text, selector, append, submit) {
    function script(text, selector, append, submit) {
      var el;
      if (selector) {
        el = document.querySelector(selector);
        if (!el) {
          return 'No element found for selector: ' + selector;
        }
      } else {
        el = document.activeElement;
        if (!el || el === document.body || (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA' && !el.isContentEditable)) {
          var inputs = document.querySelectorAll(
            'input:not([type="hidden"]):not([type="submit"]):not([type="button"])'
            + ':not([type="checkbox"]):not([type="radio"]), textarea'
          );
          el = null;
          for (var i = 0; i < inputs.length; i++) {
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
      el.scrollIntoView({block: 'center'});
      var newVal = append ? (el.value || '') + text : text;
      var nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, 'value'
      ) || Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype, 'value'
      );
      if (nativeSetter && nativeSetter.set) {
        nativeSetter.set.call(el, newVal);
      } else {
        el.value = newVal;
      }
      el.dispatchEvent(new Event('input', {bubbles: true}));
      el.dispatchEvent(new Event('change', {bubbles: true}));
      var desc = el.tagName.toLowerCase() + (el.name ? '[name=' + el.name + ']' : '') + (el.id ? '#' + el.id : '');
      if (submit) {
        var enterOpts = {key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true};
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
    return this.serialize(script, text, selector || '', append, submit);
  }
}
