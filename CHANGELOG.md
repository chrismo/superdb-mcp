# Changelog

All notable changes to this project will be documented in this file.

Version format: `0.YMMDD.patch` where YMMDD matches the SuperDB pseudo-version
of bundled docs. See [README](/README.md#versioning) for details.

## [0.1.0] - 2026-01-31

### Changed
- Version bump to match official SuperDB v0.1.0 release
- Synced docs from superkit

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
