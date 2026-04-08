# Extension Guide

This guide covers how to create extensions for the pi coding agent.

## Overview

Extensions modify and extend pi's behavior. They can:
- Add new tools
- Modify UI components
- Hook into lifecycle events
- Transform input/output

## Extension Structure

An extension is a TypeScript file that exports an extension object:

```typescript
import type { Extension } from "@mariozechner/pi-coding-agent";

export const extension: Extension = {
  name: "my-extension",
  version: "1.0.0",
  
  // Called when the extension is loaded
  async setup(context) {
    // Your setup code here
  },
  
  // Optional: cleanup when extension is unloaded
  async teardown() {
    // Your cleanup code here
  },
};
```

## Loading Extensions

Extensions are loaded from the `~/.pi/extensions/` directory. Place your extension file there with a `.ts` or `.js` extension.

## Extension Context API

The `context` object provides access to:

```typescript
interface ExtensionContext {
  // Session management
  session: AgentSession;
  
  // Tool registration
  tools: {
    register(tool: Tool): void;
    unregister(name: string): void;
  };
  
  // UI hooks
  ui: {
    registerComponent(component: UIComponent): void;
    registerRenderer(toolName: string, renderer: ToolRenderer): void;
  };
  
  // Event system
  events: {
    on(event: string, handler: EventHandler): void;
    off(event: string, handler: EventHandler): void;
    emit(event: string, data: unknown): void;
  };
  
  // Configuration
  config: Record<string, unknown>;
}
```

## Creating Custom Tools

```typescript
import type { Extension, Tool } from "@mariozechner/pi-coding-agent";

const myTool: Tool = {
  name: "my-tool",
  description: "Does something useful",
  
  async execute(input: string, context: ToolContext) {
    // Your tool logic here
    return {
      content: [{ type: "text" as const, text: "Result" }],
      usage: { input: 0, output: 0, total: 0 },
      stopReason: "stop" as const,
    };
  },
};

export const extension: Extension = {
  name: "my-extension",
  version: "1.0.0",
  
  async setup(context) {
    context.tools.register(myTool);
  },
};
```

## UI Component Registration

```typescript
const myComponent: UIComponent = {
  id: "my-component",
  render() {
    return {
      type: "overlay",
      content: "Hello World",
    };
  },
};

context.ui.registerComponent(myComponent);
```

## Event Hooks

```typescript
context.events.on("tool:beforeExecute", async (data) => {
  console.log("Tool about to execute:", data.toolName);
});

context.events.on("message:afterSend", async (data) => {
  console.log("Message sent:", data.message);
});
```

## Example: Input Transform

See `examples/extensions/input-transform.ts` for a complete example that modifies user input before processing.

## Example: Custom Tool Renderer

See `examples/extensions/built-in-tool-renderer.ts` for how to customize how tools appear in the UI.

## Best Practices

1. **Always handle errors**: Return proper error responses instead of throwing
2. **Use TypeScript**: Leverage type safety for better development experience
3. **Clean up resources**: Implement `teardown()` to release resources
4. **Test your extension**: Run pi with your extension and verify behavior

## Troubleshooting

- Check `pi --debug` output for extension loading errors
- Ensure your extension file is in `~/.pi/extensions/`
- Verify your extension exports `extension` as default or named export