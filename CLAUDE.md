# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

```bash
npm install          # Install dependencies
npm run build        # Compile TypeScript to dist/
npm run dev          # Watch mode for development
npm start            # Run the MCP server
```

No test framework is currently configured.

## Architecture

This is an MCP (Model Context Protocol) server that wraps the SuperDB `super` binary, allowing AI assistants to execute SuperSQL queries without shell escaping issues.

### Core Structure

- **`src/index.ts`** - MCP server entry point. Registers all tools and resources, routes tool calls to implementations.
- **`src/lib/super.ts`** - Core subprocess execution. `runSuper()` spawns the `super` binary and handles stdin/stdout. All tools use this.
- **`src/lib/lsp-client.ts`** - LSP client for code intelligence features (completions, hover docs).
- **`src/lib/version.ts`** - Parses SuperDB version strings from `super --version` output.

### Tool Implementations

- **`src/tools/query.ts`** - `super_query`, `super_validate`, `super_schema` - file-based query operations
- **`src/tools/db.ts`** - `super_db_*` tools for database pool operations
- **`src/tools/info.ts`** - `super_info`, `super_help`, `super_test_compat` - version/docs/compatibility
- **`src/tools/lsp.ts`** - `super_complete`, `super_docs` - LSP-powered code intelligence

### Resources

The server exposes two MCP resources from `docs/`:
- `superdb://docs/expert` → `docs/superdb-expert.md` (query syntax guide)
- `superdb://docs/upgrade-guide` → `docs/zq-to-super-upgrades.md` (migration guide)

### Environment Variables

- `SUPER_PATH` - Path to super binary (default: `super` from PATH)
- `SUPERDB_LSP_PATH` - Path to SuperDB LSP server for code intelligence features

## Key Patterns

Tool implementations return structured result objects (e.g., `QueryResult`, `ValidateResult`) that get JSON-serialized back to the MCP client. Errors are caught and returned as `{ error: message }` with `isError: true`.

The `super_validate` tool includes migration hints for common zq→SuperDB syntax changes (yield→values, over→unnest, func→fn).
