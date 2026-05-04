# Project Instructions

A MCP (Model Context Protocol) server bridging Safari with Claude agents. Published to npm as `@axivo/mcp-safari` and consumed by MCP-capable hosts (Claude Code, Claude Desktop) via stdio transport.

## Collaborator

- **Name:** Floren Munteanu
- **Work:** Engineering

### Personal Preferences

I'm a site reliability engineer specialized in:

- Advanced GitHub actions based on JS code
- Helm charts
- IaC for Kubernetes clusters
- Next.js/Nextra static websites

## Architecture

A small TypeScript server, ~2,800 lines of source, that translates MCP tool calls into Safari automation. There is no daemon, no listening socket, no HTTP server - the host (e.g., Claude Code) spawns the server as a child process, communicates over stdio, and tears it down when the host exits. The server controls the user's actual Safari session through Apple Events (AppleScript and JXA), so cookies, login state, and browsing history are preserved across calls.

The server's job is small and focused: accept a tool call from the host, drive Safari to perform it, return a structured response. No state is persisted across server restarts. There is no authentication layer between host and server because there is no transport-level access - whoever controls the MCP client controls the server entirely. Security relies on the host enforcing tool boundaries and on the user trusting the MCP client they configure.

### Directory Tree

```
.
├── package.json                          npm metadata, single runtime dep on @modelcontextprotocol/sdk + zod
├── tsconfig.json                         strict TypeScript, ES2022 target, NodeNext modules, DOM lib for browser-side scripts
├── CHANGELOG.md                          Keep a Changelog format, semver
├── README.md                             user-facing install + tool reference
├── SECURITY.md                           threat model, supply-chain integrity policy
├── LICENSE                               BSD-3-Clause
├── .github/
│   ├── workflows/package.yml             trusted-publish to npm on `v*` tag push (no PAT, OIDC provenance)
│   ├── renovate.json5                    dependency dashboard config
│   └── pull_request_template.md
├── .vscode/
│   ├── settings.json                     editor formatting, 2-space indent, format-on-save
│   └── extensions.json                   recommended extensions
└── src/
    ├── index.ts                          entry point - stdio transport + Mcp class instantiation, EPIPE handling
    ├── server/
    │   ├── mcp.ts                        Mcp class - registers tools via McpServer.registerTool, owns dispatch
    │   ├── tool.ts                       McpTool class - tool definitions (Zod input/output schemas, _meta.usage, annotations)
    │   └── client.ts                     Client class - working tab capture, act/observe target dispatch, AppleScript/JXA invocation, response normalization
    └── lib/
        ├── automation.ts                 Automation class - AppleScript template strings parsed into a Map at construction
        └── browser.ts                    Browser class - JavaScript scripts (function bodies serialized via fn.toString()) for `do JavaScript` execution
```

### Three-Class Server

The server splits into three classes with sharp boundaries. Each owns one concern; nothing leaks across.

- **`Mcp` (`src/server/mcp.ts`)** - wires the SDK to handlers. Owns the `McpServer` instance, registers tools via `registerTool`, dispatches calls to `handle*` methods. No domain logic; no Safari knowledge. The constructor instantiates `Client` and `McpTool`, then calls `registerAll()` once.
- **`McpTool` (`src/server/tool.ts`)** - pure tool definitions. Each method returns a literal config object (description, Zod input/output schemas, `ToolAnnotations`, `_meta.usage`) consumed by `registerTool`. Return types are intentionally inferred (not annotated as a wide alias) so TypeScript captures each tool's specific input shape and propagates it to handler signatures.
- **`Client` (`src/server/client.ts`)** - Safari domain ops. Spawns `osascript` for AppleScript and JXA, captures and tracks the working tab as a `(windowId, tabIndex)` pair, dispatches between act and observe targets via `getCurrentTab()` (act) and `resolveTarget()` (observe), waits for page loads, captures console errors, takes screenshots. Every method that touches Safari goes through `appleScript()` or `executeScript()`.

