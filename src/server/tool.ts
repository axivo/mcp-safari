/**
 * MCP Tool Definitions for Safari Integration
 *
 * @module server/tool
 * @author AXIVO
 * @license BSD-3-Clause
 */

import { z } from 'zod';

/**
 * Reusable Zod schemas for structured tool outputs
 *
 * Output schemas for tools that return JSON payloads. Defined once
 * here so handlers and the SDK validation share the same source of
 * truth. Tool-specific augmentations are merged into these in the
 * relevant tool method.
 */
const pageDimensionsShape = {
  innerHeight: z.number().describe('Viewport height in pixels'),
  scrollHeight: z.number().describe('Total scrollable content height in pixels'),
  scrollOffset: z.number().describe('Current scroll offset from the top in pixels'),
  pages: z.number().describe('Number of viewport-sized pages')
};

const tabShape = {
  active: z.boolean().describe('Whether this tab is currently active'),
  index: z.number().describe('Tab index (1-based)'),
  title: z.string().describe('Tab title'),
  url: z.string().describe('Tab URL')
};

/**
 * MCP Tool Definitions for Safari Integration
 *
 * Provides MCP tool definitions that bridge Safari browser capabilities
 * with Model Context Protocol, enabling Claude agents to visually
 * interact with web pages.
 *
 * Each method returns an inline literal config object passed directly
 * to `McpServer.registerTool`. Return types are intentionally inferred
 * (not annotated as a wide alias) so TypeScript can capture each tool's
 * specific input shape and propagate it to the handler signature.
 *
 * @class McpTool
 */
export class McpTool {
  /**
   * Creates MCP tool for clicking elements on the browser window
   *
   * Finds and clicks elements matching visible text, image alt text, aria-label,
   * or CSS selector, supporting links, buttons, images, and other clickable elements.
   */
  click() {
    return {
      description: 'Click an element on the browser window',
      inputSchema: {
        key: z.string().optional().describe('Key to press (e.g., Escape, ArrowRight, ArrowLeft, Enter, Tab)'),
        selector: z.string().optional().describe('CSS selector to click when no text provided or to scope the text search'),
        text: z.string().optional().describe('Text to match - visible text, image alt text, or aria-label'),
        wait: z.string().optional().describe('CSS selector to wait for after click'),
        x: z.coerce.number().optional().describe('X coordinate (pixels from left of viewport) to click at'),
        y: z.coerce.number().optional().describe('Y coordinate (pixels from top of viewport) to click at')
      },
      annotations: {
        title: 'Click',
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true
      },
      _meta: {
        usage: [
          'Always use `read` first to discover real selectors on the page',
          'Prefer `text` over `selector` parameter for matching elements',
          'Match aria-label attributes for buttons like Next, Previous, Close using `text` parameter',
          'Use descriptive text fragments from `read` output to avoid ambiguous matches',
          'Try first `key` parameter to press ArrowRight, ArrowLeft, Enter, Escape, or Tab on current page',
          'Try first `key: "Escape"` then `text: "Close"` parameter values to close overlays or panels on current page',
          'Use `text: "Next"` and `text: "Previous"` parameter values to navigate between items in image detail panels and carousels',
          'Use `x` and `y` coordinates from `screenshot` output to click visual elements without text',
          'Take a `screenshot` after clicking only when visual verification is needed'
        ]
      }
    };
  }

  /**
   * Creates MCP tool for closing the Safari window
   *
   * Terminates the active browser session and closes the Safari window.
   */
  close() {
    return {
      description: 'Close the working tab',
      outputSchema: {
        closed: z.boolean().describe('True after the working tab is closed or no tab existed')
      },
      annotations: {
        title: 'Close',
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false
      }
    };
  }

