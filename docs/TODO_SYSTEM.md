# Pi Todo System - Technical Specification

## Overview

The Pi Todo System is a built-in task management system that allows agents to create, track, and manage task lists with phases. It automatically continues working on pending tasks after creating/updating the todo list.

## Current Implementation

### Core Components

1. **TodoWriteTool** (`packages/coding-agent/src/core/tools/todo-write.ts`)
   - Manages todo/task lists with phases and tasks
   - Operations: `replace`, `add_phase`, `add_task`, `update`, `remove_task`
   - Status types: `pending`, `in_progress`, `completed`, `abandoned`
   - Auto-continue: automatically triggers agent to work on next pending task

2. **AgentSession Integration** (`packages/coding-agent/src/core/agent-session.ts`)
   - `getTodoPhases()` - Get current todo phases
   - `setTodoPhases()` - Set todo phases
   - `#todoPhases` - Private state management

### Data Types

```typescript
type TodoStatus = "pending" | "in_progress" | "completed" | "abandoned";

interface TodoItem {
  id: string;           // e.g., "task-1"
  content: string;      // Task description
  status: TodoStatus;
  notes?: string;       // Additional context
  details?: string;    // Implementation details, file paths
}

interface TodoPhase {
  id: string;           // e.g., "phase-1"
  name: string;         // Phase name
  tasks: TodoItem[];
}
```

### Auto-Continue Behavior

When a todo list is created or updated:
1. System finds the first task with status `in_progress` or `pending`
2. Triggers `agent.continue()` after a 10ms delay (to ensure tool result is processed)
3. Only continues if agent is not already streaming

### Usage

The agent uses this tool automatically when you ask it to create a todo list. Example prompts:
- "Create a todo list for building a web app"
- "Add a task to implement authentication"
- "Mark task-1 as completed"

## Extension Examples

1. **Simple Todo Extension** (`examples/extensions/todo.ts`)
   - Basic todo management with `/todos` command
   - State stored in session entries for proper branching

2. **Plan Mode Extension** (`examples/extensions/plan-mode/index.ts`)
   - Read-only exploration mode with todo tracking
   - Extracts numbered plan steps from "Plan:" sections

## Known Issues

- Todo state is currently in-memory only (not persisted to disk)
- No built-in `/todos` CLI command (only in extensions)

## Future Enhancements

### P1 - Testing
- [ ] Unit tests for todo-write.ts (applyOps, normalizeInProgressTask, formatSummary)
- [ ] Integration tests for AgentSession persistence

### P2 - Persistence
- [ ] Save todo to file (`.pi/todos.json`)
- [ ] Load todo from file on session start

### P3 - CLI Commands
- [ ] Built-in `/todos` command (not just in extensions)
- [ ] Filter todos by status

### P4 - UI/UX
- [ ] Footer widget showing current task
- [ ] Progress bar visualization

### P5 - Documentation
- [ ] Update EXTENSION_GUIDE.md with todo system documentation

## Related Files

```
packages/coding-agent/src/core/tools/todo-write.ts     # Main tool
packages/coding-agent/src/core/agent-session.ts       # State management
packages/coding-agent/examples/extensions/todo.ts    # Extension example
packages/coding-agent/examples/extensions/plan-mode/  # Plan mode example
```

## Changelog

### 2026-04-08
- Added auto-continue behavior: agent automatically continues working on pending tasks after creating/updating todo list
- Fix: agent was stopping after creating todo instead of continuing work