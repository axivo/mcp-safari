/**
 * Safari MCP Server implementation
 *
 * @module server/mcp
 * @author AXIVO
 * @license BSD-3-Clause
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequest,
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { Client } from './client.js';
import { McpTool } from './tool.js';

interface ClickArgs {
  text: string;
  selector?: string;
}

interface ExecuteArgs {
  script: string;
}

interface NavigateArgs {
  direction?: 'back' | 'forward';
  page?: number;
  selector?: string;
  steps?: number;
  url?: string;
}

interface ReadArgs {
  selector?: string;
}

interface ScreenshotArgs {
  page?: number;
}

interface TypeArgs {
  text: string;
  selector?: string;
  submit?: boolean;
}

type ToolHandler = (args: any) => Promise<any>;

/**
 * Safari MCP Server implementation bridging Safari browser with Model Context Protocol
 *
 * Provides visual web access through MCP tools, managing AppleScript
 * automation, request routing, and response formatting.
 *
 * @class Mcp
 */
export class Mcp {
  private client: Client;
  private server: McpServer;
  private tool: McpTool;
  private toolHandlers: Map<string, ToolHandler>;

  /**
   * Creates a new Mcp instance with tool setup
   *
   * Initializes AppleScript client, MCP server, and tool registry.
   * Sets up handler mappings and prepares for transport connection.
   */
  constructor() {
    this.client = new Client();
    this.server = new McpServer(
      { name: 'safari', version: this.client.version() },
      { capabilities: { tools: {} } }
    );
    this.tool = new McpTool();
    this.toolHandlers = new Map<string, ToolHandler>();
    this.setupToolHandlers();
    this.setupHandlers();
  }

  /**
   * Handles click tool requests
   *
   * @private
   * @param {ClickArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleClick(args: ClickArgs): Promise<any> {
    const error = this.validate(args, ['text']);
    if (error) {
      return error;
    }
    return await this.client.clickElement(args.text, args.selector);
  }

  /**
   * Handles close tool requests
   *
   * @private
   * @returns {Promise<any>} Tool execution response
   */
  private async handleClose(): Promise<any> {
    await this.client.closeSession();
    return 'Safari window closed';
  }

  /**
   * Handles execute tool requests
   *
   * @private
   * @param {ExecuteArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleExecute(args: ExecuteArgs): Promise<any> {
    const error = this.validate(args, ['script']);
    if (error) {
      return error;
    }
    const result = await this.client.executeScript(args.script);
    return result;
  }

  /**
   * Handles navigate tool requests
   *
   * @private
   * @param {NavigateArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleNavigate(args: NavigateArgs): Promise<any> {
    let selectorFound: boolean | undefined;
    if (args.url) {
      selectorFound = await this.client.navigateTo(args.url, args.selector);
    } else if (args.direction) {
      const steps = args.direction === 'back' ? -(args.steps!) : args.steps!;
      selectorFound = await this.client.goHistory(steps, args.selector);
    } else if (args.page) {
      await this.client.scrollToPage(args.page);
    } else {
      return 'Missing required arguments: url, direction, or page';
    }
    const title = await this.client.getTitle();
    const url = await this.client.getUrl();
    const readyState = await this.client.executeScript('document.readyState');
    const { pages } = await this.client.getPageInfo();
    const response: Record<string, any> = { title, url, readyState, pages };
    if (args.selector) {
      response.selectorFound = selectorFound;
    }
    return response;
  }

  /**
   * Handles open tool requests
   *
   * @private
   * @returns {Promise<any>} Tool execution response
   */
  private async handleOpen(): Promise<any> {
    await this.client.openSession();
    return 'Safari window opened';
  }

  /**
   * Handles read tool requests
   *
   * @private
   * @param {ReadArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleRead(args: ReadArgs): Promise<any> {
    const title = await this.client.getTitle();
    const url = await this.client.getUrl();
    const escaped = args.selector ? args.selector.replace(/\\/g, '\\\\').replace(/'/g, "\\'") : '';
    const textScript = args.selector
      ? `(document.querySelector('${escaped}') || {}).innerText || ''`
      : 'document.body.innerText';
    const text = await this.client.executeScript(textScript);
    const { pages } = await this.client.getPageInfo();
    return { title, url, text, pages };
  }

  /**
   * Handles tool execution requests from MCP clients
   *
   * @private
   * @param {CallToolRequest} request - The tool execution request
   * @returns {Promise<Object>} Response containing tool execution results
   */
  private async handleRequest(request: CallToolRequest): Promise<any> {
    const handler = this.toolHandlers.get(request.params.name);
    if (!handler) {
      return this.client.response(`Unknown tool: ${request.params.name}`);
    }
    try {
      const result = await handler(request.params.arguments || {});
      if (result?.content) {
        return result;
      }
      return this.client.response(result, typeof result === 'string' ? false : true);
    } catch (error) {
      return this.client.response(`Error: ${(error as Error).message}`);
    }
  }

