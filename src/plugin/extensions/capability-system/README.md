# Capability System

Plugin-based tool organization for PiClaw.

## Quick Start

### 1. Plugin Structure

```
plugins/
├── my-plugin/
│   ├── manifest.json
│   ├── capabilities/
│   │   └── command.js
│   └── renderers/          # optional
│       └── renderer.js
```

### 2. manifest.json

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "description": "Does something",
  "version": "1.0.0",
  "tags": ["utils"],
  "capabilities": [
    {
      "id": "my-command",
      "name": "My Command",
      "description": "Does a thing",
      "inputSchema": {
        "type": "object",
        "properties": {
          "arg": { "type": "string", "description": "Argument" }
        },
        "required": ["arg"]
      },
      "execute": "capabilities/command.js",
      "promptGuidelines": [
        "Use when you need to do X",
        "Example: { capability: 'my-plugin.my-command', params: { arg: 'value' } }"
      ]
    }
  ]
}
```

### 3. Capability File

`plugins/my-plugin/capabilities/command.js`:

```javascript
export const schema = /* TypeBox schema */;

export async function execute(params, ctx) {
  // Do work
  return {
    content: [{ type: "text", text: "Result" }],
    details: { ... },
    isError: false
  };
}

export default { execute, schema };
```

### 4. Restart PiClaw

Plugin auto-loads. LLM sees it in system prompt.

---

## Available Plugins

| Plugin | Capabilities | Status |
|--------|--------------|--------|
| `git` | status, diff, commit, branch, checkout, add, push, pull | 🟡 In Progress |
| `dev` | test, format, audit, build, scripts | ⚪ Planned |
| `security` | scan | ⚪ Planned |
| `system` | metrics | ⚪ Planned |
| `analyze` | definitions | 🟢 Done |

---

## LLM Usage

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

## Debug

```
/plugins   # List all loaded plugins & capabilities
```

---

## Dev Mode

```bash
PICLAW_DEV=1 npm start   # Auto-reload on file changes
```

---

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for full design.

---

## Migrating Existing Tools

Current tools to migrate:

- `git-tool.ts` → `plugins/git/`
- `test, formatter, audit, build, scripts` → `plugins/dev/`
- `secret-scanner` → `plugins/security/`
- `metrics` → `plugins/system/`

Tools kept standalone:

- `subtool_loader`
- `universal`
- `tool_template`
- `todos`
- `memory`
- `team_run`

---

**No registration needed. Just drop folder in `plugins/`.**
