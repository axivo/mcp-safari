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
  key?: string;
  selector?: string;
  text?: string;
  wait?: string;
  x?: number;
  y?: number;
}

interface ExecuteArgs {
  script: string;
}

interface NavigateArgs {
  direction?: 'back' | 'forward';
  selector?: string;
  steps?: number;
  url?: string;
}

interface ReadArgs {
  selector?: string;
}

interface RefreshArgs {
  hard?: boolean;
  selector?: string;
}

interface ScrollArgs {
  direction?: 'up' | 'down';
  page?: number;
  pixels?: number;
}

interface SearchArgs {
  text: string;
}

interface TypeArgs {
  text: string;
  append?: boolean;
  selector?: string;
  submit?: boolean;
}

interface WindowArgs {
  action: 'close' | 'list' | 'open' | 'switch';
  index?: number;
  url?: string;
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
    if (!args.text && !args.selector && !args.key && (args.x === undefined || args.y === undefined)) {
      return 'Missing required arguments: text, selector, key, or x/y coordinates';
    }
    const openTitle = await this.client.getTitle();
    const openUrl = await this.client.getUrl();
    const { pages: openPages } = await this.client.getPageInfo();
    const openTabs = (await this.client.listTabs()).length;
    let result: string;
    let selectorFound: boolean | undefined;
    if (args.key) {
      result = await this.client.keypress(args.key, args.selector);
    } else {
      ({ result, selectorFound } = await this.client.clickElement(args.selector, args.text, args.wait, args.x, args.y));
    }
    const title = await this.client.getTitle();
    const url = await this.client.getUrl();
    const { pages } = await this.client.getPageInfo();
    const tabs = await this.client.listTabs();
    const response: Record<string, any> = { result, title, url, pages, tabs: tabs.length };
    if (args.wait) {
      response.selectorFound = selectorFound;
    }
    const changes: string[] = [];
    if (openTitle !== title) {
      changes.push('title changed');
    }
    if (openUrl !== url) {
      changes.push('url changed');
    }
    if (openPages !== pages) {
      changes.push(`pages changed from ${openPages} to ${pages}`);
    }
    if (openTabs !== tabs.length) {
      changes.push(`tabs changed from ${openTabs} to ${tabs.length}`);
      response.tabList = tabs;
    }
    if (changes.length) {
      response.changes = changes;
    }
    return response;
  }

  /**
   * Handles close tool requests
   *
   * @private
   * @returns {Promise<any>} Tool execution response
   */
  private async handleClose(): Promise<any> {
    await this.client.closeSession();
    return { content: [{ type: 'text', text: JSON.stringify({ tabs: 0 }) }] };
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
    } else {
      return 'Missing required arguments: url or direction';
    }
    const title = await this.client.getTitle();
    const url = await this.client.getUrl();
    const { innerHeight, scrollHeight, pages } = await this.client.getPageInfo();
    const tabs = (await this.client.listTabs()).length;
    const response: Record<string, any> = { title, url, pages, innerHeight, scrollHeight, tabs };
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
    const tools = this.setServerTools().map(({ tool }) => tool);
    return {
      tabs: 1,
      tools
    };
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
    const response: Record<string, any> = { title, url, text, pages };
    const { errors, warnings } = await this.client.getConsoleErrors();
    if (errors.length) {
      response.errors = errors;
    }
    if (warnings.length) {
      response.warnings = warnings;
    }
    return response;
  }

  /**
   * Handles refresh tool requests
   *
   * @private
   * @param {RefreshArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleRefresh(args: RefreshArgs): Promise<any> {
    let selectorFound: boolean | undefined;
    selectorFound = await this.client.refresh(args.hard, args.selector);
    const title = await this.client.getTitle();
    const url = await this.client.getUrl();
    const { innerHeight, scrollHeight, pages } = await this.client.getPageInfo();
    const tabs = (await this.client.listTabs()).length;
    const response: Record<string, any> = { title, url, pages, innerHeight, scrollHeight, tabs };
    if (args.selector) {
      response.selectorFound = selectorFound;
    }
    return response;
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
   * Handles scroll tool requests
   *
   * @private
   * @param {ScrollArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleScroll(args: ScrollArgs): Promise<any> {
    if (args.page !== undefined && (args.direction || args.pixels !== undefined)) {
      return 'Invalid arguments: provide either page or direction with pixels, not both';
    }
    if (args.page !== undefined) {
      await this.client.scrollToPage(args.page);
    } else if (args.direction && args.pixels !== undefined) {
      await this.client.scrollByPixels(args.direction, args.pixels);
    } else if (args.direction) {
      const { innerHeight } = await this.client.getPageInfo();
      await this.client.scrollByPixels(args.direction, innerHeight);
    } else {
      return 'Missing required arguments: page, or direction';
    }
    const { innerHeight, scrollHeight, scrollOffset, pages } = await this.client.getPageInfo();
    return { innerHeight, scrollHeight, scrollOffset, pages };
  }

  /**
   * Handles screenshot tool requests
   *
   * @private
   * @returns {Promise<any>} Tool execution response
   */
  private async handleScreenshot(): Promise<any> {
    const base64Png = await this.client.takeScreenshot();
    const { innerHeight, scrollHeight, pages } = await this.client.getPageInfo();
    return {
      content: [
        { type: 'image', data: base64Png, mimeType: 'image/png' },
        { type: 'text', text: JSON.stringify({ innerHeight, scrollHeight, pages }) }
      ]
    };
  }

  /**
   * Handles search tool requests
   *
   * @private
   * @param {SearchArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleSearch(args: SearchArgs): Promise<any> {
    const error = this.validate(args, ['text']);
    if (error) {
      return error;
    }
    await this.client.search(args.text);
    const title = await this.client.getTitle();
    const url = await this.client.getUrl();
    const { innerHeight, scrollHeight, pages } = await this.client.getPageInfo();
    const tabs = (await this.client.listTabs()).length;
    return { title, url, pages, innerHeight, scrollHeight, tabs };
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
    return await this.client.typeText(args.text, args.selector, args.append, args.submit);
  }

  /**
   * Handles window tool requests
   *
   * @private
   * @param {WindowArgs} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleWindow(args: WindowArgs): Promise<any> {
    const error = this.validate(args, ['action']);
    if (error) {
      return error;
    }
    switch (args.action) {
      case 'list':
        return { tabs: await this.client.listTabs() };
      case 'switch':
        if (args.index === undefined) {
          return 'Missing required argument: index';
        }
        await this.client.switchTab(args.index);
        return { tabs: await this.client.listTabs() };
      case 'close':
        if (args.index === undefined) {
          return 'Missing required argument: index';
        }
        await this.client.closeTab(args.index);
        return { tabs: await this.client.listTabs() };
      case 'open':
        await this.client.openTab(args.url);
        return { tabs: await this.client.listTabs() };
      default:
        return `Unknown action: ${args.action}`;
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
      { tool: this.tool.refresh(), handler: this.handleRefresh.bind(this) },
      { tool: this.tool.screenshot(), handler: this.handleScreenshot.bind(this) },
      { tool: this.tool.scroll(), handler: this.handleScroll.bind(this) },
      { tool: this.tool.search(), handler: this.handleSearch.bind(this) },
      { tool: this.tool.type(), handler: this.handleType.bind(this) },
      { tool: this.tool.window(), handler: this.handleWindow.bind(this) }
    ];
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
