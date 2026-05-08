# Safari MCP Server

[![License: BSD 3-Clause](https://img.shields.io/badge/License-BSD%203--Clause-blue.svg?style=flat&logo=opensourceinitiative&logoColor=white)](https://github.com/axivo/mcp-safari/blob/main/LICENSE)
[![npm](https://img.shields.io/npm/v/@axivo/mcp-safari.svg?style=flat&logo=npm&logoColor=white)](https://www.npmjs.com/package/@axivo/mcp-safari)
[![Socket](https://badge.socket.dev/npm/package/@axivo/mcp-safari)](https://socket.dev/npm/package/@axivo/mcp-safari)
[![Node.js](https://img.shields.io/badge/Node.js->=24.0.0-339933?style=flat&logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript->=6.0.0-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

A MCP (Model Context Protocol) server for visual web access through Safari.

### Features

- **Visual Web Access**: Viewport screenshots for visual inspection
- **Full Authentication State**: Operates on the user's actual Safari session with cookies preserved
- **Tab-Aware Targeting**: Act operations target a captured working tab, observe operations follow the user's focus
- **Viewport Scrolling**: Pixel amount or viewport-page index
- **Element Inspection**: Tag, visibility, attributes, bounding rect for any CSS selector
- **Interaction Tools**: Click, type, hover, select option
- **Wait Conditions**: Selector to appear, disappear, or page text to render
- **Link Extraction**: Anchor links as `{ text, href }` pairs
- **Browser History**: Back and forward navigation
- **Console Error Capture**: Two-phase injection during and after page load

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

All variables are optional:

- `SAFARI_PAGE_TIMEOUT` - Page load and selector wait timeout, in milliseconds (default: `10000`)
- `SAFARI_WINDOW_BOUNDS` - Browser window margin offset from top-left corner, in pixels (default: `20`)
- `SAFARI_WINDOW_HEIGHT` - Browser window height, in pixels (default: `1024`)
- `SAFARI_WINDOW_WIDTH` - Browser window width, in pixels (default: `1280`)

### Prompt Examples

- "_Open Safari and use `status` tool for guidelines_"
- "_Navigate to `example.com`_"
- "_Search for `example query`_"
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
- "_Inspect the submit button before clicking it_"
- "_Hover over the Products menu_"
- "_Choose 'Canada' in the country dropdown_"
- "_Wait for the loading spinner to disappear_"
- "_Read all links on this page_"

> [!NOTE]
>
> The "use `status` tool" instruction helps Claude pause and process the `_meta.usage` guidelines before interacting with the browser.

### MCP Tools

Call `status` first at session start to get the runtime state and full tool surface:

- **Act tools** target a captured working tab
- **Observe tools** target the front window's current tab

1. `click`
   - Click an element on the working tab
   - Type: `act` tool
   - Optional inputs:
     - `key` (string): Key to press (e.g., Escape, ArrowRight, Enter, Tab)
     - `selector` (string): CSS selector for the target element
     - `text` (string): Visible text or aria-label to match
     - `wait` (string): CSS selector to wait for after click
     - `x` (number): X coordinate in pixels
     - `y` (number): Y coordinate in pixels
   - Returns: Result with change detection

2. `close`
   - Close the working tab
   - Type: `act` tool

3. `execute`
   - Execute JavaScript in the working tab
   - Type: `act` tool
   - Required inputs:
     - `script` (string): JavaScript code

4. `hover`
   - Dispatch hover events to reveal hover-triggered UI
   - Type: `act` tool
   - Optional inputs (one is required):
     - `selector` (string): CSS selector for the target element
     - `text` (string): Visible text to match

5. `inspect`
   - Return element metadata for a CSS selector
   - Type: `observe` tool
   - Required inputs:
     - `selector` (string): CSS selector for the target element
   - Optional inputs:
     - `index` (number): Tab index in the front window
   - Returns: `{ found, tag, text, visible, disabled, attributes, rect }`

6. `navigate`
   - Navigate the working tab to a URL or through history
   - Type: `act` tool
   - Optional inputs (`url` or `direction` required):
     - `direction` (string: `back` or `forward`)
     - `selector` (string): CSS selector to wait for after load
     - `steps` (number, default: 1): Steps for history navigation
     - `url` (string): URL to navigate to

7. `open`
   - Open a blank tab as the working target
   - Type: `act` tool

8. `read`
   - Get page title, URL, and text or links from a tab
   - Type: `observe` tool
   - Optional inputs:
     - `index` (number): Tab index in the front window
     - `mode` (string: `text` or `links`, default: `text`)
     - `selector` (string): CSS selector to scope extraction

9. `refresh`
   - Refresh the working tab
   - Type: `act` tool
   - Optional inputs:
     - `hard` (boolean, default: false): Bypass cache
     - `selector` (string): CSS selector to wait for after reload

10. `screenshot`
    - Capture the Safari window, an element, the full page, or the screen
    - Type: `observe` tool
    - Optional inputs:
      - `display` (number): Display index for `screen` mode, 1-based, defaults to the main display
      - `mode` (string: `element`, `page`, `screen`, `window`, default: `window`): Capture mode
      - `selector` (string): CSS selector for `element` mode
      - `settle` (number): For `page` mode, milliseconds to wait after each scroll for content to settle (default: `500`). Raise for slow dynamic sites, lower for static sites.
      - `share` (boolean, default: `false`): Save to disk and return only the file path instead of the inline image
    - Returns: Inline base64 image when `share` is `false`, or `{ path, width, height, mimeType, ... }` when `share` is `true`. Browser metadata `{ innerHeight, scrollHeight, pages }` is included for non-`screen` modes.

11. `scroll`
    - Scroll by direction or to a viewport-page index
    - Type: `observe` tool
    - Optional inputs:
      - `direction` (string: `up` or `down`)
      - `page` (number): Viewport-page index to scroll to
      - `pixels` (number): Pixels to scroll, paired with `direction`

12. `search`
    - Search using the browser's default engine
    - Type: `act` tool
    - Required inputs:
      - `text` (string): Search query

13. `select`
    - Choose an option in a `<select>` element
    - Type: `act` tool
    - Required inputs:
      - `selector` (string): CSS selector for the `<select>`
    - Optional inputs (one is required):
      - `text` (string): Option visible text
      - `value` (string): Option value attribute

14. `status`
    - Return current Safari tabs and full tool surface
    - Type: `observe` tool
    - Returns: `{ tabs, tools }`

15. `type`
    - Type text into an input field
    - Type: `act` tool
    - Required inputs:
      - `text` (string): Text to type
    - Optional inputs:
      - `append` (boolean, default: false): Append instead of replace
      - `selector` (string): CSS selector for the input
      - `submit` (boolean, default: false): Press Enter after typing

16. `wait`
    - Wait for selector or page text condition
    - Type: `observe` tool
    - Optional inputs (exactly one of the first three required):
      - `selector` (string): CSS selector to wait for
      - `selectorGone` (string): CSS selector to wait absent
      - `text` (string): Page text to wait for
      - `timeoutMs` (number): Timeout in milliseconds
    - Returns: `{ matched, elapsedMs }`

17. `window`
    - Manage browser window tabs
    - Type: `observe` tool
    - Required inputs:
      - `action` (string: `close`, `list`, `open`, `switch`)
    - Optional inputs:
      - `index` (number): Tab index for `close` and `switch`
      - `url` (string): URL for `open`
