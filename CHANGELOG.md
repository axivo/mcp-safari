# Changelog

All notable changes to the Safari MCP Server will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.3] - 2026-06-24

### Added

- `_meta` key `anthropic/maxResultSizeChars` set to `500000` on the `execute` and `read` tools

## [1.1.2] - 2026-05-08

### Added

- `display` parameter on `screenshot` for selecting a 1-based display in screen mode
- `mode` parameter on `screenshot` with `element`, `page`, `screen`, and `window` values
- `selector` parameter on `screenshot` for capturing the bounding rect of a CSS-selected element
- `settle` parameter on `screenshot` controlling the per-scroll wait in page mode
- `share` parameter on `screenshot` saving the image to the user's screenshot folder and returning the path
- Element-mode auto-scroll with `Browser.scrollElementIntoView` so below-fold elements are repositioned before capture
- Full-page stitching with sharp compositing, live `scrollHeight` re-read per iteration, and a 60-segment safety cap
- Page-mode sticky-element suppression via `Browser.hideStickyElements` and `Browser.restoreStickyElements`
- Page-mode scrollbar suppression via `Browser.hideScrollbars` and `Browser.restoreScrollbars`
- Page-mode geometry reader `Browser.scrollGeometry` returning innerHeight, scrollHeight, scrollOffset, devicePixelRatio
- Honoring of `com.apple.screencapture` defaults (`location`, `type`, `name`, `include-date`) for share-true filenames
- Dependency `sharp` `^0.34.5` for image compositing and format conversion

### Changed

- Tool `screenshot` description and `_meta.usage` rewritten for the multi-mode surface
- Method `Client.takeScreenshot` returns `{ kind: 'inline' | 'saved', ... }` instead of a raw base64 string
- Handler `handleScreenshot` omits browser metadata (`innerHeight`, `scrollHeight`, `pages`) for screen mode
- Class methods reordered alphabetically in `Browser` and `Client` after the new screenshot helpers landed

## [1.1.1] - 2026-05-07

### Added

- Constant `NO_WINDOW_ERROR` deduplicating the observe-operation no-window error message
- Default exhaustiveness branch on `handleWindow` action switch with `never`-typed assertion
- Helper `runExec` consolidating callback-based `execFile` invocations into a single promise wrapper
- Public `escapeForJs` method on `Client` for JavaScript single-quoted string literal escaping

### Changed

- AppleScript template parsing moved from per-instance constructor to once-per-class-load static field initializer
- Method `escapeForJs` made public so `mcp.ts` can share the same escaping logic instead of duplicating it inline
- Single-line `if` statements expanded to braces-always form across `automation.ts`, `browser.ts`, and `client.ts`

### Fixed

- `getSearchUrl` regex non-null assertion replaced with explicit error when `NSPreferredWebServices` cannot be parsed
- Empty `catch` block in `injectErrorCaptureEarly` annotated with explanatory comment instead of silent swallow

## [1.1.0] - 2026-05-04

### Added

- New `hover` tool for revealing hover-triggered UI
- New `inspect` tool returning element metadata for a CSS selector
- New `select` tool for choosing options in `<select>` elements
- New `status` tool returning current Safari tabs and the full tool surface with usage guidance
- New `wait` tool for polling on selector or page text conditions
- New `mode` parameter on `read` tool with `text` and `links` modes
- New `index` parameter on `read` and `inspect` tools for non-focused tab inspection
- Title-stable page-load detection via `document.title` polling after `readyState=complete`
- `outputSchema` and `structuredContent` on tools returning structured payloads
- `ToolAnnotations` (`title`, `readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`) on every tool
- Numeric input coercion via `z.coerce.number()` on tool input fields

### Changed

- Act operations target a captured working tab, observe operations the user's focused tab
- Tool `open` creates a working tab as the target for subsequent act operations
- Tool `close` closes only the working tab, leaving other tabs and windows intact
- Tool `navigate` self-bootstraps a working tab and window if none exists
- Tool `window` action `switch` is now focus-only and does not reassign the working tab
- Tool registration migrated from `setRequestHandler` to `McpServer.registerTool`
- Tool input schemas migrated from JSON Schema literals to Zod raw shapes
- AppleScript primitives now take explicit `windowId` and tab `index` parameters
- Library `lib/automation.js` and `lib/browser.js` ported to TypeScript with DOM type narrowing
- Method `Client.version` renamed to `Client.getVersion` for getter convention
- Console capture overrides use rest parameters instead of `arguments`
- Class methods reordered: constructor, then private methods alphabetical, then public methods alphabetical
- Dependency `@modelcontextprotocol/sdk` bumped to `^1.29.0`
- Dependency `zod` bumped to `^4.4.0`
- TypeScript `module` and `moduleResolution` set to `NodeNext`