  /**
   * Creates MCP tool for executing JavaScript in the browser context
   *
   * Runs arbitrary JavaScript on the current page,
   * returning the script's result.
   */
  execute() {
    return {
      description: 'Execute JavaScript in the browser context',
      inputSchema: {
        script: z.string().describe('JavaScript code to execute')
      },
      annotations: {
        title: 'Execute',
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true
      },
      _meta: {
        usage: [
          'Avoid using `execute` for DOM inspection - use `inspect` instead',
          'Prefer `click` with `text` parameter and `read` for page interaction',
          'Reserve `execute` for operations not covered by other tools'
        ]
      }
    };
  }

  /**
   * Creates MCP tool for hovering over an element
   *
   * Dispatches pointer/mouse enter and over events to trigger CSS :hover
   * and JavaScript hover handlers. Useful for revealing dropdown menus
   * and tooltips that only appear on hover.
   */
  hover() {
    return {
      description: 'Hover over an element to reveal hover-triggered UI',
      inputSchema: {
        selector: z.string().optional().describe('CSS selector for the target element'),
        text: z.string().optional().describe('Visible text to match (case-insensitive partial match)')
      },
      annotations: {
        title: 'Hover',
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      },
      _meta: {
        usage: [
          'Always use `read` first to discover real selectors on the page',
          'Provide either `selector` or `text` to identify the target',
          'Useful for revealing dropdown menus, tooltips, and other hover-triggered UI'
        ]
      }
    };
  }

  /**
   * Creates MCP tool for inspecting a single element by CSS selector
   *
   * Returns descriptive metadata for the first matching element including
   * tag name, visible text, visibility/disabled state, key attributes, and
   * viewport bounding rect.
   */
  inspect() {
    return {
      description: 'Inspect a page element by CSS selector',
      inputSchema: {
        index: z.coerce.number().optional().describe('Tab index in the front window; defaults to the current tab'),
        selector: z.string().describe('CSS selector for the target element')
      },
      outputSchema: {
        found: z.boolean().describe('Whether the selector matched any element'),
        tag: z.string().optional().describe('Lowercase HTML tag name; present when found'),
        text: z.string().optional().describe('Trimmed visible text or aria-label or alt; present when found'),
        visible: z.boolean().optional().describe('Whether the element is visible in the layout; present when found'),
        disabled: z.boolean().optional().describe('Whether the element is disabled or aria-disabled; present when found'),
        attributes: z.record(z.string(), z.string()).optional().describe('Selected key attributes on the element; present when found'),
        rect: z.object({
          x: z.number(),
          y: z.number(),
          width: z.number(),
          height: z.number()
        }).optional().describe('Viewport-relative bounding box; present when found')
      },
      annotations: {
        title: 'Inspect',
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false
      },
      _meta: {
        usage: [
          'Always use `read` first to discover real selectors on the page',
          'Use before `click` to verify an element exists, is visible, and is enabled',
          'Use to disambiguate between multiple elements matching a partial text search',
          'Use `index` to inspect a tab in the front window without switching focus to it'
        ]
      }
    };
  }

  /**
   * Creates MCP tool for navigating to a URL or through browser history
   *
   * Navigates Safari to the specified URL, or backward/forward through
   * browser history. Optionally waits for a CSS selector after page load.
   * Returns the page title, final URL, ready state, and viewport page count.
   */
  navigate() {
    return {
      description: 'Navigate to a URL or through browser history (back/forward)',
      inputSchema: {
        direction: z.enum(['back', 'forward']).optional().describe('Navigate back or forward in browser history'),
        selector: z.string().optional().describe('CSS selector to wait for after page load'),
        steps: z.coerce.number().default(1).describe('Number of steps for back/forward navigation'),
        url: z.string().optional().describe('URL to navigate to')
      },
      outputSchema: {
        title: z.string().describe('Page title after navigation'),
        url: z.string().describe('Final URL after navigation'),
        ...pageDimensionsShape,
        tabs: z.number().describe('Total tab count'),
        selectorFound: z.boolean().optional().describe('Whether the selector was found, when provided')
      },
      annotations: {
        title: 'Navigate',
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      },
      _meta: {
        usage: [
          'Use `read` after navigating to understand available content',
          'Use `direction` parameter for history navigation instead of re-entering URLs'
        ]
      }
    };
  }

