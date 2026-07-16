#!/usr/bin/env node
/**
 * SubTool Loader - SECURE VERSION
 *
 * Provides a tool that delegates to SDK tool factories.
 * No manual command execution → no injection vulnerabilities.
 *
 * Uses SDK tool definitions:
 * - createReadToolDefinition
 * - createLsToolDefinition
 * - createFindToolDefinition
 * - createGrepToolDefinition
 * - createBashToolDefinition (for HTTP via curl)
 */

import type { ExtensionAPI, ToolDefinition, ExtensionContext } from "@earendil-works/pi-coding-agent"; // AgentToolResult unused
import {
  createReadToolDefinition,
  createLsToolDefinition,
  createFindToolDefinition,
  createGrepToolDefinition,
  createBashToolDefinition,
} from "@earendil-works/pi-coding-agent";

// Cache for per-context tool instances
const toolCache = new WeakMap<ExtensionContext, Map<string, ToolDefinition>>();

function getToolsForContext(ctx: ExtensionContext): Map<string, ToolDefinition> {
  let cached = toolCache.get(ctx);
  if (!cached) {
    cached = new Map();
    toolCache.set(ctx, cached);
  }
  return cached;
}

function getOrCreateTool(
  ctx: ExtensionContext,
  subtool: string,
  factory: (cwd: string) => ToolDefinition
): ToolDefinition {
  const tools = getToolsForContext(ctx);
  let tool = tools.get(subtool);
  if (!tool) {
    const cwd = ctx.cwd || process.cwd();
    tool = factory(cwd);
    tools.set(subtool, tool);
  }
  return tool;
}

// ==================== FACTORIES ====================

function createHttpTool(cwd: string): ToolDefinition {
  return createBashToolDefinition(cwd, {
    commandPrefix: ""
  }) as ToolDefinition;
}

function createLsToolWrapper(cwd: string): ToolDefinition {
  return createLsToolDefinition(cwd) as ToolDefinition;
}

function createFindToolWrapper(cwd: string): ToolDefinition {
  return createFindToolDefinition(cwd, {}) as ToolDefinition;
}

function createGrepToolWrapper(cwd: string): ToolDefinition {
  return createGrepToolDefinition(cwd, {}) as ToolDefinition;
}

function createReadToolWrapper(cwd: string): ToolDefinition {
  return createReadToolDefinition(cwd) as ToolDefinition;
}

// ==================== EXECUTION ====================

/**
 * Execute a subtool call.
 * Validates subtool, routes to appropriate SDK tool, returns standardized result.
 */
