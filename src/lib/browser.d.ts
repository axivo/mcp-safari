/**
 * Browser script library type declarations
 *
 * @module lib/browser
 */

export class Browser {
  serialize(fn: Function, ...args: any[]): string;
  clickElement(text: string): string;
  clickSelector(text: string, selector: string): string;
  consoleErrors(): string;
  errorCapture(): string;
  pageInfo(): string;
  typeText(text: string, selector?: string, append?: boolean, submit?: boolean): string;
}
