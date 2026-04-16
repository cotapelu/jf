# @mariozechner/pi-coding-memory

💾 **SQLite-backed persistent memory for coding agents**

A lightweight, fast memory system designed specifically for AI coding assistants. Stores user preferences, project facts, commands, and solutions in a local SQLite database with full-text search. Unlike generic memory packages, this one is opinionated for coding workflows.

## Why This Exists

Coding agents need to remember **persistent facts** across sessions:
- User preferences: "I use 4 spaces", "Python 3.11", "Vim keybindings"
- Project facts: "PostgreSQL DB", "API base URL", "Docker port 8080"
- Commands: "Test: npm run test:cov", "Deploy: ./deploy.sh staging"
- Solutions: "Fix: check null before division", "Pattern: debounce 300ms"

**Current problem**: Each session starts fresh. You have to re-tell the agent your preferences and project setup every time.

**Solution**: A simple SQLite database that the agent can `save()` and `find()` across sessions using LLM tool calling.

## Quick Start

```typescript
import {
  createSQLiteStore,
  createMemoryEngine,
  createLLMToolInterface
} from '@mariozechner/pi-coding-memory';

// Create persistent store (default: ~/.pi/agent/memory.db)
const store = createSQLiteStore(); // or provide path: createSQLiteStore('/custom/path/memory.db')
const engine = createMemoryEngine(store);
const tools = createLLMToolInterface(engine);

// Agent can now SAVE information
engine.save({
  content: "User uses 4 spaces for indentation",
  type: "preference",
  tags: ["style", "python"],
  weight: 0.8,
});

// And FIND it later (even in new sessions)
const result = engine.find("indentation style");
console.log(result.memories[0].content); // "User uses 4 spaces for indentation"

// For LLM integration: provide tools
const llmTools = tools.getTools();
// Pass these to your LLM provider's tool/function calling feature

// When LLM calls the tool:
const toolResult = await tools.executeTool("memory", {
  op: { op: "find", query: "database" }
});
```

## Features

- **Persistent**: SQLite file survives restarts
- **Fast**: FTS5 (full-text search) with BM25 ranking
- **Unified**: Single tool with operation parameter (like todo_write)
- **Typed**: Full TypeScript + Zod validation
- **Secure**: Optional metadata for sensitive data (encryption TBD)
- **Zero config**: Works out of the box

## Advanced Features

### Automatic Cleanup & Decay

- `startAutoExpunge(intervalMs?)` - Automatically delete expired memories (default: every 24h)
- `stopAutoExpunge()` - Stop automatic cleanup
- `startAutoDecay(options?)` - Gradually reduce weight of unused memories (configurable decay rate and interval)
- `stopAutoDecay()` - Stop weight decay

### Batch Operations

- `expunge(olderThan?)` - Manually delete expired memories (or all if no arg)
- `deleteByFilePath(filePath)` - Directly delete all code symbols associated with a file (uses index)
- `transaction<T>(fn)` - Execute multiple operations atomically

### Import/Export

- `exportJSON()` - Export all memories as formatted JSON (for backup or migration)
- `importJSON(data)` - Import memories from JSON, skips duplicates by ID

### Improved Similarity Detection

Consolidation now supports two similarity algorithms:

- `jaccard` (default) - Fast token overlap
- `cosine-tfidf` - Weighted by term frequency-inverse document frequency for more accurate duplicate detection

Configure via `consolidate(store, { similarityAlgorithm: 'cosine-tfidf' })`

### Indexes

Additional indexes for performance:
- `idx_expires_at` - Fast expired memory cleanup
- `idx_file_path` - Quick lookup by file path
- `idx_file_path_type` - Compound index for file-path + type queries

## Code Symbol Indexing

The code indexer automatically watches your project and indexes functions, classes, interfaces, and more into memory:

- **Multi-language**: TypeScript, JavaScript, Python, and extensible to others
- **File watching**: Real-time updates on file changes with debouncing
- **Smart cleanup**: Automatically removes symbols when files are deleted
- **Metadata**: Stores file path, line numbers, signature, and language

See `createCodeIndexer()` for details.

## Memory Types

