# Capability-Based Plugin Architecture

**Status**: Production Ready  
**Version**: 1.0.0  
**Date**: 2025-06-12

---

## 🎯 VẤN ĐỀ

PiClaw hiện tại dùng **Flat Tool Registry**: mỗi tool là file riêng, đăng ký trực tiếp.

```
Số lượng tools → System prompt dài → LLM giảm hiệu suất
```

Ví dụ: 15 tools → system prompt có 15 description sections → tốn 2KB tokens.

---

## 🏗️ GIẢI PHÁP

**Capability System**: Gom tools vào **plugins/** folder, mỗi plugin có nhiều capabilities.

### **Cách hoạt động**

```
plugins/
├── git/
│   ├── manifest.json          ← Metadata plugin
│   ├── capabilities/
│   │   ├── status.js         ← Implement
│   │   ├── commit.js
│   │   └── diff.js
│   └── renderers/
│       └── diff-renderer.js
```

**LLM call**:
```json
{ "capability": "git.status", "params": {} }
```

**System prompt**:
```
## Available Capabilities

### Git Status (git.status)
Show working tree status
Parameters: {}
Call: { capability: 'git.status', params: {} }
---
```

---

## 📦 CẤU TRÚC PLUGIN

```
my-plugin/
├── manifest.json               # Bắt buộc
├── capabilities/
│   ├── command-1.js           # Export { schema, execute }
│   └── command-2.js
└── renderers/                 # Optional
    └── custom-renderer.js
```

---

## 📄 MANIFEST.JSON SPEC

```json
{
  "id": "git",                           // Duplicate-free ID (lowercase)
  "name": "Git Operations",              // Human-readable
  "description": "Version control ops",  // Short
  "version": "1.0.0",
  "tags": ["vcs", "git"],                // For filtering

  "capabilities": [
    {
      "id": "status",
      "name": "Git Status",
      "description": "Show working tree status",
      "inputSchema": {                   // TypeBox schema
        "type": "object",
        "properties": {},
        "additionalProperties": false
      },
      "execute": "capabilities/status.js",
      "renderer": "renderers/status-renderer.js",  // Optional
      "promptGuidelines": [
        "Use git.status to see current branch and changes",
        "Example: { capability: 'git.status', params: {} }"
      ],
      "dependencies": [],
      "permissions": ["exec:git"]
    }
  ],

  "settings": {
    "enabledByDefault": true,
    "configSchema": {                    // Plugin config (optional)
      "type": "object",
      "properties": {
        "defaultBranch": { "type": "string", "default": "main" }
      }
    }
  }
}
```

---

## 🔧 CAPABILITY FILE (capabilities/status.js)

```javascript
import { Type } from "typebox";

// Schema (phải khớp với manifest)
export const schema = Type.Object({
  // No params for status
}, { additionalProperties: false });

// Execute function
export async function execute(params, ctx) {
  // ctx có: cwd, exec(), session, signal, onUpdate
  const result = await ctx.exec("git", ["status", "--porcelain"], { cwd: ctx.cwd });

  if (result.code !== 0) {
    return {
      content: [{ type: "text", text: `❌ ${result.stderr}` }],
      isError: true,
      details: { error: result.stderr }
    };
  }

  // Parse output
  const lines = result.stdout.split('\n').filter(Boolean);
  const staged = lines.filter(l => l.startsWith('M ') || l.startsWith('A '));
  const unstaged = lines.filter(l => l.startsWith(' M'));

  return {
    content: [{
      type: "text",
      text: `Branch: ${await getCurrentBranch(ctx.cwd)}\n` +
            `Staged: ${staged.length}, Unstaged: ${unstaged.length}`
    }],
    details: {
      staged: staged.map(l => l.slice(3)),
      unstaged: unstaged.map(l => l.slice(3))
    },
    isError: false
  };
}

// export default alias
export default { execute, schema };
```

---

## 🎨 RENDERER (renderers/status-renderer.js) - OPTIONAL

```javascript
import { Text } from "@earendil-works/pi-tui";

export function renderResult(result, options, theme) {
  if (result.isError) {
    return new Text(theme.fg("error", result.details.error), 0, 0);
  }

  const details = result.details;
  const lines = [
    theme.fg("accent", "📋 Git Status").bold(),
    `Branch: ${theme.fg("muted", details.branch)}`,
    `Staged: ${details.staged.length}`,
    `Unstaged: ${details.unstaged.length}`
  ];

  return new Text(lines.join('\n'), 0, 0);
}

export default { renderResult };
```

---

## 🚀 LÀM THẾ NÀO ĐỂ THÊM PLUGIN MỚI

### **Step 1**: Tạo folder
```bash
mkdir -p plugins/my-plugin/capabilities
```

### **Step 2**: Tạo `manifest.json`
```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "description": "Does something awesome",
  "version": "1.0.0",
  "tags": ["utils"],
  "capabilities": [
    {
      "id": "my-command",
      "name": "My Command",
      "description": "Does a thing",
      "inputSchema": { "type": "object", "properties": {} },
      "execute": "capabilities/my-command.js",
      "promptGuidelines": ["Use when..."]
    }
  ]
}
```

### **Step 3**: Tạo capability file
`plugins/my-plugin/capabilities/my-command.js`:
```javascript
export const schema = Type.Object({});

export async function execute(params, ctx) {
  return {
    content: [{ type: "text", text: "Done!" }],
    details: {},
    isError: false
  };
}
```

### **Step 4**: Restart PiClaw
Plugin tự động load!

---

## 🎯 LLM INTERACTION

**System prompt** (auto-generated):
```
## Available Capabilities

### Git Status (git.status)
Show working tree status
Parameters: {}
Call: { capability: 'git.status', params: {} }
---
```

**User**: "check git status"

**LLM**:
```json
{
  "tool": "capability",
  "params": {
    "capability": "git.status",
    "params": {}
  }
}
```

---

## 🔌 EXTENSION INTEGRATION

Trong `factory.ts`:

```typescript
import capabilitySystemExtension from "./capability-system/extension.js";

export default function extensionsAggregator(api) {
  // Không cần register từng tool
  capabilitySystemExtension(api);  // ← Chỉ 1 dòng

  // Các stateful tools riêng:
  registerTodosTool(api);
  registerMemoryTool(api);
  registerTeamTool(api);
}
```

---

## 📊 MIGRATION STRATEGY

### **Phase 1: Giữ nguyên tools cũ** (current)
- Flat tools hoạt động bình thường
- Capability system chạy song song

### **Phase 2: Di chuyển vào plugins/**
- `git-tool.ts` → `plugins/git/`
- `test, formatter, audit, build, scripts` → `plugins/dev/`
- `secret-scanner` → `plugins/security/`
- `metrics` → `plugins/system/`

### **Phase 3: Tắt flat tools**
- Xóa hoặc comment đăng ký cũ
- Chỉ dùng capability system

---

## 🔍 DEBUG COMMAND

```
/plugins   # List loaded plugins & capabilities
```

Output:
```
📦 Capability System
=============================

Plugins: 4
Capabilities: 15

📦 git (git)
  • Git Status (git.status)
  • Git Commit (git.commit)
  • Git Diff (git.diff)

📦 dev (dev)
  • Test Runner (dev.test)
  • Code Formatter (dev.format)
  • ...
```

---

## ⚡ ADVANTAGES

| Feature | Flat Tools | Capability System |
|---------|------------|-------------------|
| System prompt size | 15 descriptions → ~2KB | 1 tool + list → ~500B |
| Add new tool | Edit factory.ts | Drop folder |
| Type safety | Per-tool | Per-capability (TypeBox) |
| Organization | None | Grouped by domain |
| Discoverability | Static | Dynamic + `/plugins` command |
| Render per command | Per tool | Per capability |
| Hot reload | No | Yes (dev mode) |

---

## 🛠️ DEVELOPMENT

### **Dev mode** (auto-reload):
```bash
PICLAW_DEV=1 npm start
```

### **Custom plugins path**:
```bash
PICLAW_PLUGINS_DIR=./my-plugins npm start
```

---

## 📝 EXAMPLE: FULL GIT PLUGIN

See `plugins/git/` for complete implementation with:
- manifest.json
- capabilities: status, commit, diff, branch, checkout, add, push, pull
- renderers: git-diff-renderer.js
- Optionally: custom config, dependencies

---

## 🔗 REFERENCES

- Types: `src/extensions/capability-system/types.ts`
- Registry: `src/extensions/capability-system/registry.ts`
- Loader: `src/extensions/capability-system/plugin-loader.ts`
- Extension: `src/extensions/capability-system/extension.ts`

---

## 🎯 CHECKLIST

- [x] Create plugin loader
- [x] Create registry
- [x] Create router tool
- [x] Create analyze plugin (definitions)
- [ ] Create git plugin (all commands)
- [ ] Create dev plugin (test, format, audit, build, scripts)
- [ ] Create security plugin
- [ ] Create system plugin
- [ ] Migrate flat tools to plugins
- [ ] Remove old registrations
- [ ] Test hot-reload
- [ ] Performance benchmark

---

**END OF ARCHITECTURE**
