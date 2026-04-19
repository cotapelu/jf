# Memory Tool Documentation

## Overview

The `memory` tool provides persistent storage for coding agents to remember information across sessions. It uses SQLite with full-text search (FTS5) for fast, relevant retrieval of user preferences, project facts, commands, and solutions.

## Features

- **Persistent Storage**: SQLite database survives restarts and session changes
- **Full-Text Search**: FTS5 with BM25 ranking for relevant results
- **Cross-Session Sharing**: All sessions share the same memory database
- **Unicode Support**: Handles unicode characters in content and search queries
- **Special Characters**: Supports special characters via fallback search
- **Type Safety**: Full TypeScript + Zod validation

## Database Location

Memory is stored in `~/.pi/agent/memory.db` by default. This location is consistent across all sessions, ensuring that memories created in one session are accessible in other sessions.

**Previous Behavior (Fixed)**:
- Different sessions would create separate databases
- Session 1: `~/.pi/agent/sessions/memory.db`
- Session 2: `~/.pi/agent/memory.db`
- Result: Memories were not shared across sessions

**Current Behavior (Fixed)**:
- All sessions use the same database
- All sessions: `~/.pi/agent/memory.db`
- Result: Memories are shared across all sessions

## Memory Types

| Type | Description | Example |
|------|-------------|---------|
| `preference` | User coding style, editor settings, language versions | "4 spaces", "Python 3.11", "Vim mode" |
| `project` | Project-specific facts (DB, APIs, URLs, env vars) | "PostgreSQL 14", "API: http://localhost:3000" |
| `command` | Terminal commands, workflows, scripts | "Test: npm run test:cov", "Deploy: kubectl apply" |
| `solution` | Bug fixes, code patterns, workarounds | "Check null before divide", "Use debounce 300ms" |
| `note` | General notes, meeting summaries, ideas | "ADR: chose React over Vue" |

## Operations

### Save

Save information to memory:

```typescript
{
  op: "save",
  content: "User uses 4 spaces for indentation",
  type: "preference",
  tags: ["style", "python"],
  weight: 0.8
}
```

**Parameters**:
- `content` (required): String, max 10000 characters
- `type` (required): One of `preference`, `project`, `command`, `solution`, `note`
- `tags` (optional): Array of strings, max 20 tags, each max 50 characters
- `weight` (optional): Number 0-1, default 0.5, higher = more important
- `expires_at` (optional): Unix timestamp for temporary memories

### Find

Search memory by query:

```typescript
{
  op: "find",
  query: "database",
  type: "project",
  tags: ["important"],
  limit: 10
}
```

**Parameters**:
- `query` (required): Search string
- `type` (optional): Filter by memory type
- `tags` (optional): Filter by tags (AND logic)
- `limit` (optional): Max results, default 10, max 100

### Forget

Delete a memory by ID:

```typescript
{
  op: "forget",
  id: "mem_1234567890_abc123"
}
```

### Stats

Get memory statistics:

```typescript
{
  op: "stats"
}
```

**Returns**:
- `total`: Total number of memories
- `byType`: Count by memory type
- `byTags`: Count by tags
- `averageWeight`: Average weight across all memories

## Search Behavior

### Primary Search (FTS5)

Memory uses SQLite's FTS5 (Full-Text Search) with BM25 ranking:

- **Fast**: Optimized for text search
- **Ranked**: Results ordered by relevance
- **Natural**: Supports natural language queries
- **Tokenizer**: Uses `porter unicode61` for unicode support

**Example**:
```typescript
// Fast, ranked search
engine.find("database connection");
```

### Fallback Search (LIKE)

When FTS5 fails or returns no results, the system automatically falls back to LIKE pattern matching:

- **Comprehensive**: Handles all characters
- **Unicode**: Supports unicode characters in queries
- **Special Characters**: Handles special characters like `@#$%^&*()`
- **Slower**: No ranking, but ensures results

**Example**:
```typescript
// Unicode search (uses LIKE fallback)
engine.find("你好世界");

// Special characters (uses LIKE fallback)
engine.find("@#$%");
```

### Search Limitations

**Unicode Search**:
- ✅ Content with unicode is stored correctly
- ✅ Unicode search queries work via fallback
- ⚠️ FTS5 doesn't rank unicode queries (uses LIKE fallback)

