# Changelog

All notable changes to the Safari MCP Server will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-02-21

### Added

- AppleScript and JXA automation bridge for native Safari browser control
- Browser script serialization converting functions to IIFE strings with safe parameter injection
- Click tool supporting text matching, aria-label, CSS selector, coordinates, and keypress
- Close tool for terminating browser sessions
- Console error and warning capture with two-phase injection during and after page load
- Environment variable configuration for page timeout, window bounds, and dimensions
- Execute tool for arbitrary JavaScript execution in browser context
- Framework reactivity support using native property descriptor setter for React, Vue, and Angular
- GitHub Actions workflow for automated npm publishing on version tags
- Navigate tool with URL navigation, browser history, and viewport page scrolling
- Open tool initializing Safari window with `_meta.usage` embedded tool guidance
- Prioritized element search with shortest-text-wins heuristic to avoid parent containers
- Read tool extracting page title, URL, text content, viewport page count, and console errors
- Screenshot tool capturing viewport-sized pages as base64 PNG images
- Search tool using Safari's default search engine
- Tool argument validation with Zod runtime schemas and default value injection
- Type tool with text input, append mode, and optional form submission
- Viewport-based pagination for screenshots and page scrolling
