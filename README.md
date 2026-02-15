# SuperDB MCP Server

An MCP (Model Context Protocol) server for [SuperDB](https://superdb.org/) that
enables AI assistants to better compose SuperSQL queries, optionally backed by
an LSP.

## About

[SuperDB](https://superdb.org/) is the successor to
[zq](https://www.brimdata.io/blog/introducing-zq/) from [Brim
Data](https://www.brimdata.io/). LLMs have limited knowledge of its syntax, so
this MCP server provides the context AI assistants need to write correct queries.

## Installation

### Claude Code CLI

```bash
# Install for current project only
claude mcp add superdb -- npx -y superdb-mcp@latest

# Install for all projects (user scope)
claude mcp add --scope user superdb -- npx -y superdb-mcp@latest
```

Using `@latest` auto-upgrades the MCP server on each Claude launch. To pin a
specific version, replace `@latest` with a version number (e.g., `@0.1.0`).

### Manual Configuration

Add to your Claude Code settings (`~/.claude/settings.json`) or project `.mcp.json`:

```json
{
  "mcpServers": {
    "superdb": {
      "command": "npx",
      "args": ["-y", "superdb-mcp@latest"]
    }
  }
}
```

Or install globally:

```bash
npm install -g superdb-mcp
```

```json
{
  "mcpServers": {
    "superdb": {
      "command": "superdb-mcp"
    }
  }
}
```

### From Source

```bash
git clone https://github.com/chrismo/superdb-mcp.git
cd superdb-mcp
npm install
npm run build
```

```json
{
  "mcpServers": {
    "superdb": {
      "command": "node",
      "args": ["/path/to/superdb-mcp/dist/index.js"]
    }
  }
}
```

## Tools

### Query Tools

#### `super_query`
Execute a SuperSQL query on data files. On errors, includes migration hints for
common zq-to-SuperDB syntax changes (yield→values, over→unnest, func→fn, etc.).

```
query: string         # Required: The SuperSQL query
files?: string[]      # Pipeline-style input (not for SQL FROM; use absolute paths in FROM)
data?: string         # Inline data (alternative to files)
format?: string       # Output: json (default), sup, csv, table
inputFormat?: string  # Force input format
```

#### `super_schema`
Inspect types in a data file by sampling records.

```
file: string          # Path to data file
sample?: number       # Records to sample (default: 5)
```

### Database Tools

#### `super_db_list`
List all pools in a SuperDB database.

```
lake?: string         # Lake path (default: ~/.super)
```

#### `super_db_query`
Query data from a database pool.

```
query: string         # The SuperSQL query
pool?: string         # Pool name
lake?: string         # Lake path
format?: string       # Output format
```

#### `super_db_load`
Load data into a pool.

```
pool: string          # Pool name
files?: string[]      # Files to load
data?: string         # Inline data
lake?: string         # Lake path
```

#### `super_db_create_pool`
Create a new pool.

```
name: string          # Pool name
orderBy?: string      # Sort key
lake?: string         # Lake path
```

### Info Tools

#### `super_info`
Get SuperDB version info, environment configuration, LSP availability, and installation instructions.

```
compare_to?: string   # Optional path to another super binary to compare
```

#### `super_lsp_status`
Check if the SuperDB LSP is installed and get installation instructions if not.

```
# No parameters - returns availability status and setup instructions
```

#### `super_help`
Get SuperDB documentation (bundled expert guide or migration docs).

```
topic: string         # "expert", "upgrade", "upgrade-guide", or "migration"
```

#### `super_test_compat`
Test a query against multiple SuperDB versions to detect breaking changes.

```
query: string         # The query to test
versions: string[]    # Paths to different super binaries
```

### LSP Tools

Require `SUPERDB_LSP_PATH` environment variable to be set.

#### `super_complete`
Get code completions for a SuperSQL query at a cursor position.

```
query: string         # The query text
line: number          # Line number (0-based)
character: number     # Character offset (0-based)
```

#### `super_docs`
Get documentation for a symbol at a position in a query.

```
query: string         # The query text
line: number          # Line number (0-based)
character: number     # Character offset (0-based)
```

## Example Usage

With the MCP server configured, Claude can execute queries like:

```
super_query({
  query: "where status == 'active' | aggregate count() by category",
  files: ["data.json"]
})
```

No shell escaping needed - the query string is passed directly.

## Requirements

- Node.js 18+
- `super` binary in PATH:
  - [Homebrew](https://superdb.org/getting-started/install.html#homebrew) (official, latest build)
  - [asdf-superdb](https://github.com/chrismo/asdf-superdb) (community, versioned builds)

## Versioning

This MCP server versions to match the SuperDB release it targets. The
`super_info` tool reports both your runtime version and the bundled docs
version, warning if they differ.

## License

BSD 3-Clause License
