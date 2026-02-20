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
   * Creates MCP tool for clicking elements by visible text or CSS selector
   *
   * Finds and clicks elements matching the specified text content or CSS selector,
   * supporting links, buttons, and other clickable elements.
   *
   * @returns {Tool} MCP tool definition for clicking elements
   */
  click(): Tool {
    return {
      name: 'click',
      description: 'Click an element on the page by its visible text content',
      inputSchema: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'CSS selector for the element to click' },
          text: { type: 'string', description: 'Visible text of the element to click' },
          wait: { type: 'string', description: 'CSS selector to wait for after click' }
        },
        required: ['text']
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
      this.search(),
      this.screenshot(),
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
      description: 'Open a browser window',
      inputSchema: {
        type: 'object',
        properties: {}
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
      }
    };
  }
}
