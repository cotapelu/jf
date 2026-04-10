# @mariozechner/pi-memory

🧠 **Memory Layer / Memory Engine** for LLM Agents - A complete memory system.

## Overview

This is a production-ready memory system for AI agents with:

- **Memory Store** - Pluggable data layer (in-memory, Redis, Postgres ready)
- **CRUD Engine** - Create, read, update, delete operations
- **Retrieval Engine** - Search and filter memories
- **Ranking System** - Score and prioritize memories by relevance, recency, weight
- **Context Builder** - Build LLM prompt context from retrieved memories
- **Validation Layer** - Guardrail for content, rate limiting, deduplication
- **LLM Interface** - Tool schemas for LLM agents (LLM = PROPOSER, SYSTEM = CONTROLLER)

## Installation

```bash
npm install @mariozechner/pi-memory
```

## Quick Start

```typescript
import { createMemoryEngine } from "@mariozechner/pi-memory";

// Create memory engine
const memory = createMemoryEngine();

// Create a memory
const result = memory.createMemory({
  type: "long_term",
  content: {
    text: "User prefers dark mode interface",
    metadata: { source: "preference" }
  },
  tags: ["preference", "ui"],
  weight: 0.8
});

if (result.ok) {
  console.log("Created:", result.value.id);
}

// Retrieve memories
const retrieveResult = memory.retrieve("user preferences");
if (retrieveResult.ok) {
  console.log(retrieveResult.value);
}

// Build context for LLM
const contextResult = memory.buildContext("What does user like?", {
  limit: 5,
  types: ["long_term", "short_term"]
});
if (contextResult.ok) {
  console.log(contextResult.value.text);
}
```

## Memory Types

| Type | Description |
|------|-------------|
| `short_term` | Current conversation context |
| `long_term` | Persistent user preferences |
| `episodic` | Past conversation history |
| `semantic` | Knowledge and facts |
| `working` | Current task context |

## Core API

### Create Memory
```typescript
memory.createMemory({
  type: "long_term",
  content: { text: "User preference..." },
  tags: ["tag1", "tag2"],
  weight: 0.8,
  expiresAt: Date.now() + 86400000 // Optional expiration
})
```

### Retrieve Memories
```typescript
memory.retrieve("query", {
  limit: 10,
  types: ["long_term", "short_term"],
  tags: ["preference"],
  minScore: 0.3
})
```

### Build Context
```typescript
memory.buildContext("question", {
  limit: 5,
  types: ["long_term", "semantic"],
  includeMetadata: true,
  template: "Context:\n{{memories}}\n\nQuestion: {{query}}"
})
```

### LLM Tool Interface
```typescript
import { createLLMToolInterface, generateMemorySystemPrompt } from "@mariozechner/pi-memory";

const tools = createLLMToolInterface(memory);

// Get tool definitions for LLM system prompt
const toolDefs = tools.getTools();
const systemPrompt = generateMemorySystemPrompt();

// LLM proposes, system executes
const result = await tools.executeTool("create_memory", {
  type: "long_term",
  content: { text: "Memory content" },
  tags: ["tag"]
});
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Memory Engine                        │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   CRUD       │  │  Retrieval   │  │   Context   │  │
│  │   Engine     │  │   Engine     │  │   Builder   │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         │                 │                 │          │
│  ┌──────┴─────────────────┴─────────────────┴───────┐  │
│  │                  Memory Store                      │  │
│  │     (In-Memory / Redis / Postgres ready)          │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  ┌──────────────┐  ┌────────────────────────────────┐   │
│  │   Guardrail │  │     LLM Interface (Tools)      │   │
│  │ (Validation)│  │  (LLM = PROPOSER, SYSTEM =     │   │
│  └──────────────┘  │          CONTROLLER)           │   │
│                   └────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## Key Principles

1. **LLM = PROPOSER, SYSTEM = CONTROLLER** - LLM suggests actions, system validates and executes
2. **Type-safe** - Full TypeScript with Zod validation
3. **Pluggable** - Swap storage backends without changing API
4. **Guardrailed** - Rate limiting, content validation, deduplication built-in

## Configuration

```typescript
const memory = createMemoryEngine({
  defaultWeight: 0.5,
  defaultLimit: 10,
  rankingWeights: {
    recency: 0.3,
    relevance: 0.3,
    weight: 0.25,
    accessCount: 0.15
  },
  contextConfig: {
    maxLength: 4000,
    defaultTemplate: "Context:\n{{memories}}"
  }
});
```

## Development

```bash
# Build
npm run build

# Test
npm test

# Dev watch
npm run dev
```

## License

MIT