### Act vs Observe Target Resolution

`Client` distinguishes two ways of identifying which tab a tool acts on:

- **Act operations** (`navigate`, `click`, `type`, `scroll`, `refresh`, `execute`, `hover`, `select`, `goHistory`, `keypress`) call `getCurrentTab()`. This returns the captured working tab `(windowId, tabIndex)`, creating one via `openTab()` if absent or if `tabExists` reports the captured tab is gone. After resolution, the working tab is set as the front tab of its window so the user sees what is being acted on.
- **Observe operations** (`getTitle`, `getUrl`, `getPageInfo`, `getConsoleErrors`, `listTabs`, `takeScreenshot`, `readScript`, `readLinks`, `inspect`, `wait`) call `resolveTarget(index?)`. Without `index` this returns the front window's current tab (the user's focus). With `index` it targets a specific tab in the front window without changing focus. Observe operations never create or claim windows or tabs.

This split is what makes the user's mental model work: act operations always operate on Claude's tab; observe operations follow the user's focus, so the user can switch tabs in Safari to point Claude at content for inspection. The captured working tab is unaffected by user focus changes; only an explicit `openTab()` (via `open` tool or `window action: open`) updates it.

### AppleScript and Browser Bridge

Two helper classes generate the strings that get evaluated in foreign contexts.

- **`Automation` (`src/lib/automation.ts`)** - produces AppleScript and JXA strings. The constructor parses an embedded `osaScripts` template into a `Map<string, string>` keyed by section name (`activate`, `closeTab`, `executeScript`, ...). Each method looks up its section and substitutes `{{PLACEHOLDER}}` tokens. Plain text manipulation; no DOM types needed.
- **`Browser` (`src/lib/browser.ts`)** - produces JavaScript strings that run inside Safari's page context via `do JavaScript`. Each method authors a real function (with type annotations and editor support) and serializes it via `fn.toString()` wrapped as an IIFE, with arguments JSON-stringified for safe injection. TypeScript types in these inner functions are erased at compile time, so the runtime payload is plain JavaScript identical to the source. Custom window properties (`__safariErrors`, `__safariWarnings`) are typed via a top-level `declare global` block.

The serialization pattern lets you write browser-side code that looks and types like ordinary TypeScript while ultimately running as a string blob inside the Safari tab.

### Server Lifecycle

The server is a one-shot child process. It does not retain state across restarts.

