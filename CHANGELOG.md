# Changelog

All notable changes to the Safari MCP Server will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
