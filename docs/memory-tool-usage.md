# Memory Tool Usage Guide

Comprehensive documentation for the `memory` tool in pi coding agent.

## Overview

The `memory` tool provides persistent storage for coding agents to remember information across sessions. It uses SQLite with full-text search (FTS5) for fast, relevant retrieval of user preferences, project facts, commands, and solutions.

## Memory Types

| Type | Description | Example |
|------|-------------|---------|
| `preference` | User coding style, editor settings, language versions | "4 spaces for indentation", "Python 3.11" |
| `project` | Project-specific facts (DB, APIs, URLs, env vars) | "PostgreSQL 14", "API: http://localhost:3000" |
| `command` | Terminal commands, workflows, scripts | "Test: npm run test:cov", "Deploy: ./deploy.sh" |
| `solution` | Bug fixes, code patterns, workarounds | "Check null before division", "Use debounce 300ms" |
| `note` | General notes, meeting summaries, ideas | "ADR: chose React over Vue" |

## Operations

### 1. Save - Store Information

Save information to memory with optional tags, weight, and expiration.

**Syntax:**
```typescript
memory({
  op: "save",
  content: "string (required, max 10000 chars)",
  type: "preference | project | command | solution | note (required)",
  tags?: string[] | string,  // array or JSON string
  weight?: number,  // 0-1, default 0.5
  expires_at?: number  // Unix timestamp (ms)
})
```

**Examples:**

```typescript
// Save with all fields
memory({
  op: "save",
  content: "User prefers 4 spaces for Python indentation",
  type: "preference",
  tags: ["style", "python"],
  weight: 0.9
})

// Save with expiration (24 hours from now)
memory({
  op: "save",
  content: "Temporary deployment token: abc123",
  type: "note",
  expires_at: Date.now() + 24 * 60 * 60 * 1000
})

// Save using JSON string for tags (workaround for serialization issues)
memory({
  op: "save",
  content: "Project uses PostgreSQL",
  type: "project",
  tags: '["database", "postgres"]'  // JSON string alternative
})
```

### 2. Find - Search Memories

Search for memories by query with optional filters.

**Syntax:**
```typescript
memory({
  op: "find",
  query: "string (required)",
  type?: "preference | project | command | solution | note",
  tags?: string[] | string,  // AND logic filter
  limit?: number  // 1-100, default 10
})
```

**Examples:**

```typescript
// Basic search
memory({
  op: "find",
  query: "indentation"
})

// Search with type filter
memory({
  op: "find",
  query: "database",
  type: "project"
})

// Search with tags filter (AND logic)
memory({
  op: "find",
  query: "python",
  tags: ["style", "python"],
  limit: 20
})

// Search unicode content
memory({
  op: "find",
  query: "你好"
})
```

**Output Format:**
```
Found 2 memories:
- [preference] ID: mem_1776344853320_q8uow56k7
  User prefers 4 spaces for Python indentation
- [project] ID: mem_1776344867786_aeiqlmdf5
  Project uses PostgreSQL on port 5432
```

### 3. Get - Retrieve Memory by ID

Retrieve a specific memory by its ID.

**Syntax:**
```typescript
memory({
  op: "get",
  id: "string (required)"
})
```

**Example:**

```typescript
memory({
  op: "get",
  id: "mem_1776344853320_q8uow56k7"
})
```

**Output Format:**
```
Memory [preference] (ID: mem_1776344853320_q8uow56k7):
Content: User prefers 4 spaces for Python indentation
Tags: style, python
Weight: 0.9
Created: 2026-04-16T10:00:00.000Z
Updated: 2026-04-16T10:00:00.000Z
```

### 4. List - Display All Memories

List all memories with optional limit.

**Syntax:**
```typescript
memory({
  op: "list",
  limit?: number  // 1-1000, default 100
})
```

**Example:**

```typescript
memory({
  op: "list",
  limit: 50
})
```

**Output Format:**
```
Found 10 memories (showing 50):
- [preference] ID: mem_1776344853320_q8uow56k7
  User prefers 4 spaces for Python indentation
  Tags: style, python

- [project] ID: mem_1776344867786_aeiqlmdf5
  Project uses PostgreSQL on port 5432
  Tags: database, postgres
```

### 5. Update - Modify Memory

Update an existing memory by ID.

**Syntax:**
```typescript
memory({
  op: "update",
  id: "string (required)",
  content?: string,
  tags?: string[] | string,
  weight?: number,
  expires_at?: number,
  metadata?: any
})
```

**Example:**

```typescript
memory({
  op: "update",
  id: "mem_1776344853320_q8uow56k7",
  content: "User prefers 8 spaces for Python indentation",
  weight: 0.95
})
```

### 6. Forget - Delete Memory

Delete a memory by ID.

**Syntax:**
```typescript
memory({
  op: "forget",
  id: "string (required)"
})
```

**Example:**

```typescript
memory({
  op: "forget",
  id: "mem_1776344853320_q8uow56k7"
})
```

### 7. Stats - Get Statistics

Get memory statistics.

**Syntax:**
```typescript
memory({
  op: "stats"
})
```

**Output Format:**
```
Memory Stats:
- Total: 25
- By type: {"preference":5,"project":10,"command":3,"solution":4,"note":3}
- By tags: {"python":8,"style":5,"database":4}
```

## Common Workflows

### Workflow 1: Learning User Preferences

When user mentions their preferences:

```
User: "I use 4 spaces for Python indentation"

↓ Agent saves:
memory({
  op: "save",
  content: "User uses 4 spaces for Python indentation",
  type: "preference",
  tags: ["style", "python"],
  weight: 0.9
})
```

### Workflow 2: Recalling Preferences Before Coding

Before generating code:

