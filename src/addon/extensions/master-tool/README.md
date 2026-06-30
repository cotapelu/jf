# 🛠️ Master Tool

**Hệ thống hàng trăm commands trong 1 tool duy nhất - Full stateful support.**

---

## 📦 Tổng quan

Master Tool là một **tool tổng** tự động discover và load hàng trăm command modules từ thư mục `commands/`. Mỗi command là file riêng, độc lập, có schema, metadata, và optional custom renderer.

### Tính năng

- ✅ **Auto-discovery**: Scan thư mục `commands/`, tự động load metadata
- ✅ **Dynamic import**: Chỉ load command khi cần (lazy)
- ✅ **LRU Cache**: Command modules cached với TTL (5 phút mặc định)
- ✅ **Type validation**: Mỗi command định nghĩa TypeBox schema, tự động validate args
- ✅ **Security**: Prototype pollution detection, output size limits, rate limiting (optional)
- ✅ **Audit logging**: Theo dõi executions, errors, performance
- ✅ **Custom renderer**: Mỗi command có thể define renderResult Riêng
- ✅ **Category organization**: Group commands (git, dev, system, etc.)
- ✅ **Search & filter**: Tìm command theo category, query
- ✅ **Meta-commands**: `list`, `help`, `stats`, `reload`
- ✅ **Stateful support**: Commands có thể có StateClass với mutex, persistence, auto-save
- ✅ **Session restore**: State tự động restore từ session tree/file
- ✅ **Error isolation**: Lỗi 1 command không ảnh hưởng khác

---

## 📁 Cấu trúc

```
master-tool/
├── master-tool.ts           ← Main tool + meta-commands
├── command-registry.ts     ← Auto-discovery & loader
├── command-executor.ts     ← Router + validation + execution
├── types/
│   └── command-module.ts   ← Interfaces
├── utils/
│   ├── command-cache.ts    ← LRU cache
│   └── command-validator.ts
├── commands/               ← Hàng trăm command files
│   ├── git/
│   │   ├── status.ts
│   │   ├── commit.ts
│   │   └── push.ts
│   ├── dev/
│   │   ├── test.ts
│   │   ├── build.ts
│   │   └── lint.ts
│   ├── system/
│   │   ├── info.ts
│   │   └── clean.ts
│   └── codebase/
│       ├── search.ts
│       └── analyze.ts
└── __tests__/
```

---

## 🚀 USAGE

### **Basic execution**

```typescript
// From LLM
master_tool({ command: 'git.status', args: {} })

// With args
master_tool({
  command: 'dev.test',
  args: { files: ['src/'], coverage: true }
})
```

### **Meta-commands**

```typescript
// List all commands
master_tool({ command: 'list', args: {} })

// Search commands
master_tool({
  command: 'list.grep',
  args: { query: 'git', category: 'git' }
})

// Get help for specific command
master_tool({
  command: 'help',
  args: { command: 'git.status' }
})

// Get stats
master_tool({ command: 'stats', args: {} })

// Reload (clear cache, rescan)
master_tool({ command: 'reload', args: {} })
```

---

## 📝 TẠO COMMAND MỚI

### **Step 1: Create command file**

```
commands/<category>/<action>.ts
```

Ví dụ: `commands/git/commit.ts`

### **Step 2: Export required fields**