| Type | Description | Example |
|------|-------------|---------|
| `preference` | User coding style, editor settings, language versions | "4 spaces", "Python 3.11", "Vim mode" |
| `project` | Project-specific facts (DB, APIs, URLs, env vars) | "PostgreSQL 14", "API: http://localhost:3000" |
| `command` | Terminal commands, workflows, scripts | "Test: npm run test:cov", "Deploy: kubectl apply" |
| `solution` | Bug fixes, code patterns, workarounds | "Check null before divide", "Use debounce 300ms" |
| `note` | General notes, meeting summaries, ideas | "ADR: chose React over Vue" |

## Unified Tool: `memory`

Single tool with `op` field for all operations:

```typescript
{
  op: "save" | "find" | "forget" | "stats",
  // ... operation-specific parameters
}
```

### `save` - Save information to memory

```typescript
{
  op: "save",
  content: "string (required, max 10000 chars)",
  type: "preference | project | command | solution | note (required)",
  tags?: ["string array, max 20 tags, each max 50 chars"],
  weight?: "number 0-1 (default 0.5, higher = more important)",
  expires_at?: "unix timestamp (optional, for temp memories)"
}
```

Example LLM tool call:
```json
{
  "name": "memory",
  "arguments": {
    "op": {
      "op": "save",
      "content": "User uses 4 spaces for indentation",
      "type": "preference",
      "tags": ["style", "python"]
    }
  }
}
```

### `find` - Search memory by query

```typescript
{
  op: "find",
  query: "string (required)",
  type?: "preference | project | ... (optional filter)",
  tags?: ["string array, AND logic (optional filter)"],
  limit?: "number 1-100 (default 10)"
}
```

Example:
```json
{
  "name": "memory",
  "arguments": {
    "op": {
      "op": "find",
      "query": "database"
    }
  }
}
```

### `forget` - Delete a memory by ID

```typescript
{
  op: "forget",
  id: "string (required)"
}
```

### `stats` - Get statistics

```typescript
{
  op: "stats"
}
```

## Store Methods (Direct Usage)

When using the store directly (not via the unified tool), you have access to additional methods:

- `expunge(olderThan?)` - Delete expired memories (or all if `olderThan` is `Date.now()`)
- `deleteByFilePath(filePath)` - Delete all memories with given `file_path` (typically for code symbols)
- `exportJSON()` - Export all memories as JSON string
- `importJSON(json)` - Import memories from JSON, returns count imported, skips duplicates
- `startAutoExpunge(intervalMs?)` - Start background job to auto-clean expired memories
- `stopAutoExpunge()` - Stop the auto-cleanup job
- `startAutoDecay(options?)` - Start background weight decay for unused memories
- `stopAutoDecay()` - Stop weight decay
- `transaction<T>(fn)` - Run operations in a single atomic transaction

These methods are available on `IMemoryStore` and `sqlite-store` implementations.

## Integration with pi Coding Agent

This package provides a tool definition ready for agent integration:

```typescript
import { memoryToolDefinition } from '@mariozechner/pi-coding-memory';

// Use memoryToolDefinition directly with the agent
// It follows the same pattern as built-in tools (bash, read, write, etc.)
```

### As Extension

Create `~/.pi/extensions/memory/` and install this package:

```typescript
// extension.ts
import { Extension } from '@mariozechner/pi-coding-agent';
import { createSQLiteStore, createMemoryEngine, memoryToolDefinition } from '@mariozechner/pi-coding-memory';

export default {
  name: 'memory',
  async setup(api) {
    const store = createSQLiteStore(); // Uses default path
    const engine = createMemoryEngine(store);

    // Register the memory tool
    api.registerTool({
      ...memoryToolDefinition,
      execute: async (toolCallId, params, signal, onUpdate, ctx) => {
        // Wire up the engine to the context
        return memoryToolDefinition.execute(toolCallId, params, signal, onUpdate, { engine });
      }
    });
  }
};
```

### Direct Usage (without agent)

```typescript
import { createLLMToolInterface } from '@mariozechner/pi-coding-memory';

const store = createSQLiteStore();
const engine = createMemoryEngine(store);
const tools = createLLMToolInterface(engine);

// Get tool definitions for LLM
const toolDefs = tools.getTools();
// [{ name: "memory", description: "...", parameters: {...} }]

// Execute tool calls from LLM
const result = await tools.executeTool("memory", {
  op: { op: "save", content: "User preference", type: "preference" }
});

// Format result for LLM
const formatted = tools.formatToolResult(result);
```

