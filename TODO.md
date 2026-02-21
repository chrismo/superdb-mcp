# TODO

## Distribution

- [ ] Submit to Anthropic's Claude Desktop Extension Directory
  - Package as `.mcpb` file (zip with manifest.json)
  - Submit via Anthropic's desktop extensions interest form
  - Enables one-click install for Claude Desktop users
  - Docs: https://support.claude.com/en/articles/12922929-building-desktop-extensions-with-mcpb

- [ ] Submit to MCP Registry (registry.modelcontextprotocol.io)
  - Open catalog for MCP server discoverability
  - GitHub: https://github.com/modelcontextprotocol/registry

## Docs

- [ ] Rewrite docs for a general audience (not agent-specific)
  - Expert guide opens with "You are a SuperDB expert" and agent-directed framing
  - Upgrade guide says "designed for AI assistants performing automated upgrades"
  - Language should be useful to humans and bots alike

- [ ] Add `guides/` top-level folder for the two guide docs
  - `docs/guides/superdb-expert.md`, `docs/guides/zq-to-super-upgrades.md`
  - Update sync workflow output paths (`_build/guides/`)
  - Update superkit `index.md` link paths
  - Keeps guides separate from tutorials in the source tree

- [ ] Rethink code block formatting in guide docs
  - Both guides have `bash` blocks that mix commands and output on consecutive lines
  - mdtest-command/mdtest-output pairs work well for tutorials but may be too heavy for guides
  - Consider what makes sense for the guide format: mdtest, custom tags, or something else
  - Goal: correct syntax highlighting and (ideally) testable examples

- [ ] General docs overhaul
  - Review all content for accuracy against current SuperDB v0.1.0
  - Tighten prose, remove redundancy
  - Ensure consistent formatting across guides and tutorials