```typescript
import { Type } from "typebox";

export const metadata = {
  name: "git.commit",           // category.action
  category: "git",
  description: "Commit changes with message",
  examples: [
    "master_tool({ command: 'git.commit', args: { message: 'fix bug' } })"
  ],
  tags: ["git", "vcs"],
  permissions: ["exec:git"]
};

export const schema = Type.Object({
  message: Type.String({ description: "Commit message" }),
  all: Type.Optional(Type.Boolean({ description: "Add all files (git add -A)" })),
  amend: Type.Optional(Type.Boolean({ description: "Amend last commit" }))
});

export async function execute(
  args: { message: string; all?: boolean; amend?: boolean },
  cwd: string,
  signal?: AbortSignal,
  ctx?: any
): Promise<{ code: number; stdout: string; stderr: string; data?: any }> {
  const gitArgs = ['commit', '-m', args.message];
  if (args.all) gitArgs.unshift('-a');
  if (args.amend) gitArgs.unshift('--amend');
  
  const result = await ctx.exec('git', gitArgs, { cwd, signal });
  
  return {
    code: result.code,
    stdout: result.stdout,
    stderr: result.stderr,
    data: { committed: true, message: args.message }
  };
}

// Optional: Custom renderer
export function renderResult(result: any, options: any, theme: any): any {
  if (result.code !== 0) {
    return new Text(theme.fg("error", `❌ Commit failed`));
  }
  return new Text(theme.fg("success", `✓ Committed: ${result.data.message}`));
}

export default { metadata, schema, execute, renderResult };
```

### **Step 3: Không cần register gì thêm**

Master tool tự động discover commands từ thư mục `commands/`.

---

## 🔧 ADVANCED: Custom Options

```typescript
// Trong extensionsAggregator (factory.ts):
import { registerMasterTool } from "./master-tool.js";

export default async function extensionsAggregator(api) {
  registerMasterTool(api, {
    // Custom commands directory
    commandsDir: "/path/to/commands",
    
    // Cache settings
    enableCache: true,
    cacheTTL: 10 * 60 * 1000, // 10 minutes
    
    // Rate limiting
    rateLimitPerMinute: 60, // 60 executions per minute per command
    
    // Size limits
    maxOutputSize: 2 * 1024 * 1024, // 2MB
    
    // Audit
    enableAudit: true,
    
    // Exclude certain categories/commands
    excludeCategories: ["experimental"],
    excludeCommands: ["dev.watch"] // Too heavy
  });
}
```

---

## 🎨 CUSTOM RENDERER

Mỗi command có thể define `renderResult` function:

```typescript
export function renderResult(
  result: { code: number; stdout: string; stderr: string; data?: any },
  options: { expanded: boolean; isPartial: boolean },
  theme: Theme
): Component {
  if (options.isPartial) {
    return new Text(theme.fg("warning", "⏳ Running..."));
  }
  
  if (result.code !== 0) {
    return new Text(theme.fg("error", `❌ Error:\n${result.stderr}`));
  }
  
  const lines = [
    theme.fg("success", "✓ Success"),
    "",
    ...result.stdout.split('\n').slice(0, options.expanded ? undefined : 10)
  ];
  
  return new Text(lines.join('\n'));
}
```

---

## 🔐 SECURITY FEATURES

1. **Prototype Pollution Detection**: Validate args trước khi execute
2. **Output Size Limiting**: Truncate output vượt `maxOutputSize` (default 1MB)
3. **Rate Limiting**: Configurable executions per minute
4. **Permission Hints**: Command metadata có `permissions` array để future RBAC
5. **Signal Support**: Mọi command nhận `AbortSignal` để cancellation
6. **CWD Isolation**: Commands chạy trong session cwd, không thoát ra

---

## 📊 MONITORING & AUDIT

```typescript
const registry = getRegistry();
const stats = registry.getStats();

console.log(stats);
// {
//   registeredCommands: 42,
//   totalExecutions: 1234,
//   successRate: 98.5,
//   cacheStats: { size: 40, entries: [...] },
//   recentErrors: [
//     { command: "git.commit", error: "nothing to commit", count: 5 }
//   ]
// }

// Get audit logs
const logs = registry.getExecutor().getAuditLogs(since = Date.now() - 3600000);
```

---

## 🧪 TESTING COMMANDS

