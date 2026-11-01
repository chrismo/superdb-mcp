# SuperDB MCP Server

An MCP (Model Context Protocol) server for [SuperDB](https://superdb.org/) that
enables AI assistants to better compose SuperSQL queries, optionally backed by
an LSP.

## Table of Contents

- [About](#about)
- [Installation](#installation)
  - [LSP (Optional)](#lsp-optional)
- [Tools](#tools)
  - [Query & Data](#query--data)
  - [Database](#database)
  - [Documentation & Reference](#documentation--reference)
  - [Environment & Diagnostics](#environment--diagnostics)
  - [LSP Tools](#lsp-tools)
- [Example Usage](#example-usage)
- [Requirements](#requirements)
- [Versioning](#versioning)

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

### LSP (Optional)

Only [`super_complete` and `super_docs`](#lsp-tools) use the LSP — query execution,
documentation, grok patterns, recipes, and database tools are fully
functional on their own. The
[SuperDB LSP](https://github.com/chrismo/superdb-lsp) adds code completions
and symbol documentation for those who want it. Download a binary from the
[releases page](https://github.com/chrismo/superdb-lsp/releases), then
point the MCP server to it:

```bash
export SUPERDB_LSP_PATH=/path/to/superdb-lsp
```

Add the export to your shell profile for persistence. Run `super_lsp_status`
to verify setup.

## Tools

### Query & Data

#### `super_query`
Execute a SuperSQL query on data files. On errors, includes migration hints for
common zq-to-SuperDB syntax changes (yield→values, over→unnest, func→fn, etc.)
and SuperDB v0.4.0 changes (has→is_ok, quiet→ok, fields→paths,
max(a,b)→greatest, blend→fuse, `|[...]|`→`set[...]`, `::time`→`::timestamp`,
and more).

```
query: string         # Required: The SuperSQL query
files?: string[]      # Pipeline-style input (not for SQL FROM; use absolute paths in FROM)
data?: string         # Inline data (alternative to files)
format?: string       # Output: json (default), sup, csv, line, tsv, zeek
inputFormat?: string  # Input format; needed for files without a recognized extension
static?: boolean      # super -static: type-check all inputs (for SQL on JSON/CSV)
```

As of SuperDB v0.4.0, a local file's format comes from its extension, so a file
without a recognized one needs `inputFormat`. SQL features like `SELECT *` and
alias-qualified joins need statically typed input; JSON and CSV are dynamic, so
set `static: true` for them.

Binary formats (`bsup`, `db`, `parquet`, `arrows`) are rejected: results
are returned as text, and binary output does not survive UTF-8 decoding. Use
`line` for undecorated scalar output. The `table`, `jsup`, and `csup` formats
were removed in SuperDB v0.4.0.

#### `super_schema`
Inspect types in a data file by finding unique shapes with counts and examples.

```
file: string          # Path to data file
inputFormat?: string  # Input format; needed for files without a recognized extension
```

### Database

These tools target SuperDB v0.4.0+, where database _pools_ became _tables_ and
`super db attach` replaced `super db auth`/`login` and `SUPER_DB`. Each tool
takes an optional `database` (a path or URL, passed as `super db -attach`);
without it, `super` uses the database attached with `super db attach`. Create a
database with `super db init <path>`.

The pre-v0.4.0 parameter names `pool` and `lake`, and the tool name
`super_db_create_pool`, are still accepted.

#### `super_db_query`
Run a query or SQL statements against a database. Supports SQL `CREATE TABLE`,
`CREATE SUPER TABLE`, `INSERT INTO`, and `DROP TABLE`; separate statements with
`;`. Each statement returns a status record; if one fails, the records of the
statements before it are still returned.

```
query: string         # The SuperSQL query or SQL statements
table?: string        # Table (or table@branch) to read unless the query has a top-level FROM
database?: string     # Database path or URL (default: attached database)
format?: string       # Output: json (default), sup, csv, line, tsv, zeek
```

#### `super_db_list`
List the tables in a database, with their sort keys.

```
database?: string     # Database path or URL (default: attached database)
```

#### `super_db_create_table`
Create a table. Tables are unsorted unless `orderBy` is set. With `type`, every
loaded value is cast to it, and a load is rejected if any value can't be cast.

```
name: string          # Table name (`table` is accepted too)
orderBy?: string      # Sort key, e.g. "ts:desc"
type?: string         # SUP type, e.g. "{id:int64,msg:string}"
database?: string     # Database path or URL (default: attached database)
```

#### `super_db_load`
Load files or inline data into a table.

```
table: string         # Table name
files?: string[]      # Files to load
data?: string         # Inline data
database?: string     # Database path or URL (default: attached database)
```

### Documentation & Reference

Content comes from [`@chrismo/superkit`](https://github.com/chrismo/superkit)
and targets the SuperDB release its docs declare (shown in each tool's
description). Responses include a `version_note` when the installed runtime
differs from the content target.

#### `super_help`
Get SuperDB documentation — expert guide, migration docs, or tutorials.

```
topic: string         # "expert", "upgrade", "tutorials", or "tutorial:<name>"
```

#### `super_grok_patterns`
Search/filter 89 grok patterns for parsing logs, timestamps, IPs, and more.

```
query?: string        # Filter by pattern name or regex content
```

#### `super_recipes`
Search/list 16 recipe functions (from superkit) with signatures, descriptions, and examples.

```
query?: string        # Filter by function name, description, or source file
```

### Environment & Diagnostics

#### `super_info`
Get SuperDB version info, environment configuration, LSP availability, and installation instructions.

```
compare_to?: string   # Optional path to another super binary to compare
```

#### `super_lsp_status`
Check if the SuperDB LSP is installed and get installation instructions if not.

```
# No parameters
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
  - [Homebrew](https://superdb.org/getting-started/install.html#homebrew): `brew install super` (official)
  - [GitHub releases](https://github.com/superdb/super/releases) (official binaries)
  - [asdf-superdb](https://github.com/chrismo/asdf-superdb) (community, versioned builds)
- The [database tools](#database) require SuperDB v0.4.0 or later

## Versioning

This MCP server uses its own independent semver, decoupled from SuperDB's
version. Query tools (`super_query`, `super_schema`, etc.) work with any
version of the `super` binary, so the MCP server is useful even if your
runtime is older or newer than the target. Bundled content — documentation,
tutorials, grok patterns, and recipes — is written for a specific SuperDB
release, so aligning your runtime with the target version gives the best
results. The `super_info` tool reports both versions, and content tools
include a `version_note` when they differ.

The optional [SuperDB LSP](#lsp-optional) enables code completions and
documentation lookup — see [installation instructions](#lsp-optional).

| MCP Version | SuperDB Target         | Notes                                          |
|-------------|------------------------|-------------------------------------------------|
| 2.0.0       | v0.4.0                 | Database tables, v0.4.0 migration hints         |
| 1.1.0       | v0.1.0                 | Grok patterns, tutorials, recipes from superkit |
| 1.0.0       | v0.1.0                 | Switched to independent semver                  |
| 0.1.0       | v0.1.0                 | Aligned with first official SuperDB release     |
| 0.51231.x   | 0.51231 (pre-release)  | Legacy pseudo-version scheme                    |

## License

This MCP server is licensed under the
[BSD-3-Clause License](https://opensource.org/licenses/BSD-3-Clause).

This project wraps [SuperDB](https://github.com/superdb/super), which is
licensed under the
[SuperDB Source Available License](https://github.com/superdb/super/blob/main/LICENSE.md).
The MCP server does not distribute SuperDB source code or binaries; it invokes
a locally installed `super` binary at runtime.
