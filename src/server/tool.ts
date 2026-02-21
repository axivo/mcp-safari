/**
 * MCP Tool Definitions for Safari Integration
 *
 * @module server/tool
 * @author AXIVO
 * @license BSD-3-Clause
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';

/**
 * MCP Tool Definitions for Safari Integration
 *
 * Provides MCP tool definitions that bridge Safari browser capabilities
 * with Model Context Protocol, enabling Claude agents to visually
 * interact with web pages.
 *
 * @class McpTool
 */
export class McpTool {
  /**
   * Creates MCP tool for clicking elements on the browser window
   *
   * Finds and clicks elements matching visible text, image alt text, aria-label,
   * or CSS selector, supporting links, buttons, images, and other clickable elements.
   *
   * @returns {Tool} MCP tool definition for clicking elements
   */
  click(): Tool {
    return {
      name: 'click',
      description: 'Click an element on the browser window',
      inputSchema: {
        type: 'object',
        properties: {
          key: { type: 'string', description: 'Key to press (e.g., Escape, ArrowRight, ArrowLeft, Enter, Tab)' },
          selector: { type: 'string', description: 'CSS selector to click when no text provided or to scope the text search' },
          text: { type: 'string', description: 'Text to match - visible text, image alt text, or aria-label' },
          wait: { type: 'string', description: 'CSS selector to wait for after click' },
          x: { type: 'number', description: 'X coordinate (pixels from left of viewport) to click at' },
          y: { type: 'number', description: 'Y coordinate (pixels from top of viewport) to click at' }
        }
      },
      _meta: {
        usage: [
          'Match aria-label attributes for buttons like Next, Previous, Close using `text` parameter',
          'Never guess CSS selectors based on assumed page structure',
          'Prefer `text` over `selector` parameter for matching elements',
          'Read the page before clicking to identify available elements',
          'Take a screenshot after clicking only when visual verification is needed',
          'Use descriptive text fragments from read output to avoid ambiguous matches',
          'Try first `key` parameter to press ArrowRight, ArrowLeft, Enter, Escape, or Tab on current page',
          'Try first `key: "Escape"` then `text: "Close"` parameter values to close overlays or panels on current page',
          'Use `text: "Next"` and `text: "Previous"` parameter values to navigate between items in image detail panels and carousels',
          'Use `x` and `y` coordinates from screenshots to click visual elements without text'
        ]
      }
    };
  }

  /**
   * Creates MCP tool for closing the Safari window
   *
   * Terminates the active browser session and closes the Safari window.
   *
   * @returns {Tool} MCP tool definition for closing the browser
   */
  close(): Tool {
    return {
      name: 'close',
      description: 'Close the browser window',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    };
  }

  /**
   * Creates MCP tool for executing JavaScript in the browser context
   *
   * Runs arbitrary JavaScript on the current page,
   * returning the script's result.
   *
   * @returns {Tool} MCP tool definition for JavaScript execution
   */
  execute(): Tool {
    return {
      name: 'execute',
      description: 'Execute JavaScript in the browser context',
      inputSchema: {
        type: 'object',
        properties: {
          script: { type: 'string', description: 'JavaScript code to execute' }
        },
        required: ['script']
      },
      _meta: {
        usage: [
          'Avoid using `execute` tool to inspect DOM structure for click targets',
          'Prefer `click` tool with `text` parameter and `read` tool for page interaction',
          'Reserve `execute` tool for operations not covered by other tools'
        ]
      }
    };
  }

  /**
   * Aggregates all available MCP tools into comprehensive registry
   *
   * Returns complete collection of Safari MCP tool definitions
   * for browser automation and visual web access.
   *
   * @returns {Tool[]} Complete array of all available MCP tool definitions
   */
  getTools(): Tool[] {
    return [
      this.click(),
      this.close(),
      this.execute(),
      this.navigate(),
      this.open(),
      this.read(),
      this.screenshot(),
      this.search(),
      this.type()
    ];
  }