**Special Characters**:
- ✅ Content with special characters is stored correctly
- ✅ Special character search queries work via fallback
- ⚠️ FTS5 MATCH syntax doesn't support special characters (uses LIKE fallback)

**Performance**:
- FTS5: Fast, ranked results
- LIKE: Slower, no ranking, but comprehensive

## Usage Examples

### Agent Proactive Saving

When user shares important information:

```
User: "I use 4 spaces for Python"
↓
Agent calls: memory({
  op: "save",
  content: "User uses 4 spaces for indentation",
  type: "preference",
  tags: ["style", "python"]
})
```

### Agent Recall

When answering questions:

```
User: "How should I format the code?"
↓
Agent thinks: "I need to know user's indentation preference"
↓
Agent calls: memory({
  op: "find",
  query: "indentation"
})
↓
Gets result: "User uses 4 spaces"
↓
Agent formats code accordingly
```

### Cross-Session Memory Sharing

```
Session 1:
  User: "Project uses PostgreSQL 14"
  Agent: memory({ op: "save", content: "PostgreSQL 14", type: "project" })

Session 2 (new session):
  User: "What database does the project use?"
  Agent: memory({ op: "find", query: "database" })
  Result: "PostgreSQL 14" (from Session 1)
```

## Best Practices

### When to Save

Save information when:
- User shares preferences (coding style, tools, versions)
- User mentions project details (database, APIs, URLs)
- User provides commands or workflows
- Agent discovers solutions or patterns
- Important decisions are made

### When to Recall

Recall information when:
- Answering questions about user preferences
- Making decisions about code style
- Running commands or workflows
- Applying solutions or patterns
- Context is needed for accurate responses

### Tagging Strategy

Use descriptive tags:
- **Style**: `style`, `formatting`, `indentation`
- **Tools**: `python`, `javascript`, `react`, `vim`
- **Project**: `database`, `api`, `deployment`
- **Commands**: `test`, `build`, `deploy`
- **Solutions**: `bug-fix`, `pattern`, `workaround`

### Weight Assignment

Assign weights based on importance:
- **0.9-1.0**: Critical preferences, core project facts
- **0.7-0.8**: Important commands, common solutions
- **0.5-0.6**: Useful notes, occasional commands
- **0.3-0.4**: Minor details, temporary information

## Troubleshooting

### Memory Not Found

**Problem**: `find` returns no results

**Solutions**:
1. Check if memory was saved successfully
2. Try different search terms
3. Check type and tag filters
4. Verify memory hasn't expired

### Cross-Session Issues

**Problem**: Memories not shared across sessions

**Solutions**:
1. Verify database location: `~/.pi/agent/memory.db`
2. Check file permissions
3. Ensure database is not corrupted
4. Restart agent to reload memory

### Search Performance

**Problem**: Search is slow

**Solutions**:
1. Check database size (consider consolidation)
2. Use specific queries instead of broad ones
3. Apply type and tag filters to reduce results
4. Consider memory consolidation for old entries

## Recent Fixes

### Version 0.65.3 (Unreleased)

**Fixed**:
- **CRITICAL**: Memory path logic now uses unified database across all sessions
- **MEDIUM**: Unicode search support via LIKE fallback
- **MEDIUM**: Special characters search support via LIKE fallback

**Changed**:
- Enhanced search behavior with automatic FTS5 → LIKE fallback
- Updated documentation with search behavior and limitations

## Architecture

```
┌─────────────────────────────────────────────┐
│           Coding Agent (CLI)                │
│  Tools: read, write, edit, bash, memory    │
├─────────────────────────────────────────────┤
│         Memory Tool (this package)         │
├─────────────┬──────────────┬───────────────┤
│   SQLite    │   FTS5       │   LIKE        │
│   (data)    │   (search)   │   (fallback)  │
└─────────────┴──────────────┴───────────────┘
```

- **SQLite**: Single-file, ACID, zero-config
- **FTS5**: Fast full-text search with BM25 ranking
- **LIKE**: Fallback for unicode and special characters

## See Also

- [Memory Package README](../../memory/README.md)
- [Memory Package Changelog](../../memory/CHANGELOG.md)
- [Coding Agent Changelog](../CHANGELOG.md)