```typescript
// __tests__/git-status.test.ts
import { createCommandRegistry } from "../command-registry.js";

describe("git.status", () => {
  let registry: CommandRegistry;

  beforeAll(async () => {
    registry = createCommandRegistry();
    await registry.initialize();
  });

  test("should execute git status", async () => {
    const ctx = createMockContext({ cwd: "/tmp/repo" });
    const result = await registry.execute("git.status", {}, {
      toolCallId: "test-1",
      ctx
    });
    
    expect(result.isError).toBe(false);
    expect(result.details.data).toHaveProperty('branch');
    expect(result.details.data.staged).toBeInstanceOf(Array);
  });

  test("should validate missing args", async () => {
    const result = await registry.execute("git.status", { invalid: true}, /* ctx */);
    expect(result.isError).toBe(true);
    expect(result.details.error).toContain("Validation failed");
  });
});
```

---

## 🔄 HOT-RELOAD (DEV)

Trong development, set `enableCache: false` để mỗi execution reload command từ disk:

```typescript
registerMasterTool(api, {
  enableCache: false, // Always reload from disk
  cacheTTL: 0
});
```

Hoặc dùng meta-command: `master_tool({ command: 'reload', args: {} })`

---

## 🏗️ ARCHITECTURE

```
┌─────────────────────────────────────────────────────────┐
│                     Master Tool                          │
│  • ToolDefinition (register với extension API)          │
│  • Meta-commands (list, help, stats, reload)           │
│  • Renderer (default + per-command override)           │
└───────────────┬─────────────────────────────────────────┘
                │ delegates
┌───────────────▼─────────────────────────────────────────┐
│                 CommandRegistry                         │
│  • Scan commands/ directory (on init)                  │
│  • Load command metadata (lightweight)                 │
│  • Maintain registry: Map<name, CommandRegistryEntry> │
└───────────────┬─────────────────────────────────────────┘
                │ on demand
┌───────────────▼─────────────────────────────────────────┑
│              CommandExecutor                            │
│  • Load module (dynamic import + cache)                │
│  • Validate args (TypeBox schema)                      │
│  • Security checks (pollution, size, rate limit)      │
│  • Execute (with hooks, signal, onUpdate)              │
│  • Audit log + error handling                          │
└─────────────────────────────────────────────────────────┘
```

---

## 📈 EXAMPLE OUTPUT

```bash
# List commands
> master_tool({ command: 'list', args: {} })
📋 Available Commands (12 total)

git (3):
  • git.status          Show git working tree status
  • git.commit          Commit changes with message
  • git.push            Push commits to remote

dev (2):
  • dev.test            Run project tests
  • dev.build           Build the project

system (1):
  • system.info         Display system information

...

# Execute
> master_tool({ command: 'git.status', args: {} })
📊 Git Status: main
Staged (0):
Unstaged (2):
  M src/foo.ts
  M src/bar.ts
Untracked (1):
  ?? tmp/new-file.txt

# Help
> master_tool({ command: 'help', args: { command: 'git.status' } })
Command: git.status
Category: git
Description: Show git working tree status

Parameters:
  porcelain: boolean (optional) - Use porcelain format (default: true)

Examples:
  • master_tool({ command: 'git.status', args: {} })
  • master_tool({ command: 'git.status', args: { porcelain: true } })

Permissions: exec:git
```

---

## ⚡ PERFORMANCE

- **Cold start**: First execution loads command module (dynamic import)
- **Warm execution**: Cached module, ~1-5ms overhead
- **Cache hit rate**: Typically >95% sau khi warm up
- **Memory**: Each cached module ~50-200KB, cache limit 100-200 modules
- **Disk I/O**: Only on cache miss or reload

---

## 🆚 SO với CÁC PATTERN KHÁC