  /**
   * Creates MCP tool for opening a Safari window
   *
   * Opens a new Safari browser window with configured dimensions,
   * ready for navigation and interaction.
   */
  open() {
    return {
      description: 'Open a blank tab as the working target',
      outputSchema: {
        opened: z.boolean().describe('True after the working tab is created')
      },
      annotations: {
        title: 'Open',
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false
      },
      _meta: {
        usage: [
          'Use `navigate` directly to open a tab at a URL',
          'Use `open` to get a blank tab without navigating',
          'Read all `_meta.usage` guidance before using any tools'
        ]
      }
    };
  }

  /**
   * Creates MCP tool for reading page content
   *
   * Extracts the page title, current URL, and visible text content
   * from the current page or a specific element.
   */
  read() {
    return {
      description: 'Get the page title, URL, and either text content or anchor links',
      inputSchema: {
        index: z.coerce.number().optional().describe('Tab index in the front window; defaults to the current tab'),
        mode: z.enum(['text', 'links']).default('text').describe('Extraction mode: full text content or anchor links'),
        selector: z.string().optional().describe('CSS selector to scope extraction')
      },
      outputSchema: {
        title: z.string().describe('Page title'),
        url: z.string().describe('Page URL'),
        text: z.string().optional().describe('Extracted text content; present when mode is "text"'),
        links: z.array(z.object({
          text: z.string().describe('Visible link text'),
          href: z.string().describe('Resolved link URL')
        })).optional().describe('Anchor links; present when mode is "links"'),
        pages: z.number().describe('Number of viewport-sized pages'),
        errors: z.array(z.string()).optional().describe('Console errors captured during the page session, when any'),
        warnings: z.array(z.string()).optional().describe('Console warnings captured during the page session, when any')
      },
      annotations: {
        title: 'Read',
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false
      },
      _meta: {
        usage: [
          'Use after navigating to understand available content',
          'Use `mode: "links"` to enumerate anchor links on the page',
          'Use `selector` to scope extraction to specific page sections',
          'Use `index` to read a tab in the front window without switching focus to it'
        ]
      }
    };
  }

  /**
   * Creates MCP tool for refreshing the current browser page
   *
   * Reloads the current page, optionally bypassing the browser cache.
   * Waits for the page to finish loading before returning.
   */
  refresh() {
    return {
      description: 'Refresh the current browser page',
      inputSchema: {
        hard: z.coerce.boolean().default(false).describe('Bypass browser cache with hard refresh'),
        selector: z.string().optional().describe('CSS selector to wait for after reload')
      },
      outputSchema: {
        title: z.string().describe('Page title after refresh'),
        url: z.string().describe('Page URL after refresh'),
        ...pageDimensionsShape,
        tabs: z.number().describe('Total tab count'),
        selectorFound: z.boolean().optional().describe('Whether the selector was found, when provided')
      },
      annotations: {
        title: 'Refresh',
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      },
      _meta: {
        usage: [
          'Use `hard` parameter when CSS or asset changes are not reflected after a normal refresh'
        ]
      }
    };
  }

