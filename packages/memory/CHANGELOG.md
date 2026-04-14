# Changelog

## [Unreleased]

### Fixed

- **CRITICAL**: Fixed memory path logic to use unified database across all sessions. Previously, different sessions would create separate databases, preventing cross-session memory sharing. Now all sessions use `~/.pi/agent/memory.db` consistently.
- **MEDIUM**: Improved unicode search support. Added fallback to LIKE pattern matching when FTS5 cannot process unicode characters in search queries. Now searches like "你好世界" work correctly.
- **MEDIUM**: Improved special characters search support. Added fallback to LIKE pattern matching when FTS5 cannot process special characters like `@#$%^&*()`. Now searches with special characters work correctly.

### Changed

- Enhanced search behavior to automatically fallback from FTS5 to LIKE when FTS5 fails or returns no results, ensuring comprehensive search coverage.
- Updated documentation with search behavior and limitations section.

### Added

- Initial release of `@mariozechner/pi-coding-memory` - SQLite-backed memory store for coding agents. Save and recall preferences, project facts, commands, and solutions across sessions.

## [0.65.2] - 2026-04-13

First release as part of pi-monorepo lockstep versioning