| Feature | Master Tool | Capability Plugin | Built-in Tool | Multi-command Template |
|---------|-------------|-------------------|---------------|------------------------|
| Auto-discovery | ✅ Scan folder | ❌ Manual manifest | ❌ Manual | ❌ Manual registry |
| Hot-reload | ✅ (cache clear) | ✅ (fs.watch) | ❌ Restart needed | ❌ Restart needed |
| Schema validation | ✅ TypeBox | ✅ TypeBox | ✅ Manual/custom | ✅ TypeBox per command |
| Custom renderer | ✅ Per-command | ✅ Capability | ✅ Tool-level | ❌ Default only |
| Category org | ✅ Auto | ❌ Manual tags | ❌ N/A | ❌ N/A |
| Rate limiting | ✅ Built-in | ❌ Manual | ❌ Manual | ❌ Manual |
| Audit logging | ✅ Built-in | ❌ Manual | ❌ Manual | ❌ Manual |
| Stateful support | ⚠️ Via ctx | ⚠️ Via custom | ✅ Full | ❌ Stateless only |
| Isolation | ✅ Per-command | ✅ Plugin sandbox | ❌ Same process | ❌ Same process |
| Ease of adding | ✅ Drop file | ✅ manifest + file | ✅ Code change | ✅ Add to registry |

**Khi nào dùng Master Tool**:
- ✅ Có nhiều small, independent commands (50+)
- ✅ Commands thuộc các categories rõ ràng
- ✅ Muốn auto-discovery, không muốn thủ công register
- ✅ Cần rate limiting, audit, security checks
- ✅ Commands mostly stateless

**Khi nào dùng Capability Plugin**:
- ✅ Cần hot-reload liên tục trong dev
- ✅ Muốn distribute như external package
- ✅ Cần isolation mạnh (different plugin có thể fail độc lập)

**Khi nào dùng Built-in Tool**:
- ✅ Tool cần stateful, complex UI, session hooks
- ✅ Chỉ có 1-5 commands, không cần auto-discovery
- ✅ Cần deep integration với extension lifecycle

---

## 🐛 TROUBLESHOOTING

**Problem**: Command not found sau khi thêm file mới.

**Solution**: 
- Check file extension (.ts/.js)
- File phải export `metadata`, `schema`, `execute`
- Restart Piclaw (or dùng `reload` meta-command nếu enableCache: true và file đã được scan)

**Problem**: Validation fails even with correct args.

**Solution**: Check TypeBox schema, đảm bảo required fields đúng. Dùng `master_tool({ command: 'help', args: { command: 'name' } })` để xem expected schema.

**Problem**: Command chạy nhưng không thấy output.

**Solution**: Command phải return `{ code, stdout, stderr }`. Nếu `code !== 0`, output sẽ đi vào `stderr`. Check `renderResult` nếu có custom.

---

## 📚 RESOURCES

- **Master Tool Architecture**: `command-registry.ts`, `command-executor.ts`
- **Command Examples**: `commands/git/status.ts`, `commands/dev/test.ts`, `commands/system/info.ts`
- **Type Definitions**: `types/command-module.ts`
- **Utilities**: `utils/command-cache.ts`, `utils/command-validator.ts`

---

## 🎯 BEST PRACTICES FOR COMMAND AUTHORS

1. **Always define metadata** với description rõ ràng, examples cụ thể
2. **Use TypeBox schema** để auto-validation
3. **Return structured data** trong `data` field (for programmatic consumption)
4. **Implement renderResult** nếu command có output phức tạp
5. **Respect signal** - check `signal.aborted` trong loops
6. **Use ctx.exec** instead of child_process trực tiếp
7. **Keep commands focused** - 1 command = 1 responsibility
8. **Add tests** trong `__tests__/` folder
9. **Document permissions** để future RBAC
10. **Handle errors gracefully** - return meaningful stderr

---

**Happy command building!** 🚀

---

## 🔄 STATEUL COMMANDS (ADVANCED)

Commands có thể chọn **stateful mode** bằng cách export `StateClass` và (optional) `getPersistencePath`.

### **State Class Requirements**

```typescript
export class MyState {
  // Required fields:
  isDirty: boolean;           // Đánh dấu cần save
  mutex?: Mutex;              // Optional: Nếu cần thread-safety

  // Required methods:
  markDirty(): void;          // Gọi khi state thay đổi
  getSnapshot(): any;         // Return clone để save
  
  // Optional methods (nếu muốn persistence):
  async save(ctx: ExtensionContext): Promise<void>;
  async load(ctx: ExtensionContext): Promise<boolean>;
  
  // Optional:
  subscribe(listener: () => void): () => void;  // Để renderer updates
}
```

