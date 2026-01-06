# SuperDB MCP Server

An MCP (Model Context Protocol) server for [SuperDB](https://superdb.org/) that enables AI assistants to execute SuperSQL queries without shell escaping issues.

## Why?

SuperDB queries contain lots of shell metacharacters (`|`, `{}`, `$`, quotes, etc.) that cause escaping nightmares when passed through bash. This MCP server bypasses the shell entirely - Claude sends clean JSON parameters, and the server handles subprocess execution properly.

## Installation

```bash
# Clone and build
git clone <repo-url>
cd superdb-mcp
npm install
npm run build
```

## Configuration

Add to your Claude Code settings (`~/.claude/settings.json`):

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

Or add to your project's `.mcp.json`:

```json
{
  "mcpServers": {
    "superdb": {
      "command": "node",
      "args": ["./path/to/superdb-mcp/dist/index.js"]
    }
  }
}
```

## Tools

### Query Tools

#### `super_query`
Execute a SuperSQL query on data files.

```
query: string         # Required: The SuperSQL query
files?: string[]      # File paths to query
data?: string         # Inline data (alternative to files)
format?: string       # Output: json (default), sup, csv, table
inputFormat?: string  # Force input format
```

#### `super_validate`
Validate query syntax without executing.

```
query: string         # The query to validate
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
- `super` binary in PATH ([installation](https://superdb.org/getting-started/install))

## License

MIT