  /**
   * Creates MCP tool for capturing screenshots
   *
   * Captures the Safari window, a specific element, the full scrollable page,
   * or the entire screen. Returns the image as base64 inline by default, or
   * saves it to the user's screenshot folder when `share` is true.
   */
  screenshot() {
    return {
      description: 'Capture a screenshot of the browser window, an element, the full page, or the screen',
      inputSchema: {
        display: z.coerce.number().optional().describe('Display index for screen mode (1-based; defaults to the main display)'),
        mode: z.enum(['element', 'page', 'screen', 'window']).default('window').describe('Capture mode'),
        selector: z.string().optional().describe('CSS selector for element mode'),
        settle: z.coerce.number().optional().describe('Page mode: ms to wait after each scroll for content to settle (default 500)'),
        share: z.coerce.boolean().default(false).describe('Save to disk and return path instead of inline image')
      },
      annotations: {
        title: 'Screenshot',
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false
      },
      _meta: {
        usage: [
          'Default `mode: "window"` captures the Safari window',
          'Default `share: false` returns the image inline as base64',
          'Prefer `read` over `screenshot` for identifying page elements and content',
          'Use `mode: "element"` with `selector` to capture a specific element',
          'Use `mode: "page"` to capture the full scrollable page (large output, prefer `share: true`)',
          'Use `settle` to tune the per-scroll wait in `mode: "page"` (default 500ms; raise for slow dynamic sites, lower for static sites)',
          'Use `mode: "screen"` to capture the entire display, including content outside Safari',
          'Use `display` with `mode: "screen"` to target a specific display (1-based) on multi-monitor setups',
          'Use `share: true` to save the image to the user screenshot folder and return only the path',
          'Use `scroll` to position the viewport before capturing in window mode'
        ]
      }
    };
  }

  /**
   * Creates MCP tool for scrolling the page
   *
   * Scrolls the viewport by direction with pixel amount,
   * or jumps to a specific viewport-sized page number.
   */
  scroll() {
    return {
      description: 'Scroll to specific viewport page or by direction with pixel amount',
      inputSchema: {
        direction: z.enum(['up', 'down']).optional().describe('Scroll direction'),
        page: z.coerce.number().optional().describe('Scroll to a specific viewport-sized page number'),
        pixels: z.coerce.number().optional().describe('Number of pixels to scroll')
      },
      outputSchema: pageDimensionsShape,
      annotations: {
        title: 'Scroll',
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false
      },
      _meta: {
        usage: [
          'Provide either `direction` or `page` parameter, not both',
          'Use `direction` alone to scroll one viewport page up or down',
          'Use `direction` with `pixels` parameter for fine-grained scrolling within browser window',
          'Use `page` parameter to jump to a specific viewport-sized page number',
          'Use `scroll` before `screenshot` to position the viewport'
        ]
      }
    };
  }

  /**
   * Creates MCP tool for searching the web
   *
   * Searches using the user's default search engine configured in Safari,
   * returning search results in the browser.
   */
  search() {
    return {
      description: "Search the web using browser's default search engine",
      inputSchema: {
        text: z.string().describe('Search query')
      },
      outputSchema: {
        title: z.string().describe('Search results page title'),
        url: z.string().describe('Search results page URL'),
        ...pageDimensionsShape,
        tabs: z.number().describe('Total tab count')
      },
      annotations: {
        title: 'Search',
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true
      },
      _meta: {
        usage: [
          'Use `read` after searching to extract results'
        ]
      }
    };
  }

  /**
   * Creates MCP tool for selecting an option in a <select> element
   *
   * Match by `value` (option value attribute) or `text` (option visible label,
   * case-insensitive partial match). Operates on the working tab.
   */
  select() {
    return {
      description: 'Choose an option in a <select> element',
      inputSchema: {
        selector: z.string().describe('CSS selector for the target <select> element'),
        text: z.string().optional().describe('Option visible text (case-insensitive partial match)'),
        value: z.string().optional().describe('Option value attribute (takes precedence over text)')
      },
      annotations: {
        title: 'Select',
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false
      },
      _meta: {
        usage: [
          'Provide either `value` or `text`; if both are passed, `value` wins',
          'Use `inspect` first to confirm the target is a <select> element'
        ]
      }
    };
  }

