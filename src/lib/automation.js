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
tell application "Safari" to activate

--- closeTab
tell application "Safari" to close tab {{INDEX}} of window 1

--- closeWindow
tell application "Safari" to close window 1

--- createDocument
tell application "Safari" to make new document

--- createTab
tell application "Safari" to tell window 1 to set current tab to (make new tab)

--- createTabWithUrl
tell application "Safari" to tell window 1 to set current tab to (make new tab with properties {URL:"{{URL}}"})

--- executeScript
tell application "Safari" to do JavaScript "{{SCRIPT}}" in current tab of window 1

--- getTitle
tell application "Safari" to return name of current tab of window 1

--- getUrl
tell application "Safari" to return URL of current tab of window 1

--- listTabs
tell application "Safari"
  tell window 1
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

--- navigateTo
tell application "Safari" to set URL of current tab of window 1 to "{{URL}}"

--- setBounds
tell application "Safari" to set bounds of window 1 to {{{X}}, {{Y}}, {{RIGHT}}, {{BOTTOM}}}

--- switchTab
tell application "Safari" to tell window 1 to set current tab to tab {{INDEX}}

--- windowId
const app = Application("Safari");
const windows = app.windows();
if (windows.length === 0) throw new Error("No Safari window");
windows[0].id();
`;

/**
 * AppleScript template builder for Safari automation
 *
 * Parses all scripts from the embedded SCRIPTS constant at
 * construction time and provides typed methods with parameter
 * substitution for each automation command.
 *
 * @class AppleScript
 */
export class Automation {
  /**
   * Creates a new AppleScript instance
   *
   * Parses the embedded script constant into named sections.
   */
  constructor() {
    this.scripts = new Map();
    var sections = osaScripts.split(/^--- /m);
    for (var i = 1; i < sections.length; i++) {
      var newline = sections[i].indexOf('\n');
      var name = sections[i].substring(0, newline).trim();
      var body = sections[i].substring(newline + 1).trim();
      this.scripts.set(name, body);
    }
  }

  /**
   * Activates Safari application
   *
   * @returns {string} AppleScript string
   */
  activate() {
    return this.scripts.get('activate');
  }

  /**
   * Closes a specific tab by index
   *
   * @param {number} index - Tab index (1-based)
   * @returns {string} AppleScript string
   */
  closeTab(index) {
    return this.scripts.get('closeTab').replace('{{INDEX}}', index);
  }

  /**
   * Closes the front Safari window
   *
   * @returns {string} AppleScript string
   */
  closeWindow() {
    return this.scripts.get('closeWindow');
  }

  /**
   * Creates a new Safari document (window)
   *
   * @returns {string} AppleScript string
   */
  createDocument() {
    return this.scripts.get('createDocument');
  }

  /**
   * Creates a new tab, optionally navigating to a URL
   *
   * @param {string} [url] - URL to open in the new tab
   * @returns {string} AppleScript string
   */
  createTab(url) {
    if (url) {
      var escaped = url.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      return this.scripts.get('createTabWithUrl').replace('{{URL}}', escaped);
    }
    return this.scripts.get('createTab');
  }

  /**
   * Executes JavaScript in the current tab of the front window
   *
   * @param {string} script - JavaScript code to execute
   * @returns {string} AppleScript string
   */
  executeScript(script) {
    var escaped = script.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return this.scripts.get('executeScript').replace('{{SCRIPT}}', escaped);
  }

  /**
   * Gets the title of the current tab
   *
   * @returns {string} AppleScript string
   */
  getTitle() {
    return this.scripts.get('getTitle');
  }

  /**
   * Gets the URL of the current tab
   *
   * @returns {string} AppleScript string
   */
  getUrl() {
    return this.scripts.get('getUrl');
  }

  /**
   * Lists all tabs in the front window with index, title, URL, and active status
   *
   * @returns {string} AppleScript string returning JSON array
   */
  listTabs() {
    return this.scripts.get('listTabs');
  }

  /**
   * Navigates the current tab to a URL
   *
   * @param {string} url - URL to navigate to
   * @returns {string} AppleScript string
   */
  navigateTo(url) {
    var escaped = url.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return this.scripts.get('navigateTo').replace('{{URL}}', escaped);
  }

  /**
   * Sets the bounds of the front Safari window
   *
   * @param {number} x - Left position
   * @param {number} y - Top position
   * @param {number} width - Window width
   * @param {number} height - Window height
   * @returns {string} AppleScript string
   */
  setBounds(x, y, width, height) {
    return this.scripts.get('setBounds')
      .replace('{{X}}', x)
      .replace('{{Y}}', y)
      .replace('{{RIGHT}}', x + width)
      .replace('{{BOTTOM}}', y + height);
  }

  /**
   * Switches to a specific tab by index
   *
   * @param {number} index - Tab index (1-based)
   * @returns {string} AppleScript string
   */
  switchTab(index) {
    return this.scripts.get('switchTab').replace('{{INDEX}}', index);
  }

  /**
   * Gets the window ID of the front Safari window (JXA)
   *
   * @returns {string} JXA script string
   */
  windowId() {
    return this.scripts.get('windowId');
  }
}
