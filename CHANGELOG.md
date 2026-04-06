# Changelog

All notable changes to this project will be documented in this file.

## [1.6.1] - 2026-04-05 (targets SuperDB v0.3.0)

### Fixed
- Server version in MCP handshake now reports 1.6.1 (was stuck at 1.5.0 in 1.6.0)
- Added changelog for 1.6.0 changes

## [1.6.0] - 2026-04-05 (targets SuperDB v0.3.0)

### Changed
- Content (docs, grok patterns, recipes, expert guide) now consumed from `@chrismo/superkit` npm package instead of bundled locally
- Removed local `docs/` directory and `src/lib/expert-sections.ts` — superkit is the single source of truth
- Removed `.github/workflows/sync-to-superkit.yml` (no longer needed)

## [1.5.0] - 2026-03-28 (targets SuperDB v0.3.0)

### Added
- Debug operator stderr output captured in `QueryResult.debug` field — queries using the `debug` operator now surface their stderr output in results
- New `debug` operator tutorial: basic usage, expressions, filter clause, collect/unnest subqueries, fork-based streaming, SQL hybrid, fn/op usage
- `infer` section added to grok tutorial showing `grok | infer` for auto-detecting types from parsed string fields

### Fixed
- `superInfo` compatibility check now uses the version-overridden binary instead of always checking the default

### Changed
- Updated all docs and tutorials to target SuperDB v0.3.0
- Updated content version in tool descriptions from v0.2.0 to v0.3.0
- Added v0.3.0 breaking changes to upgrade guide: BSUP v2 format, collect/union quiet error handling, null in concat/f-strings
- Added v0.3.0 new features to expert guide: `debug` operator, `infer` operator, `defuse` function, `unblend` function, optional record fields, fusion types, `db vacate` command
- Clarified license distinction between MCP server (BSD-3-Clause) and SuperDB in README

## [1.4.0] - 2026-03-28 (targets SuperDB v0.2.0)

### Added
- ASDF-based multi-version support: all binary-executing tools now accept an optional `version` parameter to target a specific SuperDB version via ASDF (e.g., `"0.2.0"`, `"0.51231"`) or a direct binary path
- New `src/lib/asdf.ts` module for ASDF version resolution with path caching

### Fixed
- `super_test_compat` no longer mutates `process.env.SUPER_PATH` (race condition fix); passes binary path directly to `runSuper`

## [1.3.3] - 2026-03-02 (targets SuperDB v0.2.0)

### Changed
- Chess tiebreaks tutorial: added intro paragraph about plain text processing
- Joins tutorial: dropped stale "In 0.1.0" version reference
- Subqueries tutorial: added performance footnote about SQL subquery file re-reads

### Removed
- Deleted `moar_subqueries` tutorial (rough notes, nothing actionable)
- Deleted `super_db_update` tutorial (unfinished draft)

## [1.3.2] - 2026-03-02 (targets SuperDB v0.2.0)

### Changed
- Rewrote expert guide and upgrade guide for general audience: removed agent-directed framing, toned down emphatic warnings to standard reference-doc style

## [1.3.1] - 2026-03-02 (targets SuperDB v0.2.0)

### Fixed
- Content target version in tool descriptions and compatibility check still said v0.1.0

## [1.3.0] - 2026-03-02 (targets SuperDB v0.2.0)

### Added
- Escape recipes (`docs/recipes/escape.spq`): `sk_csv_field`, `sk_csv_row`, `sk_shell_quote`, `sk_tsv_field` for safe output formatting
- Shell recipe type: recipes can now have `type:"shell"` with a `snippet` field for documenting CLI/subprocess patterns
- 4 shell recipes for safe text ingestion via `-i line`: `safe_text_to_record`, `safe_text_to_string`, `safe_multiline_to_record`, `safe_append_to_sup_file`
- `test-doc.sh` for running mdtest against tutorials via local brimdata/super checkout

### Fixed
- `sk_urldecode` recipe was calling `decode_seg` instead of `sk_decode_seg`
- Chess-tiebreaks tutorial: replaced removed expression-context `count(this)` with the `count` operator
- Subqueries tutorial: removed piped `from` with file path (disallowed in v0.2.0)
- Fixed `SITE_BASE` URL missing `/_build` path segment

