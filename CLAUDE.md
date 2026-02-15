# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

```bash
npm install          # Install dependencies
npm run build        # Compile TypeScript to dist/
npm run dev          # Watch mode for development
npm start            # Run the MCP server
```

## Testing

Uses [Vitest](https://vitest.dev/) with globals enabled.

```bash
npm test             # Run tests once
npm run test:watch   # Watch mode
```

Tests live in `src/__tests__/`. Tests that require the `super` binary use `it.skipIf()` to skip gracefully when the binary is unavailable.

## Architecture

This is an MCP (Model Context Protocol) server that wraps the SuperDB `super` binary, allowing AI assistants to execute SuperSQL queries without shell escaping issues.

### Core Structure

- **`src/index.ts`** - MCP server entry point. Registers all tools and resources, routes tool calls to implementations.
- **`src/lib/super.ts`** - Core subprocess execution. `runSuper()` spawns the `super` binary and handles stdin/stdout. All tools use this.
- **`src/lib/lsp-client.ts`** - LSP client for code intelligence features (completions, hover docs).
- **`src/lib/version.ts`** - Parses SuperDB version strings from `super --version` output.

### Tool Implementations

- **`src/tools/query.ts`** - `super_query`, `super_schema` - file-based query operations
- **`src/tools/db.ts`** - `super_db_*` tools for database pool operations
- **`src/tools/info.ts`** - `super_info`, `super_help`, `super_test_compat` - version/docs/compatibility
- **`src/tools/lsp.ts`** - `super_complete`, `super_docs` - LSP-powered code intelligence

### Resources

The server exposes two MCP resources from `docs/`:
- `superdb://docs/expert` → `docs/superdb-expert.md` (query syntax guide)
- `superdb://docs/upgrade-guide` → `docs/zq-to-super-upgrades.md` (migration guide)

The authoritative source for these docs is [superkit](https://github.com/chrismo/superkit/tree/main/doc). Local copies are bundled so they ship with the npm package. Use `/sync` to pull the latest from superkit.

### Environment Variables

- `SUPER_PATH` - Path to super binary (default: `super` from PATH)
- `SUPERDB_LSP_PATH` - Path to SuperDB LSP server for code intelligence features

## Commit Checklist

Before every commit, check whether `CHANGELOG.md` needs an update. Not every commit warrants a changelog entry, but always consider it. New features, bug fixes, changed behavior, and new/removed tools should be logged. Minor refactors, README tweaks, and internal cleanups generally don't need entries.

## Key Patterns

Tool implementations return structured result objects (e.g., `QueryResult`) that get JSON-serialized back to the MCP client. Errors are caught and returned as `{ error: message }` with `isError: true`.

`superQuery` error responses include migration hints for common zq→SuperDB syntax changes (yield→values, over→unnest, func→fn) in a `suggestions` field.

## Versioning

The MCP server uses its own independent semver, decoupled from SuperDB's version. The SuperDB version it targets is tracked in metadata (e.g., `super_info` output and docs), not in the package version itself.

When bumping version, update both `package.json` and `src/index.ts`.

### History

Early releases used SuperDB pseudo-versions (`0.YMMDD` format, e.g., `0.51231.0`). Starting with `0.1.0`, the MCP version was briefly aligned with SuperDB's official release. Going forward, versions are fully decoupled.

## Publishing

Published to npm as `superdb-mcp`. Users install via:
```json
{
  "mcpServers": {
    "superdb": {
      "command": "npx",
      "args": ["superdb-mcp"]
    }
  }
}
```

### Release steps

1. Update version in `package.json` and `src/index.ts`
2. Update `CHANGELOG.md` with the new version and changes
3. Build and test:
   ```bash
   npm run build && npm test
   ```
4. Commit, tag, and push:
   ```bash
   git add -A
   git commit -m "Bump version to X.Y.Z"
   git tag vX.Y.Z
   git push && git push --tags
   ```
5. Publish:
   ```bash
   npm publish
   ```
   (`prepublishOnly` runs the build automatically)
