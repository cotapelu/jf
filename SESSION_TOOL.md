# Session Tool - Comprehensive Session Management for Pi SDK

> **A production-ready, fully-tested session management tool for Pi SDK with unlimited child sessions, rich metadata, tree visualization, and full lifecycle control.**

## 🎯 Features

- ✅ **Unlimited Child Sessions** - No hard limit on number of child sessions
- ✅ **Rich Metadata** - Track names, tags, creation time, parent relationships
- ✅ **Tree Visualization** - View session hierarchy with ASCII tree
- ✅ **Full Lifecycle** - Create, switch, rename, tag, delete, export, history
- ✅ **State Validation** - Proper error handling and state transitions
- ✅ **Operation History** - Audit trail of all session operations
- ✅ **Diagnostics** - Built-in diagnostics for debugging
- ✅ **Unit Tested** - 92 passing tests with 100% coverage of core functions

## 📦 Architecture

### Core Components

1. **SessionRegistry** (`session-registry.ts`)
   - Central registry tracking all sessions with metadata
   - WeakRef-based to avoid memory leaks
   - Atomic operations with validation
   - Tree structure support for parent-child relationships

2. **MultiSessionManager** (`multi-session-manager.ts`)
   - Manages session lifecycle (create, switch, dispose)
   - Non-singleton, scoped to runtime instance
   - Configurable limits (max sessions, allow multiple children)
   - Diagnostic capabilities

3. **Session Tool** (`tools/session-tool.ts`)
   - ToolDefinition exposing all operations to LLM
   - 12 operations: create, switch, list, info, rename, tag, delete, export, tree, history, status, diagnostics
   - Rich formatting and user-friendly messages
   - Comprehensive error handling

### Session States

- **ACTIVE** - Currently bound to runtime
- **INACTIVE** - Exists but not active
- **DISPOSED** - Removed from registry

## 🚀 Quick Start

### 1. Setup in your Pi SDK application

```typescript
import { createAgentSessionRuntime, setCurrentRuntime } from "@earendil-works/pi-coding-agent";
import { registerAllTools } from "./src/tools/index.js";
import { registerSessionTool } from "./src/tools/index.js";

// In your runtime factory:
const servicesOptions: CreateAgentSessionServicesOptions = {
    cwd,
    agentDir,
    resourceLoaderOptions: { ... },
};

const services = await createAgentSessionServices(servicesOptions);

const sessionOptions: CreateAgentSessionFromServicesOptions = {
    services,
    sessionManager,
    sessionStartEvent,
    tools: [],
    customTools: [
        ...registerAllTools(cwd),        // All built-in + custom tools
        ...registerSessionTool(),        // Session management tool
    ],
};

const result = await createAgentSessionFromServices(sessionOptions);

// Set runtime context for session tool
setCurrentRuntime(result.session);

console.log(`Parent session: ${result.session.sessionFile}`);
```

### 2. Available Operations

The `session` tool provides the following operations:

#### `create` - Create a new child session
```json
{
  "operation": "create",
  "name": "feature-auth",
  "tags": ["feature", "auth"]
}
```

#### `switch` - Switch to a specific session
```json
{
  "operation": "switch",
  "sessionId": "parent"  // or session ID, or "last" for most recent
}
```

#### `list` - List all sessions
```json
{
  "operation": "list",
  "filterState": "active",  // "active", "inactive", or "all"
  "sortBy": "created",      // "created", "name", or "id"
  "limit": 10
}
```

#### `info` - Get detailed session information
```json
{
  "operation": "info",
  "sessionId": "session_xxx"  // defaults to active if omitted
}
```

#### `rename` - Rename a session
```json
{
  "operation": "rename",
  "sessionId": "session_xxx",
  "name": "new-name"
}
```

#### `tag` - Add or remove tags
```json
{
  "operation": "tag",
  "sessionId": "session_xxx",
  "tagAction": "add",  // or "remove"
  "tags": ["debug", "priority:high"]
}
```

#### `delete` - Remove session from registry
```json
{
  "operation": "delete",
  "sessionId": "session_xxx"  // defaults to active
}
```

