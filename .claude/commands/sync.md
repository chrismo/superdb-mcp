# Sync SuperDB Docs

Pull latest docs from superkit, check LSP version sync, update if changed, and prepare for npm publish.

**This command runs autonomously. No user confirmation required.**

## Execution Plan

### Phase 1: Fetch Latest Docs from Superkit

Use curl to get the exact raw content (WebFetch summarizes, we need exact):

```bash
curl -sS https://raw.githubusercontent.com/chrismo/superkit/main/doc/superdb-expert.md > /tmp/superdb-expert-new.md
curl -sS https://raw.githubusercontent.com/chrismo/superkit/main/doc/zq-to-super-upgrades.md > /tmp/zq-to-super-upgrades-new.md
```

Extract the version from the upgrade doc header:
```bash
grep -o 'SuperDB Version [0-9.]*' /tmp/zq-to-super-upgrades-new.md | grep -o '[0-9.]*'
```

### Phase 2: Breaking Change Scan

This phase is **informational only** — it reports findings for human review, doesn't auto-update anything.

**Step 1: Check asdf-superdb versions.txt**

1. Fetch `https://raw.githubusercontent.com/chrismo/asdf-superdb/main/scripts/versions.txt` using curl
2. Get the last synced SuperDB version from the upgrade doc frontmatter (`superdb_version` field, already extracted in Phase 1)
3. Get the current `super` binary version via `super --version`
4. Parse versions.txt to find all comment blocks containing "breaking" (case-insensitive) that appear **after** the last synced version's entries
5. Report any found with their associated PR links

**Step 2: Check LSP CHANGELOG**

1. Fetch `https://raw.githubusercontent.com/chrismo/superdb-lsp/main/CHANGELOG.md` using curl
2. Extract entries newer than the last synced SuperDB version
3. Surface any "Changed", "Breaking", or "Removed" sections
4. If CHANGELOG is unavailable or empty, note that and move on

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

### Phase 3: Compare with Current Bundled Docs

**Note:** Bundled docs have YAML frontmatter that superkit originals don't have. Compare the body content only.

1. Read current `docs/superdb-expert.md` and `docs/zq-to-super-upgrades.md`
2. Strip YAML frontmatter (everything between `---` markers at the top) for comparison
3. Compare body content with fetched files
4. Extract current bundled version from frontmatter: `superdb_version: "X.XXXXX"`
5. Compare with fetched version from header: `SuperDB Version X.XXXXX`

### Phase 4: Check LSP Release Version

1. Fetch `https://api.github.com/repos/chrismo/superdb-lsp/releases/latest`
2. Extract version from `tag_name` (format: `vX.XXXXX.X`)
3. Compare with doc version
4. Note sync status:
   - **in-sync**: doc version matches LSP version (ignoring patch)
   - **docs-ahead**: doc version > LSP version (docs updated, LSP not released yet)
   - **docs-behind**: doc version < LSP version (need to sync docs)

### Phase 5: Update if Docs Changed

If fetched docs differ from current:

1. **Update docs** (preserve YAML frontmatter format):

   For `docs/superdb-expert.md`, prepend frontmatter:
   ```yaml
   ---
   name: superdb-expert
   description: "Expert guide for SuperDB queries and data transformations. Covers syntax, patterns, and best practices."
   superdb_version: "X.XXXXX"
   last_updated: "YYYY-MM-DD"
   source: "https://github.com/chrismo/superkit/blob/main/doc/superdb-expert.md"
   ---
   ```

   For `docs/zq-to-super-upgrades.md`, prepend frontmatter:
   ```yaml
   ---
   name: zq-to-super-upgrades
   description: "Migration guide from zq to SuperDB. Covers all breaking changes and syntax updates."
   superdb_version: "X.XXXXX"
   last_updated: "YYYY-MM-DD"
   source: "https://github.com/chrismo/superkit/blob/main/doc/zq-to-super-upgrades.md"
   ---
   ```

   Then append the fetched content (stripping any duplicate header if present).

2. **Determine new version**:
   - Extract doc version from upgrade doc header (e.g., `0.51232`)
   - Read current version from `package.json`
   - If doc version changed: new version = `{doc_version}.0`
   - If only doc content changed (same version): increment patch (e.g., `0.51231.1` → `0.51231.2`)

3. **Update package.json**:
   - Change `"version": "X.X.X"` to new version

4. **Update src/index.ts**:
   - Change `version: 'X.X.X'` to new version

5. **Update CHANGELOG.md**:
   - Add new entry at top (after header) with format:
   ```markdown
   ## [X.X.X] - YYYY-MM-DD

   ### Changed
   - Synced docs from superkit (SuperDB version X.XXXXX)
   ```

6. **Commit**:
   ```bash
   git add docs/ package.json src/index.ts CHANGELOG.md
   git commit -m "Sync docs from superkit (SuperDB X.XXXXX)

   - Updated superdb-expert.md
   - Updated zq-to-super-upgrades.md
   - Version: X.X.X

   🤖 Generated with [Claude Code](https://claude.com/claude-code)

   Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
   ```

7. **Push**:
   ```bash
   git push
   ```

### Phase 6: Report Summary

Output a summary:

```
## Sync Complete

**Docs Version**: 0.XXXXX
**LSP Version**: 0.XXXXX.X
**MCP Version**: 0.XXXXX.X
**Status**: [in-sync | docs-ahead | docs-behind]

### Changes
- [list what was updated, or "No changes - docs already in sync"]

### Next Steps
- [If changes made]: Ready for `npm publish`
- [If docs-behind]: Consider running /sync in superkit first
```

## Notes

- The doc version comes from the `zq-to-super-upgrades.md` header
- LSP version format: `0.YMMDD.P` (Y=last digit of year, MM=month, DD=day, P=patch)
- MCP version should match doc version with its own patch number
- Always check LSP sync status even if docs haven't changed