### Changed
- Updated all docs to target SuperDB v0.2.0
- This repo is now the authoritative source for all docs (previously superkit)
- Doc frontmatter `source` field replaced with `web` field linking to published GitHub Pages
- Updated `/sync` command for new ownership model and standard semver

## [1.2.0] - 2026-02-20 (targets SuperDB v0.1.0)

### Added
- Expert doc section splitting: `super_help("expert")` now returns a slim overview (~80 lines) instead of the full 850-line document. Use `expert:<section>` (e.g. `expert:sql`, `expert:aggregates`) to fetch individual sections, or `expert:all` for the full document.
- Character recipes: `sk_seq` (generate_series workaround), `sk_hex_digits`, `sk_chr`, `sk_alpha`
- `web_url` field in `super_help` responses linking to online documentation at chrismo.github.io/superkit
- GitHub Action to auto-sync docs to superkit repo for GitHub Pages deployment

## [1.1.0] - 2026-02-15 (targets SuperDB v0.1.0)

### Added
- Smart error hint when `files` param is confused with SQL FROM clause file resolution — suggests using absolute paths in FROM
- Migration hint for `+` string concatenation removal — recommends f-string interpolation, `||`, or `concat()`
- Migration docs for string concat with `+` removed (PR 6486) and dynamic `from` requiring f-strings (PR 6450)
- `super_grok_patterns` tool — search/filter 89 grok patterns by name or regex content
- `super_recipes` tool — search/list 16 SuperDB recipe functions with skdoc metadata (signatures, descriptions, examples)
- Tutorial support in `super_help` — `tutorials` topic lists all, `tutorial:<name>` reads specific tutorials
- 8 tutorials imported from superkit: grok, subqueries, unnest, joins, sup_to_bash, super_db_update, moar_subqueries, chess-tiebreaks
- 5 recipe files imported from superkit: array, format, integer, records, string
- MCP resources for tutorials (`superdb://tutorials/{name}`), recipes (`superdb://recipes/{name}`), and grok patterns (`superdb://docs/grok-patterns`)
- `version_note` field in content tool responses when runtime version differs from content target (v0.1.0)
- `scheme` field in `VersionInfo` — classifies versions as `ymmdd`, `semver`, `sha`, or `unknown`
- `super_query` error responses suggest `super_docs` for function/keyword lookup when LSP is available

### Fixed
- Version comparison: YMMDD pre-release versions (e.g., 0.51231) are now correctly treated as older than semver releases (e.g., 0.1.0) — previously string comparison made them appear newer
- Version mismatch warning for YMMDD runtimes now explains the pre-release scheme instead of just saying "older"

### Changed
- Removed `super_validate` tool; migration hints now appear in `super_query` error responses
- `super_query` errors include a `suggestions` field with zq→SuperDB migration hints when applicable
- Clarified `files` parameter description to distinguish pipeline input from SQL FROM clause usage
- Moved dynamic `from` docs out of Lake-specific section — f-strings are general-purpose
- `super_help` topic parameter is no longer restricted to an enum — now accepts tutorial names

## [1.0.0] - 2026-02-14 (targets SuperDB v0.1.0)

### Changed
- Switched to decoupled semver (independent from SuperDB version)
- Bumped to 1.0.0 to supersede old pseudo-version scheme (0.51231.x)
- Excluded test files from published build
- Added publishing workflow docs to CLAUDE.md

## [0.1.0] - 2026-01-31 (targets SuperDB v0.1.0)

### Changed
- Version aligned with official SuperDB v0.1.0 release
- Synced docs from superkit
- Updated README to reflect official release status
- Fixed `super_validate` using wrong flag case (`-C` → `-c`)

## [0.51231.1] - 2025-01-05 (targets SuperDB 0.51231 pre-release)

### Fixed
- Added missing tools to README (super_info, super_help, super_test_compat,
  super_complete, super_docs)

## [0.51231.0] - 2025-01-05 (targets SuperDB 0.51231 pre-release)

### Added
- Initial npm release
- Query tools: `super_query`, `super_validate`, `super_schema`
- Database (Lake) tools: `super_db_list`, `super_db_query`, `super_db_load`,
  `super_db_create_pool`
- Info tools: `super_info`, `super_help`, `super_test_compat`
- LSP tools: `super_complete`, `super_docs`
- Bundled documentation for SuperDB 0.51231
- Migration hints for zq→SuperDB syntax changes in `super_validate`