1. **Spawn.** Host invokes `npx @axivo/mcp-safari` (or the locally cached binary). `dist/index.js` runs.
2. **Boot.** `index.ts` registers `uncaughtException` and `unhandledRejection` handlers that swallow EPIPE specifically (so a stdout pipe closing on the host side doesn't crash the server). It instantiates `Mcp`, which builds the underlying `McpServer`, the `Client`, and the `McpTool` registry, then calls `registerAll()` to wire each tool to its handler.
3. **Connect.** A `StdioServerTransport` is constructed and passed to `Mcp.connect()`, which delegates to `McpServer.connect()`. The server starts listening for JSON-RPC messages on stdin.
4. **Handle.** Each `tools/call` request is validated by the SDK against the tool's `inputSchema` (Zod) and routed to the registered handler. The handler invokes `Client` methods, builds a structured response, and returns. The SDK validates structured responses against `outputSchema` when present.
5. **Exit.** When the host closes stdin, the SDK closes the transport and the process exits. No cleanup needed beyond what Node's normal exit handlers do.

### Tool Surface

Seventeen tools live in `McpTool`, each registered once in `Mcp.registerAll()`. Tools split into two semantic categories:

**Act tools** target the captured working tab. The first act operation creates a tab if none exists; subsequent acts reuse it.

| Tool       | Role                                                        | Annotations                                       |
| ---------- | ----------------------------------------------------------- | ------------------------------------------------- |
| `click`    | Click by text, selector, coordinates, or keypress           | `destructiveHint: true`, `openWorldHint: true`    |
| `execute`  | Run arbitrary JavaScript in the working tab                 | `destructiveHint: true`, `openWorldHint: true`    |
| `hover`    | Dispatch hover events to reveal hover-triggered UI          | `destructiveHint: false`, `idempotentHint: true`  |
| `navigate` | Navigate to a URL or move through history                   | `destructiveHint: false`, `openWorldHint: true`   |
| `open`     | Open a blank tab as the working target                      | `destructiveHint: false`, `idempotentHint: false` |
| `refresh`  | Reload the working tab (optionally bypassing cache)         | `idempotentHint: true`, `openWorldHint: true`     |
| `search`   | Search via the user's default search engine                 | `destructiveHint: false`, `openWorldHint: true`   |
| `select`   | Choose an option in a `<select>` element                    | `destructiveHint: true`                           |
| `type`     | Type into input fields with framework-reactivity events     | `destructiveHint: true`, `openWorldHint: true`    |

**Observe tools** target the front window's current tab so the user can point Safari at content for inspection. `read` and `inspect` accept an optional `index` parameter to inspect a non-focused tab without switching to it.

| Tool         | Role                                                          | Annotations                                       |
| ------------ | ------------------------------------------------------------- | ------------------------------------------------- |
| `close`      | Close only the working tab                                    | `destructiveHint: true`, `idempotentHint: true`   |
| `inspect`    | Return element metadata for a CSS selector                    | `readOnlyHint: true`, `idempotentHint: true`      |
| `read`       | Extract page title, URL, text or anchor links, console errors | `readOnlyHint: true`, `idempotentHint: true`      |
| `screenshot` | Capture the current viewport as base64 PNG                    | `readOnlyHint: true`, `idempotentHint: true`      |
| `scroll`     | Scroll by direction, pixels, or viewport-page index           | `destructiveHint: false`                          |
| `status`     | Return current Safari tabs and the full tool surface          | `readOnlyHint: true`, `idempotentHint: true`      |
| `wait`       | Wait for selector to appear, disappear, or text to render     | `readOnlyHint: true`, `idempotentHint: true`      |
| `window`     | Manage tabs (list/switch/open/close)                          | `destructiveHint: true`                           |

Tools that return structured payloads (`inspect`, `navigate`, `read`, `refresh`, `scroll`, `search`, `wait`, `window`, plus `open` and `close` with simple booleans) declare `outputSchema` so the SDK validates the payload and clients receive a typed `structuredContent` field alongside the text envelope.

Each tool's `_meta.usage` array carries natural-language guidance for the calling agent: observations alongside the artifact, in the same spirit as the `axivo/claude` framework's coding observations. Hosts surface this via the standard `tools/list` response.

### Request Flow

A `click` call traces this path:

1. Host (e.g., Claude Code) sends a `tools/call` JSON-RPC request over stdin: `{ method: "tools/call", params: { name: "click", arguments: { text: "Sign In" } } }`.
2. The SDK looks up the registered `click` handler, validates `arguments` against the Zod `inputSchema`, and invokes the handler with the parsed args.
3. `handleClick` checks for required fields (one of `text`, `selector`, `key`, or `x/y` must be present), captures the pre-click state (title, URL, page count, tab count) for change detection, and calls `client.clickElement(selector, text, wait, x, y)`.
4. `Client.clickElement` calls `getCurrentTab()` to resolve the working tab (creating one if needed), selects the appropriate browser script (`Browser.clickElement`, `Browser.clickSelector`, `Browser.clickDirect`, or `Browser.clickCoordinates`), serializes it to an IIFE string, wraps it in `Automation.executeScript(windowId, tabIndex, ...)`, and invokes `osascript` with the result.
5. Safari executes the AppleScript, which executes the JavaScript in the targeted tab (`tab N of window id X`), which finds and clicks the matching element. The script returns a status string; AppleScript returns it; `osascript` writes it to stdout; `Client` resolves its promise with the string.
6. `handleClick` re-captures the post-click state, computes a `changes` array (title changed, URL changed, page count changed, tab list changed), assembles a response object, and returns via `Client.response()` which wraps it as `{ content: [{ type: "text", text }] }`.
7. The SDK serializes the response as a JSON-RPC reply on stdout. The host reads it and surfaces the result to the agent.

The whole round-trip is synchronous from the host's perspective - typically 100-500ms depending on the page action.

### Build and Publish

- **Build:** `npm run build` runs `tsc` against `tsconfig.json`. Outputs `dist/index.js` (the binary), `dist/server/*.{js,d.ts}`, and `dist/lib/*.{js,d.ts}`. No bundler, no minifier - the SDK and runtime dependencies are loaded from the user's `node_modules` at runtime.
- **Clean:** `npm run clean` deletes `dist/`. Useful before a build to avoid stale artifacts.
- **Publish:** A `v*` tag pushed to `main` triggers `.github/workflows/package.yml`, which runs `npm ci`, `npm run build`, and `npm publish` under the `id-token: write` permission. npm trusted publishing produces a provenance attestation linking the published artifact to the commit and workflow run. No personal access token is involved.
- **Verify:** Users can run `npm audit signatures @axivo/mcp-safari` to verify the integrity of an installed version.

### Configuration

Environment variables are optional and read once at `Client` construction time:

- `SAFARI_PAGE_TIMEOUT` - page-load and selector-wait timeout in ms (default `10000`)
- `SAFARI_WINDOW_BOUNDS` - top-left margin offset in px (default `20`)
- `SAFARI_WINDOW_HEIGHT` - window height in px (default `1024`)
- `SAFARI_WINDOW_WIDTH` - window width in px (default `1280`)

There are no required environment variables. The server runs out of the box.

## Coding Standards

- JSDoc `@fileoverview` (or equivalent module-level docblock) on every file, `@param`/`@returns` on all methods
- No empty lines inside functions
- TypeScript strict mode, ES2022 target, ESNext modules
- Class fields declared with explicit types; methods written without explicit return-type annotations when type inference is load-bearing for SDK generics (see `tool.ts`)
- Alphabetical ordering for imports
- No `any` type unless documented why no narrower type works
- No non-null assertion operator (`!`) - capture local references after initialization, or use a helper that throws on missing keys
- Tool definitions in `McpTool` return inline literal config objects passed straight to `registerTool` - no wrapper types between the definition and the SDK

### TypeScript Conventions

- **Inferred return types on `McpTool` methods.** Each tool method (`click()`, `navigate()`, ...) returns a literal config object without an explicit return-type annotation. This is intentional - TypeScript captures the specific shape of each `inputSchema` so `McpServer.registerTool`'s generic inference can propagate the input args type to the handler signature. Adding a wide return-type alias (e.g., `ToolDefinition`) collapses the inference and breaks handler typing.
- **Browser-side scripts.** Inner `function script(...)` bodies inside `Browser` methods author DOM-context JavaScript. Type annotations exist for editor support and authoring-time bug-catching; they are erased by `tsc` and the runtime payload (returned by `fn.toString()`) is plain JavaScript identical to a hand-written equivalent.
- **Custom `Window` properties.** `__safariErrors` and `__safariWarnings` are declared via `declare global { interface Window { ... } }` in `browser.ts`. Closures inside `errorCapture` capture local `errors`/`warnings` references after assignment so the runtime semantics are preserved without non-null assertions.
- **`tsconfig.json` `lib`.** Set to `["ES2022", "DOM"]` because `browser.ts` needs DOM globals. The DOM lib is harmless for the other files.

## Issues

No active workarounds. This section will document upstream-bug compensation as it surfaces.
