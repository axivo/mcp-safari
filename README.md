# Safari MCP Server

[![License: BSD 3-Clause](https://img.shields.io/badge/License-BSD%203--Clause-blue.svg?style=flat&logo=opensourceinitiative&logoColor=white)](https://github.com/axivo/mcp-safari/blob/main/LICENSE)
[![npm](https://img.shields.io/npm/v/@axivo/mcp-safari.svg?style=flat&logo=npm&logoColor=white)](https://www.npmjs.com/package/@axivo/mcp-safari)
[![Node.js](https://img.shields.io/badge/Node.js->=24.0.0-339933?style=flat&logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript->=5.0.0-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

A MCP (Model Context Protocol) server for visual web access through Safari.

### Features

- **Visual Web Access**: Capture viewport screenshots for visual page inspection
- **Full Authentication State**: Controls the user's actual Safari session with cookies and login state preserved
- **Paged Screenshots**: Navigate multi-page content with viewport-based pagination
- **Interaction Tools**: Click elements by visible text and type into input fields with framework reactivity support
- **Browser History**: Navigate back and forward through browser history
- **Console Error Capture**: Two-phase injection catches console errors and warnings during and after page load

### Prerequisites

- **macOS** → System Settings → Privacy & Security → Screen Recording must be enabled for the terminal app
- **Safari** → Settings → Developer → "Allow JavaScript from Apple Events" option must be enabled

### MCP Server Configuration

Add to `mcp.json` servers configuration:

```json
{
  "mcpServers": {
    "safari": {
      "command": "npx",
      "args": ["-y", "@axivo/mcp-safari"],
      "env": {
        "SAFARI_WINDOW_HEIGHT": "600",
        "SAFARI_WINDOW_WIDTH": "800"
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

- "_Open Safari and review the tools usage, then navigate to https://example.com_"
- "_Open Safari and review the tools usage, then search for `example query`_"
- "_Take a screenshot of the current page_"
- "_Read the page content to understand what's on the page_"
- "_Click the 'Sign In' button_"
- "_Type my email into the login form and submit_"
- "_Go back to the previous page_"
- "_Navigate forward two steps in browser history_"
- "_Scroll down to page 3 of this article_"
- "_Search for 'Claude AI' and click the first result_"
- "_List all open browser tabs_"
- "_Open a new browser tab and go to https://example.com_"
- "_Switch to the first browser tab_"
- "_Close the second browser tab_"

### MCP Tools

1. `click`
   - Click an element on the page by its visible text content
   - Required inputs:
     - `text` (string): Visible text of the element to click
   - Optional inputs:
     - `selector` (string): CSS selector to scope the element search
     - `wait` (string): CSS selector to wait for after click
   - Returns: Description of the clicked element, with optional selector found status

2. `close`
   - Close the browser window
   - Returns: Session closure confirmation

3. `execute`
   - Execute JavaScript in the browser context
   - Required inputs:
     - `script` (string): JavaScript code to execute
   - Returns: Script execution result

4. `navigate`
   - Navigate to a URL, through browser history (back/forward), or scroll to a viewport page
   - Optional inputs:
     - `url` (string): URL to navigate to
     - `direction` (string: `back` or `forward`): Navigate back or forward in browser history
     - `page` (number): Scroll to a specific viewport page number
     - `selector` (string): CSS selector to wait for after page load
     - `steps` (number, default: 1): Number of steps for back/forward navigation
   - Returns: Page title, final URL, ready state, and number of viewport pages

5. `open`
   - Open a browser window
   - Returns: Session creation confirmation

6. `read`
   - Get the page title, URL, and extracted text content
   - Optional inputs:
     - `selector` (string): CSS selector to scope text extraction
   - Returns: Page title, current URL, text content, number of viewport pages, and any captured console errors/warnings

7. `search`
   - Search the web using browser's default search engine
   - Required inputs:
     - `text` (string): Search query
   - Returns: Page title, final URL, ready state, and number of viewport pages

8. `screenshot`
   - Optional page screenshot to visualize images and specific page elements
   - Optional inputs:
     - `page` (number, default: 1): Page number to capture
   - Returns: Base64-encoded PNG screenshot with viewport dimensions

9. `type`
   - Type text into a page input field
   - Required inputs:
     - `text` (string): Text to type
   - Optional inputs:
     - `append` (boolean, default: false): Append to existing value instead of replacing
     - `selector` (string): CSS selector for the target input
     - `submit` (boolean, default: false): Submit form by pressing Enter after typing
   - Returns: Description of the action taken

10. `window`
    - Manage browser window tabs
    - Required inputs:
      - `action` (string: `close`, `list`, `open`, `switch`): Tab action to perform
    - Optional inputs:
      - `index` (number): Tab index (1-based) for close and switch actions
      - `url` (string): URL to open in a new tab (open action only)
    - Returns: Array of tabs with active status, index, title, and URL