  /**
   * Creates MCP tool for navigating to a URL or through browser history
   *
   * Navigates Safari to the specified URL, or backward/forward through
   * browser history. Optionally waits for a CSS selector after page load.
   * Returns the page title, final URL, ready state, and viewport page count.
   *
   * @returns {Tool} MCP tool definition for URL navigation
   */
  navigate(): Tool {
    return {
      name: 'navigate',
      description: 'Navigate to a URL or through browser history (back/forward)',
      inputSchema: {
        type: 'object',
        properties: {
          direction: { type: 'string', enum: ['back', 'forward'], description: 'Navigate back or forward in browser history' },
          page: { type: 'number', description: 'Scroll to a specific viewport-sized page number' },
          selector: { type: 'string', description: 'CSS selector to wait for after page load' },
          steps: { type: 'number', description: 'Number of steps for back/forward navigation', default: 1 },
          url: { type: 'string', description: 'URL to navigate to' }
        }
      },
      _meta: {
        usage: [
          'Read the page after navigation to understand available content',
          'Use `direction` parameter for history navigation instead of re-entering URLs',
          'Use `page` parameter to scroll to specific viewport sections'
        ]
      }
    };
  }

  /**
   * Creates MCP tool for opening a Safari window
   *
   * Opens a new Safari browser window with configured dimensions,
   * ready for navigation and interaction.
   *
   * @returns {Tool} MCP tool definition for opening the browser
   */
  open(): Tool {
    return {
      name: 'open',
      description: 'Open a browser window and read `_meta.usage` tools guidance',
      inputSchema: {
        type: 'object',
        properties: {}
      },
      _meta: {
        usage: [
          'Stop and process all `_meta.usage` tools guidance before using any tools to avoid mistakes'
        ]
      }
    };
  }

  /**
   * Creates MCP tool for reading page content
   *
   * Extracts the page title, current URL, and visible text content
   * from the current page or a specific element.
   *
   * @returns {Tool} MCP tool definition for page content reading
   */
  read(): Tool {
    return {
      name: 'read',
      description: 'Get the page title, URL, full text content, and count for viewport-sized screenshots',
      inputSchema: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'CSS selector to scope text extraction' }
        }
      },
      _meta: {
        usage: [
          'Read the page after navigation to understand available content',
          'Use `selector` parameter to scope extraction to specific page sections'
        ]
      }
    };
  }

  /**
   * Creates MCP tool for capturing page screenshots
   *
   * Captures a screenshot of the specified viewport page,
   * returning it as a base64 PNG image.
   *
   * @returns {Tool} MCP tool definition for page screenshot capture
   */
  screenshot(): Tool {
    return {
      name: 'screenshot',
      description: 'Capture the screenshot for a specific viewport-sized page',
      inputSchema: {
        type: 'object',
        properties: {
          page: { type: 'number', description: 'Page number to capture', default: 1 }
        }
      },
      _meta: {
        usage: [
          'Prefer `read` tool over `screenshot` for identifying page elements and content',
          'Use `page` parameter to scroll to and capture a specific viewport-sized page',
          'Use `screenshot` tool for visual verification of images and layouts'
        ]
      }
    };
  }

  /**
   * Creates MCP tool for searching the web
   *
   * Searches using the user's default search engine configured in Safari,
   * returning search results in the browser.
   *
   * @returns {Tool} MCP tool definition for web search
   */
  search(): Tool {
    return {
      name: 'search',
      description: "Search the web using browser's default search engine",
      inputSchema: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Search query' }
        },
        required: ['text']
      },
      _meta: {
        usage: [
          'Read the page after searching to extract results'
        ]
      }
    };
  }

  /**
   * Creates MCP tool for typing text into input elements
   *
   * Sets the value of input fields with proper event dispatching
   * for framework reactivity, with optional form submission.
   *
   * @returns {Tool} MCP tool definition for typing into inputs
   */
  type(): Tool {
    return {
      name: 'type',
      description: 'Type text into a page input field',
      inputSchema: {
        type: 'object',
        properties: {
          append: { type: 'boolean', description: 'Append to existing value instead of replacing', default: false },
          selector: { type: 'string', description: 'CSS selector for the target input' },
          submit: { type: 'boolean', description: 'Submit form by pressing Enter after typing', default: false },
          text: { type: 'string', description: 'Text to type' }
        },
        required: ['text']
      },
      _meta: {
        usage: [
          'Read the page before typing to identify available input fields',
          'Use `submit` parameter to submit forms instead of separate click actions'
        ]
      }
    };
  }
}
