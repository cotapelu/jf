# Add-on Module - Single Entry Point

## Overview

This module provides **one function** to register all add-ons (extensions + tools):

```typescript
import { registerAllAddon } from './index.js';
const { extensions, tools } = registerAllAddon(cwd);
```

## Structure

```
addon/
├── index.ts              # Main entry: registerAllAddon()
├── main.simple.ts        # Minimal main.ts template
├── extensions/           # Pi extensions (git, master-tool, etc.)
├── tools/                # Tool definitions (built-in + custom)
├── prompts/              # Prompt templates
├── runtime-context.ts    # Context helpers
├── settings-config.ts    # Settings configuration
└── README.md             # This file
```

## Quick Copy

To reuse in another project:

1. Copy entire `src/addon/` directory
2. In your `main.ts`:

```typescript
import { registerAllAddon } from './addon/index.js';

const createRuntime = async ({ cwd, agentDir, sessionManager, sessionStartEvent }) => {
  const { extensions, tools } = registerAllAddon(cwd);

  const services = await createAgentSessionServices({
    cwd,
    agentDir,
    resourceLoaderOptions: {
      promptsOverride: () => ({ prompts: [defaultAssistantPrompt], diagnostics: [] }),
      extensionFactories: extensions,
    },
  });

  configureSettings(services.settingsManager);

  const result = await createAgentSessionFromServices({
    services,
    sessionManager,
    sessionStartEvent,
    customTools: tools,
  });

  return { session: result.session, services, diagnostics: services.diagnostics || [] };
};
```

## What's Included

### Extensions (`extensions/`)
- Git operations (commit, push, pull, status, diff)
- Master tool
- Capability system
- Todos, memory, team tools
- Auto-continue, auto-compact
- Keybindings, commands, renderers
- And more...

### Tools (`tools/`)

#### Built-in Tools
- `read` - Read files
- `bash` - Execute shell commands
- `edit` - Edit files
- `write` - Write files
- `find` - Find files
- `grep` - Search text
- `ls` - List directory

#### Custom Tools
- `time` - Get current time
- `codebaseIndex` - Index/search codebase
- `compactContext` - Compact conversation context
- `session` - Session management
- `multiAgent` - Multi-agent coordination
- `skills` - Load skill documentation

## Customization

### Change Default Prompt
Edit `prompts/index.ts` or provide your own in `promptsOverride`.

### Adjust Settings
Modify `settings-config.ts` to change default settings.

### Add New Tools
Add to `tools/` and register in `tools/index.ts`.

### Add New Extensions
Add to `extensions/` and register in `extensions/factory.ts`.

## API Reference

### `registerAllAddon(cwd: string)`

Registers all add-ons (extensions + tools).

**Returns:**
```typescript
{
  extensions: ExtensionFactory[],  // Array of extension factory functions
  tools: ToolDefinition[]          // Array of tool definitions
}
```

**Usage:**
```typescript
const { extensions, tools } = registerAllAddon(process.cwd());
```

## Dependencies

Required packages:
- `@earendil-works/pi-coding-agent`
- `@earendil-works/pi-ai`
- `@earendil-works/pi-tui`

See `package.json` for exact versions.

## License

Apache-2.0