```
User: "Generate a Python function"

↓ Agent recalls:
memory({
  op: "find",
  query: "indentation",
  type: "preference"
})

↓ Agent receives: "User uses 4 spaces"
↓ Agent generates code with 4-space indentation
```

### Workflow 3: Managing Project Facts

When discovering project details:

```
User: "We're using PostgreSQL on port 5432"

↓ Agent saves:
memory({
  op: "save",
  content: "Project uses PostgreSQL on port 5432",
  type: "project",
  tags: ["database", "postgres"]
})
```

### Workflow 4: Storing Commands

When user shares useful commands:

```
User: "Run tests with: npm run test:cov"

↓ Agent saves:
memory({
  op: "save",
  content: "Test command: npm run test:cov",
  type: "command",
  tags: ["testing", "npm"]
})
```

### Workflow 5: Recording Solutions

When solving bugs:

```
Agent: "The issue was null pointer. Fixed by checking null first."

↓ Agent saves:
memory({
  op: "save",
  content: "Bug fix: check null before division",
  type: "solution",
  tags: ["bug", "null-check"]
})
```

## Best Practices

### 1. Use Appropriate Memory Types

- **preference**: User-specific coding styles and settings
- **project**: Project infrastructure, dependencies, configurations
- **command**: Reusable terminal commands and workflows
- **solution**: Bug fixes, patterns, workarounds
- **note**: General information, decisions, meeting notes

### 2. Tag Strategically

- Use consistent tag naming (lowercase, hyphen-separated)
- Add 2-5 relevant tags per memory
- Tags enable powerful filtering and search

**Good tags:**
```typescript
tags: ["style", "python", "indentation"]
tags: ["database", "postgres", "port"]
tags: ["bug", "null-check", "division"]
```

### 3. Set Weight for Importance

- Use `weight: 0.8-1.0` for critical preferences
- Use `weight: 0.5-0.7` for normal information
- Use `weight: 0.1-0.4` for temporary/less important info

### 4. Use Expiration for Temporary Data

```typescript
// Session tokens, temporary configs
memory({
  op: "save",
  content: "Temp token: xyz789",
  type: "note",
  expires_at: Date.now() + 1 * 60 * 60 * 1000  // 1 hour
})
```

### 5. Search Before Assuming

Always search memory before making assumptions:

```typescript
// Before: "I'll use 2 spaces for indentation"
// After: Search first
memory({
  op: "find",
  query: "indentation",
  type: "preference"
})
```

### 6. Use Get for Precise Retrieval

When you know the ID, use `get` instead of `find`:

```typescript
memory({
  op: "get",
  id: "mem_1776344853320_q8uow56k7"
})
```

### 7. List for Overview

Use `list` to see all memories:

```typescript
memory({
  op: "list",
  limit: 50
})
```

## Troubleshooting

### Issue: Tags Not Being Saved

**Symptom:** Memory saves but tags are not stored.

**Solution:** Tags can be passed as array or JSON string:
```typescript
// Option 1: Array (preferred)
tags: ["tag1", "tag2"]

// Option 2: JSON string (workaround)
tags: '["tag1", "tag2"]'
```

### Issue: Can't Find Memory ID

**Symptom:** Need ID to update/delete but don't know it.

**Solution:** Use `find` or `list` operations:
```typescript
// Find by content
memory({
  op: "find",
  query: "keyword"
})

// List all
memory({
  op: "list",
  limit: 100
})
```

### Issue: Memory Not Found

**Symptom:** Update/forget fails with "Memory not found".

**Solution:** Check ID is correct, use `get` to verify:
```typescript
memory({
  op: "get",
  id: "mem_xxx"
})
```

### Issue: Search Returns No Results

**Symptom:** Query returns empty results.

**Solution:**
- Try different keywords
- Check memory type filter
- Use `list` to see all available memories
- Verify memory was saved successfully

## Advanced Features

### Code Symbol Indexing

Memory can automatically index code symbols (functions, classes, etc.):

```typescript
const indexer = createCodeIndexer(engine, {
  watchPaths: ["./src"],
  extensions: [".ts", ".js", ".py"]
});
await indexer.start();
```

### Consolidation

Detect and merge duplicate memories:

```typescript
const result = await consolidate(store, {
  similarityThreshold: 0.8
});
console.log(`Merged ${result.merged} duplicates`);
```

### Export/Import

Backup and restore memories:

```typescript
// Export
const json = engine.exportJSON();
fs.writeFileSync("backup.json", json);

// Import
const json = fs.readFileSync("backup.json", "utf-8");
const result = engine.importJSON(json);
```

### Automatic Cleanup

Auto-expunge expired memories:

```typescript
store.startAutoExpunge(24 * 60 * 60 * 1000);  // Every 24h
```

## API Reference

### Memory Storage Location

Default: `~/.pi/agent/memory.db`

### ID Format

IDs are generated as: `mem_<timestamp>_<random>`
Example: `mem_1776344853320_q8uow56k7`

### Limits

- Content: max 10,000 characters
- Tags: max 20 tags, each max 50 characters
- Find limit: 1-100 results
- List limit: 1-1000 results
- Weight: 0.0 - 1.0

## Changelog

### v0.66.0 (Current)

- Added `get` operation to retrieve memory by ID
- Added `list` operation to display all memories
- Improved `find` output to include memory IDs
- Enhanced error messages for `update` and `forget`
- Fixed tags array validation (accepts both array and JSON string)
- Added `normalizeTags()` helper function

### Previous Versions

See [CHANGELOG.md](../packages/memory/CHANGELOG.md) for full history.

## Related Documentation

- [Memory Package README](../packages/memory/README.md)
- [Memory Package CHANGELOG](../packages/memory/CHANGELOG.md)
- [Coding Agent Documentation](../packages/coding-agent/README.md)