### Fixed

- Front-window hijack when the captured working tab was closed
- Cold-start tab proliferation creating two tabs instead of one in a fresh window
- SPA title race returning the URL string instead of the page title

### Removed

- Embedded tool list from `open` tool response, replaced by standard `tools/list`
- Interface declarations `XArgs` in `mcp.ts`, replaced by Zod inference
- Manual default-value injection, replaced by Zod `.default()`
- Manual required-field validation, replaced by SDK schema validation
- Library declaration shims `lib/automation.d.ts` and `lib/browser.d.ts`
- Compiler option `allowJs` from `tsconfig.json`

## [1.0.7] - 2026-02-24

### Added

- `refresh` tool with normal and hard reload modes, optional CSS selector wait after reload
- `refresh` tool prompt example for page reload

## [1.0.6] - 2026-02-23

### Added

- `scroll` tool with three modes: viewport page jump, directional page scroll, and fine-grained pixel scrolling
- `scrollOffset` tracking in scroll responses for precise viewport position awareness
- Viewport dimensions in `navigate`, `scroll`, and `search` tool responses

### Changed

- Extracted viewport scrolling from `navigate` tool into dedicated `scroll` tool
- Extracted viewport scrolling from `screenshot` tool, now captures current viewport only
- Response property ordering from alphabetical to reading priority across tool handlers

### Removed

- `page` parameter from `navigate` tool
- `page` parameter from `screenshot` tool
- `readyState` from `navigate` and `search` tool responses, redundant after page load completion

## [1.0.5] - 2026-02-22

### Added

- Security policy with scope, threat vectors, and supply chain integrity documentation
- Socket Security badge for npm package security scoring

### Changed

- AppleScript templates to uniform block format in `automation.js` library
- Search URL construction from hardcoded provider map to macOS `NSProviderIdentifier` dynamic domain reversal

### Fixed

- New tab opening blank instead of Safari Start Page

## [1.0.4] - 2026-02-22

### Fixed

- `close` tool response bypassing MCP protocol serialization

## [1.0.3] - 2026-02-22

### Added

- Tab count awareness in `click`, `navigate`, `open`, and `search` tool responses
- Tab list detection in `click` tool when tab count changes

## [1.0.2] - 2026-02-22

### Added

- `window` tool for managing browser tabs with list, switch, open, and close actions
- `window` tool prompt examples for tab management

### Changed

- Extracted AppleScript and JXA templates from client into `automation.js` library

## [1.0.1] - 2026-02-21

### Changed

- Prompt instructions to enforce tools usage review before browser interaction

## [1.0.0] - 2026-02-21

### Added

- AppleScript and JXA automation bridge for native Safari browser control
- Browser script serialization converting functions to IIFE strings with safe parameter injection
- Console error and warning capture with two-phase injection during and after page load
- Environment variable configuration for page timeout, window bounds, and dimensions
- Framework reactivity support using native property descriptor setter for React, Vue, and Angular
- GitHub Actions workflow for automated npm publishing on version tags
- Prioritized element search with shortest-text-wins heuristic to avoid parent containers
- Tool argument validation with Zod runtime schemas and default value injection
- Viewport-based pagination for screenshots and page scrolling
- `click` tool supporting text matching, aria-label, CSS selector, coordinates, and keypress
- `close` tool for terminating browser sessions
- `execute` tool for arbitrary JavaScript execution in browser context
- `navigate` tool with URL navigation, browser history, and viewport page scrolling
- `open` tool initializing Safari window with `_meta.usage` embedded tool guidance
- `read` tool extracting page title, URL, text content, viewport page count, and console errors
- `screenshot` tool capturing viewport-sized pages as base64 PNG images
- `search` tool using Safari's default search engine
- `type` tool with text input, append mode, and optional form submission
