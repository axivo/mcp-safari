/**
 * Safari MCP Server implementation
 *
 * @module server/mcp
 * @author AXIVO
 * @license BSD-3-Clause
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { Client } from './client.js';
import { McpTool } from './tool.js';

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

  /**
   * Creates a new Mcp instance with tool setup
   *
   * Initializes AppleScript client, MCP server, and registers every
   * tool with the underlying McpServer registry.
   */
  constructor() {
    this.client = new Client();
    this.server = new McpServer(
      { name: 'safari', version: this.client.getVersion() },
      { capabilities: { tools: {} } }
    );
    this.tool = new McpTool();
    this.registerAll();
  }

  /**
   * Returns all tool definitions in a wire-friendly shape for the status tool
   *
   * Iterates every registered tool, converts each Zod input/output schema to
   * JSON Schema for portability, and lifts `_meta.usage` to a top-level `usage`
   * field for ergonomic consumption.
   *
   * @private
   * @returns {object[]} Array of tool definitions
   */
  private getToolDefinitions(): Record<string, unknown>[] {
    const entries: { name: string; config: Record<string, unknown> }[] = [
      { name: 'click', config: this.tool.click() },
      { name: 'close', config: this.tool.close() },
      { name: 'execute', config: this.tool.execute() },
      { name: 'hover', config: this.tool.hover() },
      { name: 'inspect', config: this.tool.inspect() },
      { name: 'navigate', config: this.tool.navigate() },
      { name: 'open', config: this.tool.open() },
      { name: 'read', config: this.tool.read() },
      { name: 'refresh', config: this.tool.refresh() },
      { name: 'screenshot', config: this.tool.screenshot() },
      { name: 'scroll', config: this.tool.scroll() },
      { name: 'search', config: this.tool.search() },
      { name: 'select', config: this.tool.select() },
      { name: 'status', config: this.tool.status() },
      { name: 'type', config: this.tool.type() },
      { name: 'wait', config: this.tool.wait() },
      { name: 'window', config: this.tool.window() }
    ];
    return entries.map(({ name, config }) => {
      const definition: Record<string, unknown> = {
        name,
        description: config.description ?? ''
      };
      if (config.inputSchema && Object.keys(config.inputSchema as Record<string, unknown>).length > 0) {
        definition.inputSchema = z.toJSONSchema(z.object(config.inputSchema as z.ZodRawShape));
      }
      if (config.outputSchema && Object.keys(config.outputSchema as Record<string, unknown>).length > 0) {
        definition.outputSchema = z.toJSONSchema(z.object(config.outputSchema as z.ZodRawShape));
      }
      if (config.annotations) {
        definition.annotations = config.annotations;
      }
      const meta = config._meta as { usage?: string[] } | undefined;
      if (meta?.usage) {
        definition.usage = meta.usage;
      }
      return definition;
    });
  }

  /**
   * Handles click tool requests
   *
   * @private
   * @param {object} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleClick(args: { key?: string; selector?: string; text?: string; wait?: string; x?: number; y?: number }) {
    if (!args.text && !args.selector && !args.key && (args.x === undefined || args.y === undefined)) {
      return this.client.response('Missing required arguments: text, selector, key, or x/y coordinates');
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
    const response: Record<string, unknown> = { result, title, url, pages, tabs: tabs.length };
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
    return this.client.response(response, true);
  }

  /**
   * Handles close tool requests
   *
   * Closes the working tab if one exists. The user's other tabs and
   * windows are unaffected.
   *
   * @private
   * @returns {Promise<any>} Tool execution response
   */
  private async handleClose() {
    await this.client.closeWorkingTab();
    return this.structured({ closed: true });
  }

  /**
   * Handles execute tool requests
   *
   * @private
   * @param {object} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleExecute(args: { script: string }) {
    const target = await this.client.getCurrentTab();
    const result = await this.client.executeScript(target, args.script);
    return this.client.response(result);
  }

  /**
   * Handles hover tool requests
   *
   * @private
   * @param {object} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleHover(args: { selector?: string; text?: string }) {
    if (!args.selector && !args.text) {
      return this.client.response('Missing required argument: provide either `selector` or `text`');
    }
    const result = await this.client.hover(args.selector, args.text);
    return this.client.response(result);
  }

  /**
   * Handles inspect tool requests
   *
   * @private
   * @param {object} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleInspect(args: { selector: string; index?: number }) {
    const result = await this.client.inspect(args.selector, args.index);
    return this.structured(result);
  }

  /**
   * Handles navigate tool requests
   *
   * @private
   * @param {object} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleNavigate(args: { direction?: 'back' | 'forward'; selector?: string; steps: number; url?: string }) {
    let selectorFound: boolean | undefined;
    if (args.url) {
      selectorFound = await this.client.navigateTo(args.url, args.selector);
    } else if (args.direction) {
      const steps = args.direction === 'back' ? -args.steps : args.steps;
      selectorFound = await this.client.goHistory(steps, args.selector);
    } else {
      return this.client.response('Missing required arguments: url or direction');
    }
    const title = await this.client.getTitle();
    const url = await this.client.getUrl();
    const { innerHeight, scrollHeight, scrollOffset, pages } = await this.client.getPageInfo();
    const tabs = (await this.client.listTabs()).length;
    const output: Record<string, unknown> = { title, url, pages, innerHeight, scrollHeight, scrollOffset, tabs };
    if (args.selector) {
      output.selectorFound = selectorFound;
    }
    return this.structured(output);
  }

  /**
   * Handles open tool requests
   *
   * Opens a fresh blank tab. Activates Safari and creates a window first
   * if none is open. The new tab becomes the working tab - subsequent
   * act operations (`navigate`, `click`, `type`, ...) will target it. Tool
   * surface guidance is available via the standard `tools/list` MCP
   * request.
   *
   * @private
   * @returns {Promise<any>} Tool execution response
   */
  private async handleOpen() {
    await this.client.openTab();
    return this.structured({ opened: true });
  }

  /**
   * Handles read tool requests
   *
   * @private
   * @param {object} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleRead(args: { selector?: string; index?: number; mode: 'text' | 'links' }) {
    const title = await this.client.getTitle(args.index);
    const url = await this.client.getUrl(args.index);
    const { pages } = await this.client.getPageInfo(args.index);
    const output: Record<string, unknown> = { title, url, pages };
    if (args.mode === 'links') {
      output.links = await this.client.readLinks(args.selector, args.index);
    } else {
      const escaped = args.selector ? args.selector.replace(/\\/g, '\\\\').replace(/'/g, "\\'") : '';
      const textScript = args.selector
        ? `(document.querySelector('${escaped}') || {}).innerText || ''`
        : 'document.body.innerText';
      output.text = await this.client.readScript(textScript, args.index);
    }
    const { errors, warnings } = await this.client.getConsoleErrors(args.index);
    if (errors.length) {
      output.errors = errors;
    }
    if (warnings.length) {
      output.warnings = warnings;
    }
    return this.structured(output);
  }

  /**
   * Handles refresh tool requests
   *
   * @private
   * @param {object} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleRefresh(args: { hard: boolean; selector?: string }) {
    const selectorFound = await this.client.refresh(args.hard, args.selector);
    const title = await this.client.getTitle();
    const url = await this.client.getUrl();
    const { innerHeight, scrollHeight, scrollOffset, pages } = await this.client.getPageInfo();
    const tabs = (await this.client.listTabs()).length;
    const output: Record<string, unknown> = { title, url, pages, innerHeight, scrollHeight, scrollOffset, tabs };
    if (args.selector) {
      output.selectorFound = selectorFound;
    }
    return this.structured(output);
  }

  /**
   * Handles screenshot tool requests
   *
   * @private
   * @returns {Promise<any>} Tool execution response
   */
  private async handleScreenshot() {
    const base64Png = await this.client.takeScreenshot();
    const { innerHeight, scrollHeight, pages } = await this.client.getPageInfo();
    return {
      content: [
        { type: 'image' as const, data: base64Png, mimeType: 'image/png' },
        { type: 'text' as const, text: JSON.stringify({ innerHeight, scrollHeight, pages }) }
      ]
    };
  }

  /**
   * Handles scroll tool requests
   *
   * @private
   * @param {object} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleScroll(args: { direction?: 'up' | 'down'; page?: number; pixels?: number }) {
    if (args.page !== undefined && (args.direction || args.pixels !== undefined)) {
      return this.client.response('Invalid arguments: provide either page or direction with pixels, not both');
    }
    if (args.page !== undefined) {
      await this.client.scrollToPage(args.page);
    } else if (args.direction && args.pixels !== undefined) {
      await this.client.scrollByPixels(args.direction, args.pixels);
    } else if (args.direction) {
      const { innerHeight } = await this.client.getPageInfo();
      await this.client.scrollByPixels(args.direction, innerHeight);
    } else {
      return this.client.response('Missing required arguments: page, or direction');
    }
    const { innerHeight, scrollHeight, scrollOffset, pages } = await this.client.getPageInfo();
    return this.structured({ innerHeight, scrollHeight, scrollOffset, pages });
  }

  /**
   * Handles search tool requests
   *
   * @private
   * @param {object} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleSearch(args: { text: string }) {
    await this.client.search(args.text);
    const title = await this.client.getTitle();
    const url = await this.client.getUrl();
    const { innerHeight, scrollHeight, scrollOffset, pages } = await this.client.getPageInfo();
    const tabs = (await this.client.listTabs()).length;
    return this.structured({ title, url, pages, innerHeight, scrollHeight, scrollOffset, tabs });
  }

  /**
   * Handles select tool requests
   *
   * @private
   * @param {object} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleSelect(args: { selector: string; value?: string; text?: string }) {
    if (!args.value && !args.text) {
      return this.client.response('Missing required argument: provide either `value` or `text`');
    }
    const result = await this.client.selectOption(args.selector, args.value, args.text);
    return this.client.response(result);
  }

  /**
   * Handles status tool requests
   *
   * Returns current Safari tabs and the full tool surface in one payload.
   * Designed for session-start orientation: the calling instance learns
   * what tools exist (with usage guidance) and what is currently open.
   *
   * @private
   * @returns {Promise<any>} Tool execution response
   */
  private async handleStatus() {
    const tabs = await this.client.listFrontTabs();
    const tools = this.getToolDefinitions();
    return this.structured({ tabs, tools });
  }

  /**
   * Handles type tool requests
   *
   * @private
   * @param {object} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleType(args: { text: string; append: boolean; selector?: string; submit: boolean }) {
    const result = await this.client.typeText(args.text, args.selector, args.append, args.submit);
    return this.client.response(result);
  }

  /**
   * Handles wait tool requests
   *
   * @private
   * @param {object} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleWait(args: { selector?: string; selectorGone?: string; text?: string; timeoutMs?: number }) {
    const provided = [args.selector, args.selectorGone, args.text].filter((v) => v !== undefined && v !== '').length;
    if (provided !== 1) {
      return this.client.response('Missing or ambiguous argument: provide exactly one of `selector`, `selectorGone`, or `text`');
    }
    const result = await this.client.wait(args);
    return this.structured(result);
  }

  /**
   * Handles window tool requests
   *
   * @private
   * @param {object} args - Tool arguments
   * @returns {Promise<any>} Tool execution response
   */
  private async handleWindow(args: { action: 'close' | 'list' | 'open' | 'switch'; index?: number; url?: string }) {
    switch (args.action) {
      case 'list': {
        const tabs = await this.client.listTabs();
        return this.structured({ tabs });
      }
      case 'switch': {
        if (args.index === undefined) {
          return this.client.response('Missing required argument: index');
        }
        await this.client.switchTab(args.index);
        const tabs = await this.client.listTabs();
        return this.structured({ tabs });
      }
      case 'close': {
        if (args.index === undefined) {
          return this.client.response('Missing required argument: index');
        }
        await this.client.closeTab(args.index);
        const tabs = await this.client.listTabs();
        return this.structured({ tabs });
      }
      case 'open': {
        await this.client.openTab(args.url);
        const tabs = await this.client.listTabs();
        return this.structured({ tabs });
      }
    }
  }

  /**
   * Registers every tool with the McpServer registry
   *
   * Each call wires a tool definition from `McpTool` to its handler.
   * The SDK validates incoming arguments against the tool's `inputSchema`
   * and (when present) the tool's response against its `outputSchema`.
   *
   * @private
   */
  private registerAll(): void {
    this.server.registerTool('click', this.tool.click(), this.handleClick.bind(this));
    this.server.registerTool('close', this.tool.close(), this.handleClose.bind(this));
    this.server.registerTool('execute', this.tool.execute(), this.handleExecute.bind(this));
    this.server.registerTool('hover', this.tool.hover(), this.handleHover.bind(this));
    this.server.registerTool('inspect', this.tool.inspect(), this.handleInspect.bind(this));
    this.server.registerTool('navigate', this.tool.navigate(), this.handleNavigate.bind(this));
    this.server.registerTool('open', this.tool.open(), this.handleOpen.bind(this));
    this.server.registerTool('read', this.tool.read(), this.handleRead.bind(this));
    this.server.registerTool('refresh', this.tool.refresh(), this.handleRefresh.bind(this));
    this.server.registerTool('screenshot', this.tool.screenshot(), this.handleScreenshot.bind(this));
    this.server.registerTool('scroll', this.tool.scroll(), this.handleScroll.bind(this));
    this.server.registerTool('search', this.tool.search(), this.handleSearch.bind(this));
    this.server.registerTool('select', this.tool.select(), this.handleSelect.bind(this));
    this.server.registerTool('status', this.tool.status(), this.handleStatus.bind(this));
    this.server.registerTool('type', this.tool.type(), this.handleType.bind(this));
    this.server.registerTool('wait', this.tool.wait(), this.handleWait.bind(this));
    this.server.registerTool('window', this.tool.window(), this.handleWindow.bind(this));
  }
  /**
   * Builds an output payload for tool responses with structured content
   *
   * @private
   * @param {object} output - Structured output payload
   * @returns {object} CallToolResult with both text content and structuredContent
   */
  private structured<T extends Record<string, unknown>>(output: T): { content: { type: 'text'; text: string }[]; structuredContent: T } {
    return {
      content: [{ type: 'text', text: JSON.stringify(output) }],
      structuredContent: output
    };
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
