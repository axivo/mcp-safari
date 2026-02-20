/**
 * Browser script library type declarations
 *
 * @module lib/browser
 */

export class Browser {
  clickCoordinates(x: number, y: number): string;
  clickDirect(selector: string): string;
  clickElement(text: string): string;
  clickSelector(text: string, selector: string): string;
  consoleErrors(): string;
  errorCapture(): string;
  keypress(key: string, selector?: string): string;
  pageInfo(): string;
  serialize(fn: Function, ...args: any[]): string;
  typeText(text: string, selector?: string, append?: boolean, submit?: boolean): string;
}
