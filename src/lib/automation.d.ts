/**
 * AppleScript template library type declarations
 *
 * @module lib/automation
 */

export class Automation {
  activate(): string;
  closeTab(index: number): string;
  closeWindow(): string;
  createDocument(): string;
  createTab(url?: string): string;
  executeScript(script: string): string;
  getTitle(): string;
  getUrl(): string;
  listTabs(): string;
  navigateTo(url: string): string;
  setBounds(x: number, y: number, width: number, height: number): string;
  switchTab(index: number): string;
  windowId(): string;
}
