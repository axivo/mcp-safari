/**
 * Safari MCP Server implementation
 *
 * @module server/mcp
 * @author AXIVO
 * @license BSD-3-Clause
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequest,
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { Client } from './client.js';
import { McpTool } from './tool.js';

interface ExecuteArgs {
  url: string;
  script: string;
}

interface NavigateArgs {
  url: string;
}

interface ReadArgs {
  url: string;
}

interface ScreenshotArgs {
  url: string;
}

type ToolHandler = (args: any) => Promise<any>;

/**
 * Safari MCP Server implementation bridging Safari browser with Model Context Protocol
 *
 * Provides visual web access through MCP tools, managing SafariDriver
 * communication, request routing, and response formatting.
 *
 * @class McpServer
 */
export class McpServer {
  private client: Client;
  private server: Server;
  private tool: McpTool;
  private toolHandlers: Map<string, ToolHandler>;

  /**
   * Creates a new McpServer instance with tool setup
   *
   * Initializes SafariDriver client, MCP server, and tool registry.
   * Sets up handler mappings and prepares for transport connection.
   */
  constructor() {
    this.client = new Client();
    this.server = new Server(
      { name: 'safari', version: this.client.version() },
      { capabilities: { tools: {} } }
    );
    this.tool = new McpTool();
    this.toolHandlers = new Map<string, ToolHandler>();
    this.setupToolHandlers();
    this.setupHandlers();
  }

  /**
   * Handles execute tool requests
   *
   * @private
   * @param {ExecuteArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleExecute(args: ExecuteArgs): Promise<any> {
    if (!args.url || !args.script) {
      return 'Missing required arguments: url and script';
    }
    return this.withSession(args.url, async (sessionId) => {
      const result = await this.client.executeScript(sessionId, args.script);
      return result;
    });
  }

  /**
   * Handles navigate tool requests
   *
   * @private
   * @param {NavigateArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleNavigate(args: NavigateArgs): Promise<any> {
    if (!args.url) {
      return 'Missing required argument: url';
    }
    return this.withSession(args.url, async (sessionId) => {
      const title = await this.client.getTitle(sessionId);
      const url = await this.client.getUrl(sessionId);
      return { title, url };
    });
  }

  /**
   * Handles read tool requests
   *
   * @private
   * @param {ReadArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleRead(args: ReadArgs): Promise<any> {
    if (!args.url) {
      return 'Missing required argument: url';
    }
    return this.withSession(args.url, async (sessionId) => {
      const title = await this.client.getTitle(sessionId);
      const url = await this.client.getUrl(sessionId);
      const text = await this.client.executeScript(sessionId, 'return document.body.innerText');
      return { title, url, text };
    });
  }

  /**
   * Handles tool execution requests from MCP clients
   *
   * @private
   * @param {CallToolRequest} request - The tool execution request
   * @returns {Promise<Object>} Response containing tool execution results
   */
  private async handleRequest(request: CallToolRequest): Promise<any> {
    if (!request.params.arguments) {
      return 'No arguments provided';
    }
    const handler = this.toolHandlers.get(request.params.name);
    if (!handler) {
      return `Unknown tool: ${request.params.name}`;
    }
    const result = await handler(request.params.arguments);
    return this.client.response(result, typeof result === 'string' ? false : true);
  }

  /**
   * Handles screenshot tool requests
   *
   * @private
   * @param {ScreenshotArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleScreenshot(args: ScreenshotArgs): Promise<any> {
    if (!args.url) {
      return 'Missing required argument: url';
    }
    return this.withSession(args.url, async (sessionId) => {
      const base64Png = await this.client.takeScreenshot(sessionId);
      return this.client.imageResponse(base64Png);
    });
  }

  /**
   * Handles tool listing requests from MCP clients
   *
   * @private
   * @returns {Promise<{tools: Tool[]}>} Complete tool registry for MCP protocol
   */
  private async handleTools(): Promise<{ tools: Tool[] }> {
    return { tools: this.tool.getTools() };
  }

  /**
   * Sets up MCP request handlers for tool execution and tool listing
   *
   * @private
   */
  private setupHandlers(): void {
    this.server.setRequestHandler(CallToolRequestSchema, this.handleRequest.bind(this));
    this.server.setRequestHandler(ListToolsRequestSchema, this.handleTools.bind(this));
  }

  /**
   * Sets up tool handlers registry
   *
   * @private
   */
  private setupToolHandlers(): void {
    this.toolHandlers.set('execute', this.handleExecute.bind(this));
    this.toolHandlers.set('navigate', this.handleNavigate.bind(this));
    this.toolHandlers.set('read', this.handleRead.bind(this));
    this.toolHandlers.set('screenshot', this.handleScreenshot.bind(this));
  }

  /**
   * Executes a tool operation within an ephemeral SafariDriver session
   *
   * Creates a session, runs the operation, and tears down the session
   * regardless of success or failure.
   *
   * @private
   * @param {string} url - URL to navigate to
   * @param {Function} operation - Async operation to perform with the session
   * @returns {Promise<any>} Operation result
   */
  private async withSession(url: string, operation: (sessionId: string) => Promise<any>): Promise<any> {
    const sessionId = await this.client.createSession();
    try {
      await this.client.navigateTo(sessionId, url);
      return await operation(sessionId);
    } finally {
      await this.client.deleteSession(sessionId);
    }
  }

  /**
   * Connects the MCP server to stdio transport with error handling
   *
   * @param {StdioServerTransport} transport - Stdio transport for MCP communication
   * @returns {Promise<void>}
   */
  async connect(transport: StdioServerTransport): Promise<void> {
    transport.onerror = () => { };
    await this.server.connect(transport);
  }
}
