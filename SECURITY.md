# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 1.x     | ✅        |

## Reporting a Vulnerability

To report a security vulnerability, please use [GitHub's private vulnerability reporting](https://github.com/axivo/mcp-safari/security/advisories/new).

Do not open a public issue for security vulnerabilities. You can expect an initial response within 48 hours and a resolution or status update within 7 days.

## Scope and Security Considerations

This package is a macOS-only MCP server that controls Safari through Apple Events and JavaScript automation. It requires Screen & System Audio Recording permission for Terminal and JavaScript from Apple Events enabled in Safari — both are explicit user grants documented in the prerequisites.

The following threat vectors are in scope:

- Arbitrary code execution through MCP tool inputs
- Credential or session token exfiltration through the browser automation interface, including prompt injection attacks where a malicious webpage triggers the `execute` tool to read cookies or session tokens from an authenticated session
- Unintended JavaScript execution outside the active Safari session
- Supply chain compromise of published npm artifacts

> [!IMPORTANT]
> The `execute` tool intentionally runs JavaScript in the browser context via Apple Events. Vulnerabilities in how user-supplied scripts are handled by the MCP protocol layer are in scope. Vulnerabilities that require system access beyond the documented macOS permissions are out of scope.

### Screen Recording and Temporary Files

The `screenshot` tool uses the macOS `screencapture` binary to capture the Safari window. Screenshots may contain sensitive content visible in the browser (credentials, banking sessions, personal data). Captured images are written as temporary PNG files to the system temp directory (`os.tmpdir()`), read into memory, and immediately deleted. During this brief window, the unencrypted file is accessible to other processes running under the same user.

### Session and Authentication State

The server controls the user's actual Safari session with full access to cookies, local storage, and authentication state. The `execute` tool can run arbitrary JavaScript in the browser context, including reading `document.cookie`, session tokens, and DOM content from authenticated pages. A malicious MCP client or prompt injection attack could exploit this to exfiltrate sensitive session data.

### System Information Disclosure

The `search` tool reads macOS global preferences via `defaults read -g NSPreferredWebServices` to detect the user's default search engine. This exposes a system configuration value to the MCP client.

### Transport Authentication

The MCP server communicates over stdio transport — it is spawned as a child process by the MCP client, not a listening socket. There is no authentication layer between the client and server. Whoever controls the MCP client configuration controls the server entirely, with full browser automation capabilities. Security depends on restricting write access to `mcp.json` and trusting the MCP client (e.g., Claude Desktop, Claude Code) to enforce tool call boundaries.

## Supply Chain Integrity

All releases are published to npm using [trusted publishing](https://docs.npmjs.com/generating-provenance-statements) with npm provenance attestation enabled. Each published version is cryptographically linked to a specific GitHub Actions workflow run and commit.

To verify the integrity of an installed version, run:

```bash
npm audit signatures @axivo/mcp-safari
```
