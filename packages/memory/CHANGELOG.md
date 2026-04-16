# Changelog

## [Unreleased]

### 🐛 Critical Bug Fixes

- **SQL Injection** - Fixed parameterized queries in `find()` method. Previously used string interpolation for LIMIT, now uses proper parameters.
- **Conditional Validation** - Added Zod superRefine to prevent code_symbol fields on non-code_symbol memory types.
- **API Inconsistency** - Changed `find()` and `stats()` to return `Result<T>` type for consistent error handling.
- **Index On Expiration** - Added `idx_expires_at` index for fast expired memory cleanup.

### 🚀 New Features

- **Auto Expunge** - `startAutoExpunge(intervalMs?)` / `stopAutoExpunge()` - Automatically delete expired memories on a schedule (default: every 24h).
- **Weight Decay** - `startAutoDecay(options?)` / `stopAutoDecay()` - Gradually reduce weight of unused memories to prioritize recently used info.
- **Direct File Deletion** - `deleteByFilePath(filePath)` - Efficiently delete all code symbols for a given file (uses index, no ID tracking needed).
- **Export/Import** - `exportJSON()` and `importJSON(data)` - Backup/restore memories with duplicate detection by ID.
- **Improved Similarity** - Added `cosine-tfidf` algorithm for duplicate merging (configurable via `similarityAlgorithm` option in `consolidate()`).
- **Additional Index** - Added compound index `idx_file_path_type` for better file-path + type queries.

### ⚡ Performance & Reliability

- **Transaction Support** - Added `transaction<T>(fn)` method for atomic batch operations.
- **File Size Limit** - Code indexer now skips files > 1MB to prevent hanging.
- **List Limit** - Default `list()` limit reduced from 10000 to 1000 to prevent OOM.
- **Cleanup Improvement** - `removeFileIndex()` now uses direct DELETE by file_path instead of ID tracking.

### 📚 Documentation

- Added comprehensive Advanced Features section covering auto-cleanup, batch operations, import/export, and similarity algorithms.
- Documented all new store methods with usage examples.
- Added code symbol indexing capabilities section.

### 🔧 Under the Hood

- Schema validation now conditional on `type` field.
- Memory type consistency enforced across interfaces.
- Prepared statements reused for better performance.
- WAL mode enabled for better concurrency.

## [0.65.2] - 2026-04-13

- Initial release