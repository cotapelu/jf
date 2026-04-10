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

// When LLM calls a tool:
const toolResult = await tools.executeTool("memory_find", { query: "database" });
```

## Features

- **Persistent**: SQLite file survives restarts
- **Fast**: FTS5 (full-text search) with BM25 ranking
- **Simple**: 4 tools, 5 memory types, no bloat
- **Typed**: Full TypeScript + Zod validation
- **Secure**: Optional metadata for sensitive data (encryption TBD)
- **Zero config**: Works out of the box

## Memory Types

| Type | Description | Example |
|------|-------------|---------|
| `preference` | User coding style, editor settings, language versions | "4 spaces", "Python 3.11", "Vim mode" |
| `project` | Project-specific facts (DB, APIs, URLs, env vars) | "PostgreSQL 14", "API: http://localhost:3000" |
| `command` | Terminal commands, workflows, scripts | "Test: npm run test:cov", "Deploy: kubectl apply" |
| `solution` | Bug fixes, code patterns, workarounds | "Check null before divide", "Use debounce 300ms" |
| `note` | General notes, meeting summaries, ideas | "ADR: chose React over Vue" |

## Tools (LLM Interface)

### `memory_save`
Save information to memory.

```typescript
{
  content: "string (required, max 10000 chars)",
  type: "preference | project | command | solution | note (required)",
  tags?: ["string array, max 20 tags, each max 50 chars"],
  weight?: "number 0-1 (default 0.5, higher = more important)",
  expires_at?: "unix timestamp (optional, for temp memories)"
}
```

### `memory_find`
Search memory by query.

```typescript
{
  query: "string (required)",
  type?: "preference | project | ... (optional filter)",
  tags?: ["string array, AND logic (optional filter)"],
  limit?: "number 1-100 (default 10)"
}
```

### `memory_forget`
Delete a memory by ID.

```typescript
{
  id: "string (required)"
}
```

### `memory_stats`
Get statistics about stored memories.

```typescript
{} // no params
```

## Integration with Coding Agent

This package is designed to be used as an **extension** or **built-in tool** for coding agents like `@mariozechner/pi-coding-agent`.

### As Extension

Create `~/.pi/extensions/memory/` and install this package:

```typescript
// extension.ts
import { Extension } from '@mariozechner/pi-coding-agent';
import { createSQLiteStore, createMemoryEngine, createLLMToolInterface } from '@mariozechner/pi-coding-memory';

export default {
  name: 'memory',
  async setup(api) {
    const store = createSQLiteStore(); // Uses default path
    const engine = createMemoryEngine(store);
    const tools = createLLMToolInterface(engine);

    // Register memory tools
    api.registerTools(tools.getTools());

    // Optional: Add command
    api.registerCommand({
      name: 'memory-stats',
      description: 'Show memory statistics',
      async execute() {
        const stats = engine.stats();
        api.console.log(JSON.stringify(stats.value, null, 2));
      }
    });
  }
};
```

### As Built-in (fork)

Add to `packages/coding-agent/src/tools/index.ts`:

```typescript
import { createSQLiteStore, createMemoryEngine, createLLMToolInterface } from '@mariozechner/pi-coding-memory';

const memoryStore = createSQLiteStore();
const memoryEngine = createMemoryEngine(memoryStore);
const memoryTools = createLLMToolInterface(memoryEngine);

export function createAllToolDefinitions() {
  return [
    ...getDefaultTools(),
    ...memoryTools.getTools(),
  ];
}
```

## Usage Pattern

### Agent Proactive Saving

When user says something important:

```
User: "I use 4 spaces for Python"
↓
LLM decides to call: memory_save({
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
LLM thinks: "I need to know user's indentation preference"
↓
LLM calls: memory_find({ query: "indentation style" })
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
│  Tools: read, write, edit, bash, MEMORY    │
├─────────────────────────────────────────────┤
│         Coding Memory (this package)        │
├─────────────┬──────────────┬───────────────┤
│   SQLite    │   FTS5       │   Tools       │
│   (data)    │   (search)   │   (LLM API)   │
└─────────────┴──────────────┴───────────────┘
```

- **SQLite**: Single-file, ACID, zero-config, perfect for CLI
- **FTS5**: Built-in full-text search with BM25 ranking
- **Tools**: 4 simple tools for LLM function calling

## Why SQLite?

- **Single file**: `~/.pi/agent/memory.db` - easy backup, sync, inspect
- **Zero config**: No server, no connection string
- **Fast**: Read/write ~50K ops/sec on modern hardware
- **Persistent**: Survives restarts, power loss
- **Portable**: Copy file → move to another machine
- **Standard**: Ubiquitous, battle-tested

## Advanced: Custom Store Path

```typescript
// Store memory in project directory (shared across team)
const store = createSQLiteStore('./project/.pi/memory.db');

// Or per-project
const store = createSQLiteStore(`./.pi/memory-${projectName}.db`);
```

## Configuration

No config needed. But you can tune:

```typescript
// In future: custom weight defaults, search params
const store = createSQLiteStore(path, {
  defaultWeight: 0.6,
  // ...
});
```

## Limitations

- **No encryption**: Sensitive data (API keys) should be handled separately (consider `@mariozechner/pi-vault`)
- **No embedding**: Semantic search uses keyword matching (FTS5). For advanced embedding, use separate RAG system.
- **Single-user**: SQLite file, not designed for multi-user collaboration
- **No wiki**: This is key-value, not linked documents. For Obsidian-style wiki, combine with markdown files.

## Testing

```bash
npm test
```

## Development

```bash
npm run dev  # Watch mode
npm run test
```

## Roadmap

- [ ] Encryption at rest for sensitive fields
- [ ] Automatic expiration cleanup (background job)
- [ ] Memory versioning (like git)
- [ ] Export/import (JSON, markdown)
- [ ] Tag-based auto-categorization
- [ ] Conflict resolution (if multi-user ever needed)

## Comparison

| Feature | pi-memory (old) | pi-coding-memory (new) | LLM Wiki |
|---------|-----------------|------------------------|----------|
| Storage | In-memory Map | SQLite file | Markdown files |
| Search | Simple keyword | FTS5 (BM25) | Full-text (via qmd) |
| Persistent | ❌ No | ✅ Yes | ✅ Yes |
| Human-readable | ❌ | ❌ (binary) | ✅ Yes |
| Obsidian integration | ❌ | ❌ | ✅ Yes |
| Cross-linking | ❌ | ❌ | ✅ Yes |
| Simple for coding | ⚠️ OK | ✅ Best | ❌ Overkill |
| Version control | ❌ | ❌ | ✅ Git |

## License

MIT
