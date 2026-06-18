#!/usr/bin/env node

/**
 * Universal Tool – Refactored to use SDK createBashToolDefinition
 *
 * All actions are executed via the SDK bash tool for consistency,
 * proper signal handling, and security (no manual command injection).
 *
 * Actions:
 * - echo: Echo a message
 * - system_info: OS, hardware, uptime
 * - date: Current date/time
 * - uuid: Generate UUID v4
 * - random: Random integer (min/max)
 * - calc: Evaluate math expression via bc
 */

import type { ExtensionAPI, ToolDefinition } from "@earendil-works/pi-coding-agent";
import { createBashToolDefinition } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";

// Cache per-context bash tool to avoid recreation
const bashToolCache = new WeakMap<any, any>();

function getBashTool(ctx: any): any {
  let tool = bashToolCache.get(ctx);
  if (!tool) {
    const cwd = ctx.cwd || process.cwd();
    tool = createBashToolDefinition(cwd, {
      commandPrefix: "" // no prefix, we build full command
    });
    bashToolCache.set(ctx, tool);
  }
  return tool;
}

function buildCommand(action: string, params: any): string {
  switch (action) {
    case "echo": {
      const message = params.message;
      if (typeof message !== "string" || message.length === 0) {
        throw new Error("Missing or invalid parameter: message (non-empty string)");
      }
      // Use JSON.stringify to safely escape quotes, newlines, etc.
      return `echo ${JSON.stringify(message)}`;
    }

    case "system_info": {
      // uname -a for system, df -h for disk
      return "uname -a && df -h";
    }

    case "date": {
      return "date";
    }

    case "uuid": {
      // Try kernel UUID, fallback to uuidgen
      return "cat /proc/sys/kernel/random/uuid 2>/dev/null || uuidgen";
    }

    case "random": {
      const min = params.min != null ? params.min : 0;
      const max = params.max != null ? params.max : 100;
      if (typeof min !== "number" || typeof max !== "number") {
        throw new Error("Invalid random parameters: min and max must be numbers");
      }
      if (min > max) {
        throw new Error("Invalid random range: min > max");
      }
      return `echo $((RANDOM % (${max} - ${min} + 1) + ${min}))`;
    }

    case "calc": {
      const expression = params.expression;
      if (typeof expression !== "string" || expression.length === 0) {
        throw new Error("Missing required parameter: expression");
      }
      // Validate: only digits, operators +-*/, parentheses, decimal points
      const sanitized = expression.replace(/\s/g, '');
      if (!/^[0-9+\-*/().]+$/.test(sanitized)) {
        throw new Error('Invalid expression. Only numbers and operators (+, -, *, /) allowed.');
      }
      // Use bc for calculation, scale=6 for decimal precision
      return `echo "scale=6; ${sanitized}" | bc -l`;
    }

    default:
      throw new Error(`Unknown action: ${action}. Available: echo, system_info, date, uuid, random, calc`);
  }
}

/**
 * Execute universal tool action via bash tool.
 */
async function executeUniversal(
  _toolCallId: string,
  params: { action: string; [key: string]: any },
  signal: AbortSignal | undefined,
  onUpdate: (data: any) => void,
  ctx: any
): Promise<any> {
  const { action } = params;

  if (!action) {
    return { isError: true, content: [{ type: "text", text: "Missing required parameter: action" }], details: undefined };
  }

  const validActions = ["echo", "system_info", "date", "uuid", "random", "calc"];
  if (!validActions.includes(action)) {
    return {
      isError: true,
      content: [{ type: "text", text: `Unknown action: ${action}. Valid: ${validActions.join(", ")}` }],
      details: undefined,
    };
  }

  try {
    const bashTool = getBashTool(ctx);
    const command = buildCommand(action, params);
    const result: any = await bashTool.execute(_toolCallId, { command }, signal, onUpdate, ctx);

    // Normalize: bash tool returns { isError?, content?, details?, ... }
    return {
      isError: result?.isError ?? false,
      content: result?.content ?? (result?.output ? [{ type: "text", text: result.output }] : []),
      details: { ...result?.details, action },
    };
  } catch (error: any) {
    return {
      isError: true,
      content: [{ type: "text", text: `❌ Error: ${error.message}` }],
      details: { error: error.message, action },
    };
  }
}

/**
 * Render tool results.
 * For system_info from the original action (if structured), format nicely.
 * Otherwise fall back to default render or plain text.
 */
function renderUniversal(result: any, options: any, theme: any): any {
  // @ts-ignore
  const details = result.details;

  // If we have structured system_info details (platform, arch, etc.), format them
  if (details && typeof details === 'object' && 'platform' in details) {
    const lines = [
      theme.fg('accent', 'System Information'),
      `OS: ${details.platform} (${details.arch})`,
      `Node: ${details.nodeVersion}`,
      `Uptime: ${details.uptime}s`,
      `Memory: ${details.totalMemoryMB} MB total, ${details.freeMemoryMB} MB free`,
      `CPU: ${details.cpuCores} cores - ${details.cpuModel}`,
    ];
    return new Text(lines.join('\n'), 0, 0);
  }

  // Fallback #1: default renderer (from SDK)
  if (options.defaultRender) {
    return options.defaultRender(result);
  }

  // Fallback #2: plain text from first content item
  const text = result.content?.[0]?.text || '';
  return new Text(text, 0, 0);
}

/**
 * Register the universal tool extension.
 */
export function registerUniversalTool(api: ExtensionAPI): void {
  const tool: ToolDefinition = {
    name: "universal",
    label: "Universal Tool",
    description:
      "Multi-purpose tool with registry-based actions. Supports: echo, system_info, date, uuid, random, calc. Easily extensible.",
    promptSnippet:
      "universal({ action: '<action>', ...params })",
    promptGuidelines: [
      "Use the universal tool with an `action` parameter.",
      "Available actions:",
      "- 'echo': Echo a message back (requires `message`).",
      "- 'system_info': Get system diagnostics (no parameters).",
      "- 'date': Get current date/time in ISO and locale formats (no parameters).",
      "- 'uuid': Generate a random UUID v4 (no parameters).",
      "- 'random': Generate a random integer (optional: `min`, `max`, default 0-100).",
      "- 'calc': Evaluate a math expression (requires `expression`, e.g., '2 + 3 * 4'). Uses bc for safe evaluation."
    ],
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["echo", "system_info", "date", "uuid", "random", "calc"],
          description: "Which action to perform",
        },
        message: { type: "string", description: "Message to echo (required for echo)" },
        min: { type: "number", description: "Minimum integer (for random)" },
        max: { type: "number", description: "Maximum integer (for random)" },
        expression: { type: "string", description: "Math expression to evaluate (for calc)" }
      },
      required: ["action"],
    },
    execute: executeUniversal,
    renderResult: renderUniversal,
  };

  api.registerTool(tool);
}