  /**
   * Handles screenshot tool requests
   *
   * @private
   * @param {ScreenshotArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleScreenshot(args: ScreenshotArgs): Promise<any> {
    const base64Png = await this.client.takeScreenshot(args.page!);
    const { scrollHeight, innerHeight, pages } = await this.client.getPageInfo();
    return {
      content: [
        { type: 'image', data: base64Png, mimeType: 'image/png' },
        { type: 'text', text: JSON.stringify({ scrollHeight, innerHeight, pages }) }
      ]
    };
  }

  /**
   * Handles type tool requests
   *
   * @private
   * @param {TypeArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleType(args: TypeArgs): Promise<any> {
    const error = this.validate(args, ['text']);
    if (error) {
      return error;
    }
    return await this.client.typeText(args.text, args.selector, args.submit);
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
    this.server.server.setRequestHandler(CallToolRequestSchema, this.handleRequest.bind(this));
    this.server.server.setRequestHandler(ListToolsRequestSchema, this.handleTools.bind(this));
  }

  /**
   * Sets up tool handlers registry with default value injection
   *
   * Registers all tool handlers with argument processing that injects
   * default values from tool schema definitions before execution.
   *
   * @private
   */
  private setupToolHandlers(): void {
    const tools = this.setServerTools();
    for (const { tool, handler } of tools) {
      const wrappedHandler: ToolHandler = async (args: unknown) => {
        const processedArgs = args as Record<string, unknown>;
        const properties = tool.inputSchema?.properties;
        if (properties) {
          Object.entries(properties).forEach(([name, value]) => {
            const schema = value as { default?: unknown };
            if (processedArgs[name] === undefined && schema.default !== undefined) {
              processedArgs[name] = schema.default;
            }
          });
        }
        return await handler(processedArgs);
      };
      this.toolHandlers.set(tool.name, wrappedHandler);
    }
  }

  /**
   * Maps tool definitions to corresponding handler functions
   *
   * Creates comprehensive mapping between tool definitions and handlers,
   * enabling dynamic default value injection from tool schemas.
   *
   * @private
   * @returns {{ tool: Tool; handler: ToolHandler }[]} Array of tool-to-handler mappings
   */
  private setServerTools(): { tool: Tool; handler: ToolHandler }[] {
    return [
      { tool: this.tool.click(), handler: this.handleClick.bind(this) },
      { tool: this.tool.close(), handler: this.handleClose.bind(this) },
      { tool: this.tool.execute(), handler: this.handleExecute.bind(this) },
      { tool: this.tool.navigate(), handler: this.handleNavigate.bind(this) },
      { tool: this.tool.open(), handler: this.handleOpen.bind(this) },
      { tool: this.tool.read(), handler: this.handleRead.bind(this) },
      { tool: this.tool.screenshot(), handler: this.handleScreenshot.bind(this) },
      { tool: this.tool.type(), handler: this.handleType.bind(this) }
    ];
  }

  /**
   * Validates required arguments for tool handler methods using Zod schemas
   *
   * Performs runtime validation of tool arguments against required field specifications,
   * ensuring type safety and proper error handling for missing parameters.
   *
   * @private
   * @param {unknown} args - Tool arguments object to validate
   * @param {string[]} fields - Array of required field names for validation
   * @returns {string | null} Error message if validation fails, null if all requirements met
   */
  private validate(args: unknown, fields: string[]): string | null {
    const type: Record<string, z.ZodType> = {};
    for (const field of fields) {
      type[field] = z.union([
        z.number(),
        z.string().min(1)
      ]);
    }
    const schema = z.object(type);
    const result = schema.safeParse(args);
    if (!result.success) {
      const missing = result.error.issues.map(issue => issue.path[0]);
      return `Missing required arguments: ${missing.join(', ')}`;
    }
    return null;
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