### **Minimal Stateful Command**

```typescript
// commands/example/stateful.ts
export class ExampleState {
  counter = 0;
  isDirty = false;
  
  markDirty() { this.isDirty = true; }
  getSnapshot() { return { counter: this.counter }; }
  
  async save(ctx) {
    // Atomic write
    await withFileMutationQueue(path, async () => {
      await fs.writeFile(path, JSON.stringify(this.getSnapshot()));
    });
    this.isDirty = false;
  }
  
  async load(ctx) {
    try {
      const data = JSON.parse(await fs.readFile(path, 'utf-8'));
      this.counter = data.counter;
      return true;
    } catch { return false; }
  }
}

export const StateClass = ExampleState;
export default { metadata, schema, execute, StateClass };
```

### **How It Works**

1. **First execution**: Executor instantiate `new StateClass()`
2. **Restore**: Gọi `state.load(ctx)` (nếu file tồn tại)
3. **Execute**: `execute(args, cwd, signal, ctx)` với `ctx.commandState = state`
4. **Dirty tracking**: Command gọi `state.markDirty()` khi thay đổi
5. **Auto-save**: Sau execute, nếu `state.isDirty` → `state.save(ctx)`
6. **Session restore**: Session tree lưu snapshot qua `ctx.sessionManager.appendEntry()`

### **Mutex Safety**

Nếu state có nhiều concurrent modifications, thêm `mutex: Mutex`:

```typescript
export class SafeState {
  mutex = new Mutex();  // Từ utils/mutex.ts
  
  async updateSomething() {
    const release = await this.mutex.lock();
    try {
      // Critical section
      this.data.push(...);
      this.markDirty();
    } finally { release(); }
  }
}
```

Executor sẽ tự động lock state mutex (nếu có) trước khi gọi `execute()`.

### **Custom Persistence Path**

Default: `.piclaw/commands/<commandName>.json`

Override bằng `getPersistencePath`:

```typescript
export function getPersistencePath(ctx: ExtensionContext, commandName: string): string {
  return join(ctx.cwd, ".myapp", "data", `${commandName}.json`);
}
```

---

## 📊 COMMON PATTERNS

### **Pattern 1: Counter**

```typescript
export class CounterState {
  count = 0;
  isDirty = false;
  
  increment() { this.count++; this.markDirty(); }
  getSnapshot() { return { count: this.count }; }
  // save/load optional (may be ephemeral)
}
```

### **Pattern 2: Collection**

```typescript
export class CollectionState<T> {
  private items: T[] = [];
  isDirty = false;
  
  add(item: T) { this.items.push(item); this.markDirty(); }
  remove(pred: (t: T) => boolean) { ... }
  getSnapshot() { return { items: [...this.items] }; }
}
```

### **Pattern 3: Cache**

```typescript
export class CacheState<K, V> {
  private map = new Map<K, V>();
  private ttl = new Map<K, number>();
  isDirty = false;
  
  set(key: K, value: V, ttlMs?: number) {
    this.map.set(key, value);
    if (ttlMs) this.ttl.set(key, Date.now() + ttlMs);
    this.markDirty();
  }
  get(key: K): V | undefined { ... }
  // TTL cleanup in get
}
```

---

## 🏆 BEST PRACTICES FOR STATEFUL COMMANDS

1. **Keep state serializable** - Không lưu functions, circular refs
2. **Batch mutations** - Gộp nhiều thay đổi rồi markDirty 1 lần
3. **Use mutex** - Nếu command có thể chạy song song
4. **Handle load failures gracefully** - Fresh state nếu file corrupt
5. **Snapshot immutable** - `getSnapshot()` trả về deep clone
6. **Save atomically** - `withFileMutationQueue` đã đảm bảo
7. **Respect signal** - Check `signal.aborted` trong loops

---

**Happy stateful command building!** 🚀