  /**
   * Creates MCP tool for environment introspection
   *
   * Returns the current Safari tab list and the full set of available tools
   * with their schemas, annotations, and `_meta.usage` arrays. Use at session
   * start to learn the surface and the runtime state in one call.
   */
  status() {
    return {
      description: 'Get the current Safari tabs and the full tool surface with usage guidance',
      outputSchema: {
        tabs: z.array(z.object(tabShape)).describe('Tabs in the front Safari window, or empty when no window is open'),
        tools: z.array(z.object({
          name: z.string(),
          description: z.string(),
          inputSchema: z.unknown().optional(),
          outputSchema: z.unknown().optional(),
          annotations: z.unknown().optional(),
          usage: z.array(z.string()).optional()
        })).describe('All available tools with their schemas and usage guidance')
      },
      annotations: {
        title: 'Status',
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false
      },
      _meta: {
        usage: [
          'Call once at session start to learn the tool surface and current Safari state',
          'Each tool entry includes its `usage` array of natural-language hints'
        ]
      }
    };
  }

  /**
   * Creates MCP tool for typing text into input elements
   *
   * Sets the value of input fields with proper event dispatching
   * for framework reactivity, with optional form submission.
   */
  type() {
    return {
      description: 'Type text into a page input field',
      inputSchema: {
        append: z.coerce.boolean().default(false).describe('Append to existing value instead of replacing'),
        selector: z.string().optional().describe('CSS selector for the target input'),
        submit: z.coerce.boolean().default(false).describe('Submit form by pressing Enter after typing'),
        text: z.string().describe('Text to type')
      },
      annotations: {
        title: 'Type',
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true
      },
      _meta: {
        usage: [
          'Use `read` before typing to identify available input fields',
          'Use `submit` parameter to submit forms instead of separate `click` actions'
        ]
      }
    };
  }

  /**
   * Creates MCP tool for waiting on a page condition
   *
   * Polls until a CSS selector appears, disappears, or page text contains
   * a given fragment. Useful for handling dynamic UIs that load content
   * after the initial page-ready state.
   */
  wait() {
    return {
      description: 'Wait for a selector to appear, disappear, or text to appear',
      inputSchema: {
        selector: z.string().optional().describe('CSS selector to wait for'),
        selectorGone: z.string().optional().describe('CSS selector to wait for absence of'),
        text: z.string().optional().describe('Page text to wait for (substring match in body innerText)'),
        timeoutMs: z.coerce.number().optional().describe('Timeout in milliseconds; defaults to the configured page-load timeout')
      },
      outputSchema: {
        matched: z.boolean().describe('Whether the condition was met before timeout'),
        elapsedMs: z.number().describe('How long the wait took, in milliseconds')
      },
      annotations: {
        title: 'Wait',
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false
      },
      _meta: {
        usage: [
          'Provide exactly one of `selector`, `selectorGone`, or `text`',
          'Use after navigation when the page content loads asynchronously',
          'Use `selectorGone` to wait for a loading spinner to disappear'
        ]
      }
    };
  }

  /**
   * Creates MCP tool for managing browser window tabs
   *
   * Lists, switches, opens, or closes individual tabs within
   * the browser window without affecting other tabs.
   */
  window() {
    return {
      description: 'Manage browser window tabs',
      inputSchema: {
        action: z.enum(['close', 'list', 'open', 'switch']).describe('Tab action to perform'),
        index: z.coerce.number().optional().describe('Tab index for close and switch actions'),
        url: z.string().optional().describe('URL to open in a new tab (open action only)')
      },
      outputSchema: {
        tabs: z.array(z.object(tabShape)).describe('Array of tab info after the action')
      },
      annotations: {
        title: 'Window',
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false
      },
      _meta: {
        usage: [
          'Use `action: "close"` parameter value with `index` parameter to close a specific tab without closing the window',
          'Use `action: "list"` parameter value to see all open tabs with their index, title, URL, and which is active',
          'Use `action: "open"` parameter value to create a new tab, optionally with a URL',
          'Use `action: "switch"` parameter value with `index` to change the active tab'
        ]
      }
    };
  }
}
