/**
 * AppleScript template library for Safari MCP Server
 *
 * Provides parameterized AppleScript strings for Safari automation.
 * Each method returns a self-contained script string ready for
 * execution via osascript.
 *
 * @module lib/automation
 * @author AXIVO
 * @license BSD-3-Clause
 */

const osaScripts = `
--- activate
tell application "Safari"
  activate
end tell

--- ensureWindow
tell application "Safari"
  activate
  if (count of windows) is 0 then
    make new document
  end if
  return id of front window
end tell

--- frontWindowId
tell application "Safari"
  if (count of windows) is 0 then
    return ""
  end if
  return id of front window
end tell

--- frontWindowAndTab
tell application "Safari"
  if (count of windows) is 0 then
    return ""
  end if
  return (id of front window as string) & "," & (index of current tab of front window as string)
end tell

--- currentTabIndex
tell application "Safari"
  return index of current tab of window id {{WINDOW}}
end tell

--- createTab
tell application "Safari"
  tell window id {{WINDOW}}
    set newTab to (make new tab)
    set current tab to newTab
    return index of newTab
  end tell
end tell

--- createTabWithUrl
tell application "Safari"
  tell window id {{WINDOW}}
    set newTab to (make new tab with properties {URL:"{{URL}}"})
    set current tab to newTab
    return index of newTab
  end tell
end tell

--- setTabUrl
tell application "Safari"
  tell window id {{WINDOW}}
    set URL of tab {{INDEX}} to "{{URL}}"
  end tell
end tell

--- setCurrentTab
tell application "Safari"
  tell window id {{WINDOW}}
    set current tab to tab {{INDEX}}
  end tell
end tell

--- closeTab
tell application "Safari"
  tell window id {{WINDOW}}
    close tab {{INDEX}}
  end tell
end tell

--- closeWindow
tell application "Safari"
  close window id {{WINDOW}}
end tell

--- tabExists
tell application "Safari"
  try
    tell window id {{WINDOW}}
      get URL of tab {{INDEX}}
      return "true"
    end tell
  on error
    return "false"
  end try
end tell

--- executeScript
tell application "Safari"
  do JavaScript "{{SCRIPT}}" in tab {{INDEX}} of window id {{WINDOW}}
end tell

--- getTitle
tell application "Safari"
  return name of tab {{INDEX}} of window id {{WINDOW}}
end tell

--- getUrl
tell application "Safari"
  return URL of tab {{INDEX}} of window id {{WINDOW}}
end tell

--- listTabs
tell application "Safari"
  tell window id {{WINDOW}}
    set currentIdx to index of current tab
    set tabCount to count of tabs
    set output to "["
    repeat with i from 1 to tabCount
      set tabName to name of tab i
      set tabURL to URL of tab i
      if i = currentIdx then
        set isActive to "true"
      else
        set isActive to "false"
      end if
      if i > 1 then set output to output & ","
      set output to output & "{\\"active\\":" & isActive & ",\\"index\\":" & i & ",\\"title\\":\\"" & tabName & "\\",\\"url\\":\\"" & tabURL & "\\"}"
    end repeat
    set output to output & "]"
    return output
  end tell
end tell

--- setBounds
tell application "Safari"
  set bounds of window id {{WINDOW}} to {{{X}}, {{Y}}, {{RIGHT}}, {{BOTTOM}}}
end tell
`;

/**
 * AppleScript template builder for Safari automation
 *
 * Parses all scripts from the embedded SCRIPTS constant at
 * construction time and provides typed methods with parameter
 * substitution for each automation command.
 *
 * @class Automation
 */
export class Automation {
  private scripts: Map<string, string>;

  /**
   * Creates a new AppleScript instance
   *
   * Parses the embedded script constant into named sections.
   */
  constructor() {
    this.scripts = new Map<string, string>();
    const sections = osaScripts.split(/^--- /m);
    for (let i = 1; i < sections.length; i++) {
      const newline = sections[i].indexOf('\n');
      const name = sections[i].substring(0, newline).trim();
      const body = sections[i].substring(newline + 1).trim();
      this.scripts.set(name, body);
    }
  }

  /**
   * Looks up a parsed script by name, throwing if absent
   *
   * @private
   * @param {string} name - Script section name
   * @returns {string} Script body
   */
  private get(name: string): string {
    const body = this.scripts.get(name);
    if (body === undefined) {
      throw new Error(`Missing AppleScript section: ${name}`);
    }
    return body;
  }

  /**
   * Activates Safari application
   *
   * @returns {string} AppleScript string
   */
  activate(): string {
    return this.get('activate');
  }

  /**
   * Closes a tab by window id and index
   *
   * @param {number} windowId - Window identifier
   * @param {number} index - Tab index (1-based)
   * @returns {string} AppleScript string
   */
  closeTab(windowId: number, index: number): string {
    return this.get('closeTab')
      .replace('{{WINDOW}}', String(windowId))
      .replace('{{INDEX}}', String(index));
  }

  /**
   * Closes a window by id
   *
   * @param {number} windowId - Window identifier
   * @returns {string} AppleScript string
   */
  closeWindow(windowId: number): string {
    return this.get('closeWindow').replace('{{WINDOW}}', String(windowId));
  }