#### `export` - Export session data
```json
{
  "operation": "export",
  "sessionId": "session_xxx",
  "exportFormat": "json",  // or "html"
  "exportPath": "/path/to/file.json"
}
```

#### `tree` - Show session hierarchy
```json
{
  "operation": "tree"
}
```

#### `history` - View operation history
```json
{
  "operation": "history",
  "limit": 20
}
```

#### `status` - Current runtime status
```json
{
  "operation": "status"
}
```

#### `diagnostics` - Internal diagnostics
```json
{
  "operation": "diagnostics"
}
```

## 📊 Examples

### Example 1: Workflow with multiple sessions

```json
// 1. Check initial status
{
  "operation": "status"
}

// 2. Create a child for a specific task
{
  "operation": "create",
  "name": "bugfix-123",
  "tags": ["bug", "critical"]
}

// 3. Do work in that child session...

// 4. Switch back to parent to continue main conversation
{
  "operation": "switch",
  "sessionId": "parent"
}

// 5. View the session tree
{
  "operation": "tree"
}

// 6. List all sessions with tags
{
  "operation": "list",
  "filterState": "all"
}
```

### Example 2: Organizing sessions with tags

```json
// Add tags to categorize
{
  "operation": "tag",
  "sessionId": "session_xxx",
  "tagAction": "add",
  "tags": ["feature:auth", "priority:high", "sprint:2024-Q2"]
}

// Later, filter by finding sessions with specific tags in the list output
```

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests once
npm run test:run

# Run with coverage
npm run test:coverage
```

Current test coverage:
- SessionRegistry: 31 tests
- MultiSessionManager: 28 tests
- SessionTool Integration: 33 tests
- **Total: 92 passing tests**

## 📝 Technical Details

### Session Identification

Sessions are identified by stable IDs derived from their file names:
- Example: `/path/to/2024-01-15T10-30-00-abc123.jsonl` → `session_2024_01_15t10_30_00_abc123`
- Fallback to timestamp+counter if file path unavailable

### Parent-Child Relationships

- **Parent**: The original session created with the runtime (ID: "parent" alias)
- **Child**: Any session created via `create` operation
- **Multiple Levels**: Child sessions can themselves have children (nested hierarchy)
- **Active Session**: Only one session can be active at a time, bound to runtime

### Weak References

SessionRegistry uses `WeakRef<AgentSession>` to hold session references without preventing garbage collection. When a session is disposed, its WeakRef is cleared.

### Error Handling

All tool operations include comprehensive error handling:
- Validation errors (missing parameters, invalid state)
- Runtime errors (session not found, already active, etc.)
- Unexpected errors (caught and returned with `isError: true`)

### Thread Safety

The registry is designed for single-threaded JavaScript. All operations are synchronous and modify state in-place. For concurrent scenarios, external synchronization would be needed.

## 🔧 Development

### Building

```bash
npm run build
```

### Project Structure

```
src/
├── session-registry.ts          # Core registry with metadata tracking
├── multi-session-manager.ts     # Session lifecycle manager
├── tools/
│   ├── session-tool.ts         # ToolDefinition and operations
│   └── index.ts                # Tool registration
├── runtime-context.ts          # Global runtime context
├── tests/
│   ├── session-registry.test.ts
│   ├── multi-session-manager.test.ts
│   ├── session-tool.test.ts
│   └── utils.ts                # Test utilities
└── main.ts                     # Demo application
```

## 🆚 Comparison with Old ParentChildSessionManager

| Feature | Old (ParentChildSessionManager) | New (SessionTool) |
|---------|-------------------------------|-------------------|
| Max children | 1 | Unlimited |
| Metadata | None | Name, tags, timestamps, parent |
| Tree support | No | Yes (full hierarchy) |
| History tracking | No | Yes (audit trail) |
| Operations | 3 (create, switch, dispose) | 12 (full lifecycle) |
| Error handling | Basic | Comprehensive |
| Tests | None | 92 tests |
| Singleton | Yes (static) | No (instance per runtime) |

## 📄 License

MIT

## 🙏 Credits

Built for Pi SDK by the community.
