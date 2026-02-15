# Changelog

All notable changes to this project will be documented in this file.

## [1.0.1] - Unreleased

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

### Changed
- Removed `super_validate` tool; migration hints now appear in `super_query` error responses
- `super_query` errors include a `suggestions` field with zq→SuperDB migration hints when applicable
- Clarified `files` parameter description to distinguish pipeline input from SQL FROM clause usage
- Moved dynamic `from` docs out of Lake-specific section — f-strings are general-purpose
- `super_help` topic parameter is no longer restricted to an enum — now accepts tutorial names

## [1.0.0] - 2026-02-14

### Changed
- Switched to decoupled semver (independent from SuperDB version)
- Bumped to 1.0.0 to supersede old pseudo-version scheme (0.51231.x)
- Excluded test files from published build
- Added publishing workflow docs to CLAUDE.md

## [0.1.0] - 2026-01-31

### Changed
- Version aligned with official SuperDB v0.1.0 release
- Synced docs from superkit
- Updated README to reflect official release status
- Fixed `super_validate` using wrong flag case (`-C` → `-c`)

## [0.51231.1] - 2025-01-05

### Fixed
- Added missing tools to README (super_info, super_help, super_test_compat,
  super_complete, super_docs)

## [0.51231.0] - 2025-01-05

### Added
- Initial npm release
- Query tools: `super_query`, `super_validate`, `super_schema`
- Database (Lake) tools: `super_db_list`, `super_db_query`, `super_db_load`,
  `super_db_create_pool`
- Info tools: `super_info`, `super_help`, `super_test_compat`
- LSP tools: `super_complete`, `super_docs`
- Bundled documentation for SuperDB 0.51231
- Migration hints for zq→SuperDB syntax changes in `super_validate`