  /**
   * Creates a new tab in a window, optionally navigating to a URL
   *
   * @param {number} windowId - Window identifier
   * @param {string} [url] - URL to open in the new tab
   * @returns {string} AppleScript string returning the new tab index
   */
  createTab(windowId: number, url?: string): string {
    if (url) {
      const escaped = url.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      return this.get('createTabWithUrl')
        .replace('{{WINDOW}}', String(windowId))
        .replace('{{URL}}', escaped);
    }
    return this.get('createTab').replace('{{WINDOW}}', String(windowId));
  }

  /**
   * Gets the current tab index of a window
   *
   * @param {number} windowId - Window identifier
   * @returns {string} AppleScript string returning the current tab index
   */
  currentTabIndex(windowId: number): string {
    return this.get('currentTabIndex').replace('{{WINDOW}}', String(windowId));
  }

  /**
   * Activates Safari, creating a window if none exists, returning the front window id
   *
   * @returns {string} AppleScript string returning the window id
   */
  ensureWindow(): string {
    return this.get('ensureWindow');
  }

  /**
   * Executes JavaScript in a specific tab
   *
   * @param {number} windowId - Window identifier
   * @param {number} index - Tab index (1-based)
   * @param {string} script - JavaScript code to execute
   * @returns {string} AppleScript string
   */
  executeScript(windowId: number, index: number, script: string): string {
    const escaped = script.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return this.get('executeScript')
      .replace('{{WINDOW}}', String(windowId))
      .replace('{{INDEX}}', String(index))
      .replace('{{SCRIPT}}', escaped);
  }

  /**
   * Gets the front window id and its current tab index in one call
   *
   * @returns {string} AppleScript string returning "<windowId>,<tabIndex>" or empty string when no windows
   */
  frontWindowAndTab(): string {
    return this.get('frontWindowAndTab');
  }

  /**
   * Gets the id of the front Safari window, or empty string if none
   *
   * @returns {string} AppleScript string returning the window id or empty string
   */
  frontWindowId(): string {
    return this.get('frontWindowId');
  }

  /**
   * Gets the title of a specific tab
   *
   * @param {number} windowId - Window identifier
   * @param {number} index - Tab index (1-based)
   * @returns {string} AppleScript string
   */
  getTitle(windowId: number, index: number): string {
    return this.get('getTitle')
      .replace('{{WINDOW}}', String(windowId))
      .replace('{{INDEX}}', String(index));
  }

  /**
   * Gets the URL of a specific tab
   *
   * @param {number} windowId - Window identifier
   * @param {number} index - Tab index (1-based)
   * @returns {string} AppleScript string
   */
  getUrl(windowId: number, index: number): string {
    return this.get('getUrl')
      .replace('{{WINDOW}}', String(windowId))
      .replace('{{INDEX}}', String(index));
  }

  /**
   * Lists tabs in a window with index, title, URL, and active status
   *
   * @param {number} windowId - Window identifier
   * @returns {string} AppleScript string returning JSON array
   */
  listTabs(windowId: number): string {
    return this.get('listTabs').replace('{{WINDOW}}', String(windowId));
  }

  /**
   * Sets the bounds of a window
   *
   * @param {number} windowId - Window identifier
   * @param {number} x - Left position
   * @param {number} y - Top position
   * @param {number} width - Window width
   * @param {number} height - Window height
   * @returns {string} AppleScript string
   */
  setBounds(windowId: number, x: number, y: number, width: number, height: number): string {
    return this.get('setBounds')
      .replace('{{WINDOW}}', String(windowId))
      .replace('{{X}}', String(x))
      .replace('{{Y}}', String(y))
      .replace('{{RIGHT}}', String(x + width))
      .replace('{{BOTTOM}}', String(y + height));
  }

  /**
   * Makes a tab the current tab of its window
   *
   * @param {number} windowId - Window identifier
   * @param {number} index - Tab index (1-based)
   * @returns {string} AppleScript string
   */
  setCurrentTab(windowId: number, index: number): string {
    return this.get('setCurrentTab')
      .replace('{{WINDOW}}', String(windowId))
      .replace('{{INDEX}}', String(index));
  }

  /**
   * Sets the URL of a specific tab
   *
   * @param {number} windowId - Window identifier
   * @param {number} index - Tab index (1-based)
   * @param {string} url - URL to navigate to
   * @returns {string} AppleScript string
   */
  setTabUrl(windowId: number, index: number, url: string): string {
    const escaped = url.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return this.get('setTabUrl')
      .replace('{{WINDOW}}', String(windowId))
      .replace('{{INDEX}}', String(index))
      .replace('{{URL}}', escaped);
  }

  /**
   * Probes whether a tab still exists in a window
   *
   * @param {number} windowId - Window identifier
   * @param {number} index - Tab index (1-based)
   * @returns {string} AppleScript string returning "true" or "false"
   */
  tabExists(windowId: number, index: number): string {
    return this.get('tabExists')
      .replace('{{WINDOW}}', String(windowId))
      .replace('{{INDEX}}', String(index));
  }
}
