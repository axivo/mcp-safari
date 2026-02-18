/**
 * MCP Tool Definitions for Safari Integration
 *
 * @module server/tool
 * @author AXIVO
 * @license BSD-3-Clause
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';

/**
 * MCP Tool Definitions for Safari WebDriver Integration
 *
 * Provides MCP tool definitions that bridge Safari browser capabilities
 * with Model Context Protocol, enabling Claude agents to visually
 * interact with web pages.
 *
 * @class McpTool
 */
export class McpTool {
  /**
   * Creates MCP tool for executing JavaScript in the browser context
   *
   * Enables running arbitrary JavaScript on a web page after navigating
   * to the specified URL, returning the script's result.
   *
   * @returns {Tool} MCP tool definition for JavaScript execution
   */
  execute(): Tool {
    return {
      name: 'execute',
      description: 'Navigate to a URL and execute JavaScript in the browser context',
      inputSchema: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The URL to navigate to' },
          script: { type: 'string', description: 'The JavaScript code to execute' }
        },
        required: ['url', 'script']
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
      this.execute(),
      this.navigate(),
      this.read(),
      this.screenshot()
    ];
  }

  /**
   * Creates MCP tool for navigating to a URL
   *
   * Navigates Safari to the specified URL and returns
   * confirmation with the page title and final URL.
   *
   * @returns {Tool} MCP tool definition for URL navigation
   */
  navigate(): Tool {
    return {
      name: 'navigate',
      description: 'Navigate to a URL and return the page title and final URL',
      inputSchema: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The URL to navigate to' }
        },
        required: ['url']
      }
    };
  }

  /**
   * Creates MCP tool for reading page content
   *
   * Navigates to the specified URL and extracts the page title,
   * current URL, and visible text content.
   *
   * @returns {Tool} MCP tool definition for page content reading
   */
  read(): Tool {
    return {
      name: 'read',
      description: 'Navigate to a URL and get the page title, URL, and text content',
      inputSchema: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The URL to navigate to' }
        },
        required: ['url']
      }
    };
  }

  /**
   * Creates MCP tool for capturing page screenshots
   *
   * Navigates to the specified URL and captures a screenshot
   * of the visible page, returning it as a base64 PNG image.
   *
   * @returns {Tool} MCP tool definition for page screenshot capture
   */
  screenshot(): Tool {
    return {
      name: 'screenshot',
      description: 'Navigate to a URL and capture a screenshot of the visible page',
      inputSchema: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The URL to navigate to' }
        },
        required: ['url']
      }
    };
  }
}
