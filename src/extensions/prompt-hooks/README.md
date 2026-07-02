# Prompt Hook Extension

## Overview

This extension implements a **custom command system** for built-in prompts using the `input` hook. It intercepts slash commands and sends pre-defined TypeScript-based prompt content directly.

## Why This Approach?

- ✅ **No .md files** - All prompts are TypeScript objects
- ✅ **No command registration** - Uses `input` hook instead of `pi.registerCommand()`
- ✅ **No `promptsOverride`** - Avoids resource loader override confusion
- ✅ **Built-in** - Part of codebase, not user extensions
- ✅ **Lazy loading** - Prompts load with extension (startup)
- ✅ **Argument substitution** - Supports `$1`, `$2`, `$@`, `${1:-default}` etc.

## How It Works

1. Extension registers an `input` event handler via `pi.on('input', ...)`
2. When user types `/command args...`, the handler:
   - Checks if `command` exists in built-in prompt registry
   - Parses arguments (bash-style quoting)
   - Substitutes arguments into prompt content
   - Sends via `pi.sendUserMessage(content)`
   - Returns `{ action: 'handled' }` to stop further processing
3. LLM receives the prompt content directly

## Adding New Prompts

### 1. Create Prompt File

```typescript
// src/buildin/extensions/prompts/my-prompt.prompt.ts
import type { PromptTemplate } from '@earendil-works/pi-coding-agent';

export const myPrompt: PromptTemplate = {
  name: 'myprompt',
  description: 'My custom prompt',
  filePath: '<inline:my-prompt>',
  sourceInfo: {
    path: 'src/buildin/extensions/prompts/my-prompt.prompt.ts',
    source: 'builtin',
    scope: 'project',
    origin: 'top-level',
  },
  content: `# My Prompt

This is a template with args: $1, $2
All args: $@
Default: ${3:-default value}`,
};
```

### 2. Register in `prompts/index.ts`

```typescript
import { myPrompt } from './my-prompt.prompt.js';

PROMPT_REGISTRY.set(myPrompt.name, myPrompt);
```

### 3. (Optional) Autocomplete

The extension automatically registers commands for all prompts in registry if `REGISTER_COMMANDS_FOR_AUTOCOMPLETE = true` (default). This makes them appear in `/` dropdown.

## Argument Substitution

Supported patterns (similar to shell):

| Pattern | Meaning | Example |
|---------|---------|---------|
| `$1`, `$2` | Positional args (1-indexed) | `/cmd foo bar` → `$1` = "foo", `$2` = "bar" |
| `$@` or `$ARGUMENTS` | All args joined | → "foo bar" |
| `${1:-default}` | Arg 1 or default if empty/missing | `/cmd` → default |
| `${@:N}` | Args from N onwards | `/cmd a b c` → `${@:2}` = "b c" |
| `${@:N:L}` | L args starting at N | `/cmd a b c` → `${@:2:2}` = "b c" |

## File Structure

```
src/buildin/
└── extensions/
    ├── prompts/
    │   ├── index.ts                    # Registry
    │   ├── default-assistant.prompt.ts # JF protocol
    │   ├── code-review.prompt.ts       # Example with args
    │   └── ... (add more)
    └── prompt-hook-extension.ts        # Input hook logic
```

## Comparison with Prompt Templates

| Feature | Prompt Templates (.md) | Prompt Hook Extension |
|---------|----------------------|----------------------|
| File format | `.md` only | `.ts` objects |
| Registration | Auto-discovery | Via registry map |
| Autocomplete | Yes (from filename) | Yes (optional) |
| Argument substitution | Yes (built-in) | Yes (custom impl) |
| Extension required? | No | Yes (built-in) |
| Edit before send | Yes (expand inline) | No (auto-send) |
| Lazy loading | No (preload) | Yes (extension load) |

## Extension Configuration

Set `REGISTER_COMMANDS_FOR_AUTOCOMPLETE` to `false` if you don't want commands in autocomplete dropdown (they'll still work when typed).

## Limitations

- ⚠️ No inline editing (content sends immediately)
- ⚠️ No `argument-hint` in autocomplete (can be added)
- ⚠️ No `sourceInfo` inheritance (all prompts show as built-in)
