# Safari MCP Server

[![License: BSD 3-Clause](https://img.shields.io/badge/License-BSD%203--Clause-blue.svg?style=flat&logo=opensourceinitiative&logoColor=white)](https://github.com/axivo/mcp-safari/blob/main/LICENSE)
[![npm](https://img.shields.io/npm/v/@axivo/mcp-safari.svg?style=flat&logo=npm&logoColor=white)](https://www.npmjs.com/package/@axivo/mcp-safari)
[![Socket](https://badge.socket.dev/npm/package/@axivo/mcp-safari)](https://socket.dev/npm/package/@axivo/mcp-safari)
[![Node.js](https://img.shields.io/badge/Node.js->=24.0.0-339933?style=flat&logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript->=5.0.0-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

A MCP (Model Context Protocol) server for visual web access through Safari.

### Features

- **Visual Web Access**: Capture viewport screenshots for visual page inspection
- **Full Authentication State**: Controls the user's actual Safari session with cookies and login state preserved
- **Viewport Scrolling**: Scroll by pixel amount or jump to viewport-sized pages for precise positioning
- **Interaction Tools**: Click elements by visible text and type into input fields with framework reactivity support
- **Browser History**: Navigate back and forward through browser history
- **Console Error Capture**: Two-phase injection catches console errors and warnings during and after page load

### Prerequisites

- **macOS** → System Settings → Desktop & Dock → Windows → "Prefer tabs when opening documents" option must be set to **Always**
- **macOS** → System Settings → Privacy & Security → Screen & System Audio Recording → Terminal app must be enabled
- **Safari** → Settings → Developer → Automation → "Allow JavaScript from Apple Events" option must be enabled

### MCP Server Configuration

Add to `mcp.json` servers configuration:

```json
{
  "mcpServers": {
    "safari": {
      "command": "npx",
      "args": ["-y", "@axivo/mcp-safari"],
      "env": {
        "SAFARI_WINDOW_HEIGHT": "1600"
      }
    }
  }
}
```

#### Environment Variables

All variables are optional — defaults apply if not set:

- `SAFARI_PAGE_TIMEOUT` — Page load and selector wait timeout, in milliseconds (default: `10000`)
- `SAFARI_WINDOW_BOUNDS` — Browser window margin offset from top-left corner, in pixels (default: `20`)
- `SAFARI_WINDOW_HEIGHT` — Browser window height, in pixels (default: `1024`)
- `SAFARI_WINDOW_WIDTH` — Browser window width, in pixels (default: `1280`)

### Prompt Examples

Here are practical examples of how to use the Safari MCP server with natural language prompts:

- "_Open Safari and review the tools usage, then go to `example.com`_"
- "_Open Safari and review the tools usage, then search for `example query`_"
- "_Take a screenshot of the current page_"
- "_Read the page content to understand what's on the page_"
- "_Click the 'Sign In' button_"
- "_Type my email into the login form and submit_"
- "_Refresh the page to see the latest changes_"
- "_Go back to the previous page_"
- "_Navigate forward two steps in browser history_"
- "_Scroll down 500 pixels_"
- "_Scroll to page 3 of this article_"
- "_Search for 'Claude AI' and click the first result_"
- "_List all open browser tabs_"
- "_Open a new browser tab and go to `example.com`_"
- "_Switch to the first browser tab_"
- "_Close the second browser tab_"

> [!NOTE]
> The "review the tools usage" instruction helps Claude pause and process the `_meta.usage` guidelines before interacting with the browser.

### MCP Tools

1. `click`
   - Click an element on the browser window
   - Optional inputs:
     - `key` (string): Key to press (e.g., Escape, ArrowRight, ArrowLeft, Enter, Tab)
     - `selector` (string): CSS selector to click when no text provided or to scope the text search
     - `text` (string): Text to match - visible text, image alt text, or aria-label
     - `wait` (string): CSS selector to wait for after click
     - `x` (number): X coordinate (pixels from left of viewport) to click at
     - `y` (number): Y coordinate (pixels from top of viewport) to click at
   - Returns: Click result with page title, URL, viewport pages, tabs, and detected changes

2. `close`
   - Close the browser window
   - Returns: Session closure confirmation

3. `execute`
   - Execute JavaScript in the browser context
   - Required inputs:
     - `script` (string): JavaScript code to execute
   - Returns: Script execution result

4. `navigate`
   - Navigate to a URL or through browser history (back/forward)
   - Optional inputs:
     - `direction` (string: `back` or `forward`): Navigate back or forward in browser history
     - `selector` (string): CSS selector to wait for after page load
     - `steps` (number, default: 1): Number of steps for back/forward navigation
     - `url` (string): URL to navigate to
   - Returns: Page title, URL, viewport pages, viewport dimensions, and tab count

5. `open`
   - Open a browser window and read `_meta.usage` tools guidance
   - Returns: Tab count and complete tool definitions with usage guidance

6. `read`
   - Get the page title, URL, full text content, and count for viewport-sized screenshots
   - Optional inputs:
     - `selector` (string): CSS selector to scope text extraction
   - Returns: Page title, URL, text content, viewport pages, and any captured console errors/warnings

7. `refresh`
   - Refresh the current browser page
   - Optional inputs:
     - `hard` (boolean, default: false): Bypass browser cache with hard refresh
     - `selector` (string): CSS selector to wait for after reload
   - Returns: Page title, URL, viewport pages, viewport dimensions, and tab count

8. `screenshot`
   - Capture a screenshot of the current browser viewport
   - Returns: Base64-encoded PNG screenshot with viewport dimensions

9. `scroll`
   - Scroll to specific viewport page or by direction with pixel amount
   - Optional inputs:
     - `direction` (string: `up` or `down`): Scroll direction (scrolls one viewport page when used alone)
     - `page` (number): Scroll to a specific viewport-sized page number
     - `pixels` (number): Number of pixels to scroll (used with direction for fine-grained control)
   - Returns: Viewport dimensions, scroll offset, and viewport pages

10. `search`
    - Search the web using browser's default search engine
    - Required inputs:
      - `text` (string): Search query
    - Returns: Page title, URL, viewport pages, viewport dimensions, and tab count

11. `type`
    - Type text into a page input field
    - Required inputs:
      - `text` (string): Text to type
    - Optional inputs:
      - `append` (boolean, default: false): Append to existing value instead of replacing
      - `selector` (string): CSS selector for the target input
      - `submit` (boolean, default: false): Submit form by pressing Enter after typing
    - Returns: Description of the action taken

12. `window`
    - Manage browser window tabs
    - Required inputs:
      - `action` (string: `close`, `list`, `open`, `switch`): Tab action to perform
    - Optional inputs:
      - `index` (number): Tab index for close and switch actions
      - `url` (string): URL to open in a new tab (open action only)
    - Returns: Array of tabs with active status, index, title, and URL