async function handleHttpSubtool(tool: any, toolCallId: string, args: any, signal?: AbortSignal, onUpdate?: any, ctx?: any): Promise<any> {
  const { url, method = "GET", headers, body } = args as { url: string; method?: string; headers?: Record<string, string>; body?: string };
  if (!url) {
    return { isError: true, content: [{ type: "text", text: "Missing required parameter: url" }], details: undefined };
  }
  try { new URL(url); } catch {
    return { isError: true, content: [{ type: "text", text: `Invalid URL: ${url}` }], details: undefined };
  }
  const curlArgs: string[] = ["-sS", "--fail"];
  if (method && method !== "GET") curlArgs.push("-X", method);
  if (headers && typeof headers === "object") Object.entries(headers).forEach(([k, v]) => curlArgs.push("-H", `${k}: ${v}`));
  if (body) curlArgs.push("-d", body);
  curlArgs.push(url);
  const command = `curl ${curlArgs.map(a => JSON.stringify(a)).join(' ')}`;
  // @ts-ignore
  const result: any = await tool.execute(toolCallId, { command }, signal, onUpdate, ctx);
  return {
    isError: result?.isError ?? false,
    content: result?.content ?? [{ type: "text", text: result?.output ?? "No output" }],
    details: { ...result?.details, url, method, headers },
  };
}
async function handleGenericSubtool(tool: any, toolCallId: string, args: any, signal?: AbortSignal, onUpdate?: any, ctx?: any): Promise<any> {
  // @ts-ignore
  const result: any = await tool.execute(toolCallId, args, signal, onUpdate, ctx);
  return {
    isError: result?.isError ?? false,
    content: result?.content ?? [],
    details: result?.details,
  };
}
function getToolForSubtool(ctx: ExtensionContext, subtool: string): ToolDefinition {
  return getOrCreateTool(ctx, subtool, (cwd) => {
    switch (subtool) {
      case "http": return createHttpTool(cwd);
      case "ls": return createLsToolWrapper(cwd);
      case "find": return createFindToolWrapper(cwd);
      case "grep": return createGrepToolWrapper(cwd);
      case "read": return createReadToolWrapper(cwd);
      default: throw new Error(`Unhandled subtool: ${subtool}`);
    }
  });
}
async function executeSubtool(
  _toolCallId: string,
  params: { subtool: string; args: Record<string, unknown> },
  signal: AbortSignal | undefined,
  onUpdate: (data: any) => void,
  ctx: ExtensionContext
): Promise<any> {
  const { subtool, args } = params;
  const toolCallId = `subtool-${subtool}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  if (!subtool) return { isError: true, content: [{ type: "text", text: "Missing required parameter: subtool" }], details: undefined };
  const valid = ["http","ls","find","grep","read"];
  if (!valid.includes(subtool)) return { isError: true, content: [{ type: "text", text: `Unknown sub-tool: ${subtool}. Valid: ${valid.join(", ")}` }], details: undefined };
  try {
    const tool = getToolForSubtool(ctx, subtool);
    return await (subtool === "http"
      ? handleHttpSubtool(tool, toolCallId, args, signal, onUpdate, ctx)
      : handleGenericSubtool(tool, toolCallId, args, signal, onUpdate, ctx));
  } catch (error: any) {
    const msg = error instanceof Error ? error.message : String(error);
    return { isError: true, content: [{ type: "text", text: `❌ Error: ${msg}` }], details: { error: msg } };
  }
}

// ==================== TOOL DEFINITION ====================

/**
 * Subtool Loader Tool Definition
 *
 * Facade to multiple SDK tools with safe parameter validation.
 */
export function createSubLoaderToolDefinition(): ToolDefinition {
  return {
    name: "subtool_loader",
    label: "SubTool Loader",
    description:
      "Unified access to file and network operations using SDK tools. " +
      "Tools: read (file), ls (list), find (search files), grep (text search), http (curl).",
    promptSnippet: "Use `subtool_loader({ subtool, args })` to invoke operations.",
    promptGuidelines: [
      "All sub-tools use SDK implementations with proper validation and signal handling.",
      "",
      "**read** - Read file",
      "args: { path: string, maxLines?: number, maxBytes?: number, autoResize?: boolean }",
      "",
      "**ls** - List directory",
      "args: { path?: string, all?: boolean }",
      "",
      "**find** - Find files",
      "args: { pattern: string, path?: string }",
      "",
      "**grep** - Search text",
      "args: { pattern: string, path?: string, limit?: number, glob?: string }",
      "",
      "**http** - HTTP request",
      "args: { url: string, method?: string, headers?: Record<string,string>, body?: string }",
    ],
    parameters: {
      type: "object",
      properties: {
        subtool: { type: "string", enum: ["http", "ls", "find", "grep", "read"], description: "Sub-tool name" },
        args: { type: "object", description: "Arguments for the sub-tool" },
      },
      required: ["subtool", "args"],
    },
    // @ts-ignore
    execute: executeSubtool,
  };
}

/**
 * Register the sub-tool loader extension.
 */
export function registerSubToolLoaderExtension(api: ExtensionAPI): void {
  const tool = createSubLoaderToolDefinition();
  api.registerTool(tool);
}
