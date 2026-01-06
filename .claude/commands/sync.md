# Sync SuperDB Docs

Pull latest docs from superkit, check LSP version sync, update if changed, and prepare for npm publish.

**This command runs autonomously. No user confirmation required.**

## Execution Plan

### Phase 1: Fetch Latest Docs from Superkit

Use WebFetch to get the raw content:

1. Fetch `https://raw.githubusercontent.com/chrismo/superkit/main/doc/superdb-expert.md`
2. Fetch `https://raw.githubusercontent.com/chrismo/superkit/main/doc/zq-to-super-upgrades.md`

### Phase 2: Compare with Current Bundled Docs

1. Read current `docs/superdb-expert.md`
2. Read current `docs/zq-to-super-upgrades.md`
3. Compare content (ignore whitespace differences)
4. Extract version from upgrade doc header - look for pattern: `SuperDB Version (\d+\.\d+)`

### Phase 3: Check LSP Release Version

1. Fetch `https://api.github.com/repos/chrismo/superdb-lsp/releases/latest`
2. Extract version from `tag_name` (format: `vX.XXXXX.X`)
3. Compare with doc version
4. Note sync status:
   - **in-sync**: doc version matches LSP version (ignoring patch)
   - **docs-ahead**: doc version > LSP version (docs updated, LSP not released yet)
   - **docs-behind**: doc version < LSP version (need to sync docs)

### Phase 4: Update if Docs Changed

If fetched docs differ from current:

1. **Update docs**:
   - Write fetched content to `docs/superdb-expert.md`
   - Write fetched content to `docs/zq-to-super-upgrades.md`

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

### Phase 5: Report Summary

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
