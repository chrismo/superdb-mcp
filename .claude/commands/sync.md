# Sync SuperDB Docs

Check for upstream SuperDB breaking changes, verify LSP version sync, and push docs to superkit for web publishing.

**This command runs autonomously. No user confirmation required.**

## Context

This repo (superdb-mcp) is the **authoritative source** for all docs, tutorials, recipes, and grok patterns. Superkit consumes them for web publishing via the `sync-to-superkit.yml` GitHub Action. The upstream SuperDB repo (brimdata/super) may introduce breaking changes that need to be reflected in the migration guide and expert doc.

## Execution Plan

### Phase 1: Breaking Change Scan

This phase is **informational only** — it reports findings for human review, doesn't auto-update anything.

**Step 1: Extract current doc version**

Read the frontmatter from `docs/zq-to-super-upgrades.md` to get the current `superdb_version`.

**Step 2: Check asdf-superdb versions.txt**

1. Fetch `https://raw.githubusercontent.com/chrismo/asdf-superdb/main/scripts/versions.txt` using curl
2. Parse versions.txt to find all comment blocks containing "breaking" (case-insensitive) that appear **after** the current doc version's entries
3. Report any found with their associated PR links

**Step 3: Check LSP CHANGELOG**

1. Fetch `https://raw.githubusercontent.com/chrismo/superdb-lsp/main/CHANGELOG.md` using curl
2. Extract entries newer than the current doc version
3. Surface any "Changed", "Breaking", or "Removed" sections
4. If CHANGELOG is unavailable or empty, note that and move on

**Step 4: Investigate breaking changes with research.sh**

If breaking changes were found in Steps 2-3, use `./scripts/research.sh` to gather context:

```bash
# Search issues/PRs for details on a breaking change
./scripts/research.sh search "string concatenation"

# Find the relevant commits
./scripts/research.sh commits "concat operator"

# Read the full issue/PR discussion
./scripts/research.sh issue 6486

# Check if docs were updated for the change
./scripts/research.sh code "concat"

# Compare doc pages across releases
./scripts/research.sh docs super-sql/expressions/intro --ref v0.1.0
./scripts/research.sh docs super-sql/expressions/intro --ref main
```

This helps understand the scope and intent of breaking changes before updating the migration guide.

**Output this section in your summary:**

```
### Breaking Change Scan

**asdf-superdb annotations (since {last_version}):**
- [breaking] + no longer concats strings. || still working and concat added. (PR 6486)
- (or: none found)

**LSP CHANGELOG (since {last_version}):**
- Changed: removed + operator for string concatenation
- (or: no new entries / CHANGELOG not available)

⚠️ Review these for migration guide updates before publishing.
```

### Phase 2: Check LSP Release Version

1. Fetch `https://api.github.com/repos/chrismo/superdb-lsp/releases/latest`
2. Extract version from `tag_name` (standard semver, e.g., `v0.2.0`)
3. Compare with doc version using semver comparison
4. Note sync status:
   - **in-sync**: doc version matches LSP version
   - **docs-ahead**: doc version > LSP version (docs updated, LSP not released yet)
   - **docs-behind**: doc version < LSP version (need to update docs)

### Phase 3: Report Summary

Output a summary:

```
## Sync Report

**Docs Version**: X.Y.Z (from frontmatter superdb_version)
**LSP Version**: X.Y.Z (from latest GitHub release)
**MCP Version**: X.Y.Z (from package.json)
**LSP Status**: [in-sync | docs-ahead | docs-behind]

### Breaking Change Scan
[Include the full breaking change scan output from Phase 1 here]

### Superkit Sync
Docs are automatically pushed to superkit via the sync-to-superkit.yml GitHub Action on pushes to main that touch docs/.

### Next Steps
- [If breaking changes found]: Update migration guide and expert doc, then bump version
- [If docs-behind]: Consider updating docs to match latest SuperDB release
- [If everything in sync]: No action needed
```

## Notes

- `./scripts/research.sh` is available for investigating the brimdata/super repo (issues, PRs, commits, code, docs). All read-only. Run `./scripts/research.sh --help` for usage.
- The doc version comes from the `zq-to-super-upgrades.md` frontmatter (`superdb_version` field)
- All versions (SuperDB, LSP, MCP) use standard semver
- MCP version is independent — see CLAUDE.md versioning section
- Always check LSP sync status even if docs haven't changed
