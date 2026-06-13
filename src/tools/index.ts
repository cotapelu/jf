/**
 * Custom Tools Registry
 *
 * Demonstrates usage of ALL tool factories from sdk.ts by calling each one.
 * Note: Most factories take `cwd` and optional `options`.
 */

import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import {
	createBashTool,
	createCodingTools,
	createEditTool,
	createFindTool,
	createGrepTool,
	createLsTool,
	createReadOnlyTools,
	createReadTool,
	createWriteTool,
} from "@earendil-works/pi-coding-agent";
import { createSessionManagerTool } from "./session-manager-tool.js";

// Custom tool: get_time
export const registerGetTimeTool = (): ToolDefinition => ({
	name: "get_time",
	label: "Get Time",
	description: "Get current time in ISO format",
	parameters: {
		type: "object",
		properties: {
			timezone: {
				type: "string",
				description: "Timezone (e.g., 'UTC', 'Asia/Ho_Chi_Minh')",
			},
		},
	},
	async execute(_toolCallId: string, params: { timezone?: string }): Promise<any> {
		const now = new Date();
		const timezone = params.timezone || "UTC";
		const options: Intl.DateTimeFormatOptions = {
			timeZone: timezone,
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
		};
		const formatted = now.toLocaleString("en-CA", options).replace(",", "");
		return {
			content: [{ type: "text", text: `Current time in ${timezone}: ${formatted}` }],
			details: { timestamp: now.toISOString() },
		};
	},
});

/**
 * Register ALL built-in tools by calling EVERY tool factory function
 *
 * This demonstrates full SDK usage:
 * - createBashTool(cwd)
 * - createCodingTools(cwd)
 * - createEditTool(cwd)
 * - createFindTool(cwd)
 * - createGrepTool(cwd)
 * - createLsTool(cwd)
 * - createReadOnlyTools(cwd)
 * - createReadTool(cwd)
 * - createWriteTool(cwd)
 */
export function registerAllBuiltinTools(cwd: string): ToolDefinition[] {
	const tools: ToolDefinition[] = [];

	// 1. Convenience factories (return arrays)
	tools.push(...createCodingTools(cwd));    // [read, bash, edit, write]
	tools.push(...createReadOnlyTools(cwd)); // [read, grep, find, ls]

	// 2. Individual factories (each adds one tool)
	// Note: These will duplicate some tools (e.g., another 'read', 'bash') - SDK will dedupe
	tools.push(createBashTool(cwd));
	tools.push(createEditTool(cwd));
	tools.push(createFindTool(cwd));
	tools.push(createGrepTool(cwd));
	tools.push(createLsTool(cwd));
	tools.push(createReadTool(cwd));
	tools.push(createWriteTool(cwd));

	// All 7 built-in tools are included (some duplicates)
	// The SDK handles deduplication by tool name
	return tools;
}

/**
 * Register all custom (non-builtin) tools
 */
export function registerAllCustomTools(): ToolDefinition[] {
	return [registerGetTimeTool()];
}

/**
 * Combined: ALL tools (built-in via all factories + custom)
 */
export function registerAllTools(cwd: string): ToolDefinition[] {
	return [...registerAllBuiltinTools(cwd), ...registerAllCustomTools()];
}

/**
 * Register session manager tool (requires runtime context to be set)
 */
export function registerSessionManagerTool(): ToolDefinition[] {
	return [createSessionManagerTool()];
}