## Usage Pattern

### Agent Proactive Saving

When user says something important:

```
User: "I use 4 spaces for Python"
↓
LLM decides to call: memory({
  op: {
    op: "save",
    content: "User uses 4 spaces for indentation",
    type: "preference",
    tags: ["style", "python"]
  }
})
```

### Agent Recall

When answering questions:

```
User: "How should I format the code?"
↓
LLM thinks: "I need to know user's indentation preference"
↓
LLM calls: memory({ op: { op: "find", query: "indentation" } })
↓
Gets result: "User uses 4 spaces"
↓
LLM formats code accordingly
```

### Session Persistence

Memory is stored in `~/.pi/agent/memory.db` (or custom path). New sessions automatically have access to all past memories.

## Architecture

```
┌─────────────────────────────────────────────┐
│           Coding Agent (CLI)                │
│  Tools: read, write, edit, bash, memory    │
├─────────────────────────────────────────────┤
│         Coding Memory (this package)        │
├─────────────┬──────────────┬───────────────┤
│   SQLite    │   FTS5       │   Tool Def   │
│   (data)    │   (search)   │   (LLM API)  │
└─────────────┴──────────────┴───────────────┘
```

- **SQLite**: Single-file, ACID, zero-config, perfect for CLI
- **FTS5**: Built-in full-text search with BM25 ranking
- **Tool**: Single unified tool with operation parameter

## Why SQLite?

- **Single file**: `~/.pi/agent/memory.db` - easy backup, sync, inspect
- **Zero config**: No server, no connection string
- **Fast**: Read/write ~50K ops/sec on modern hardware
- **Persistent**: Survives restarts, power loss
- **Portable**: Copy file → move to another machine
- **Standard**: Ubiquitous, battle-tested

## Search Behavior and Limitations

### Full-Text Search (FTS5)

Memory uses SQLite's FTS5 (Full-Text Search) with BM25 ranking for fast, relevant search results. The search system has the following behavior:

**Primary Search (FTS5)**:
- Uses FTS5 with `porter unicode61` tokenizer
- Provides BM25 ranking for relevance scoring
- Fast and efficient for most queries
- Supports natural language search

**Fallback Search (LIKE)**:
- Automatically falls back to LIKE pattern matching when FTS5 fails
- Handles special characters that FTS5 cannot process
- Ensures search always returns results even with complex queries

### Known Limitations

**Unicode Search**:
- FTS5 tokenizer processes unicode content correctly
- Search queries with unicode characters work via fallback LIKE search
- Example: Content "你好世界" can be found with query "你好" or "世界"

**Special Characters**:
- FTS5 MATCH syntax doesn't support special characters like `@#$%^&*()`
- These characters are handled via fallback LIKE search
- Example: Content "@#$%" can be found with query "@#$%"

**Search Performance**:
- FTS5 is faster and provides ranking
- LIKE fallback is slower but ensures comprehensive search
- Both methods respect type and tag filters

### Search Examples

```typescript
// Normal text search (uses FTS5)
engine.find("database"); // Fast, ranked results

// Unicode search (uses LIKE fallback)
engine.find("你好世界"); // Works via fallback

// Special characters (uses LIKE fallback)
engine.find("@#$%"); // Works via fallback

// Combined with filters
engine.find("test", { type: "project", tags: ["important"] });
```

## Advanced: Custom Store Path

```typescript
// Store memory in project directory (shared across team)
const store = createSQLiteStore('./project/.pi/memory.db');

// Or per-project
const store = createSQLiteStore(`./.pi/memory-${projectName}.db`);
```

## Testing

```bash
npm test
```

## Development

```bash
npm run dev  # Watch mode
npm test
```

## Roadmap

- [ ] Encryption at rest for sensitive fields
- [ ] Automatic expiration cleanup (background job)
- [ ] Memory versioning (like git)
- [ ] Export/import (JSON, markdown)
- [ ] Tag-based auto-categorization
- [ ] Conflict resolution (if multi-user ever needed)

## License

MIT