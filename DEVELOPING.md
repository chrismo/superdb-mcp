# Developing

## Local Development Setup

To use this MCP server across all your projects while actively developing it:

### Option 1: Direct path in Claude Code (recommended)

```bash
claude mcp add superdb -s user -- node /path/to/superdb-mcp/dist/index.js
```

After making changes, run `npm run build` and the server picks up changes automatically.

### Option 2: npm link (global symlink)

```bash
# In this repo
npm link

# Now available globally
claude mcp add superdb -s user -- npx superdb-mcp
```

Changes require `npm run build` to take effect.

### Option 3: Watch mode

Run in one terminal:
```bash
npm run dev  # watches and rebuilds on changes
```

Then configure Claude Code using Option 1 to point to the dist output.

## Build Commands

```bash
npm install          # Install dependencies
npm run build        # Compile TypeScript to dist/
npm run dev          # Watch mode for development
npm start            # Run the MCP server
```
