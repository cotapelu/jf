import { join } from "node:path";
import { createLLMToolInterface, createMemoryEngine, createSQLiteStore } from "@mariozechner/pi-coding-memory";
import { getAgentDir } from "../config.js";
import type { ToolDefinition } from "./extensions/types.js";

// Initialize singleton memory store (creates/uses ~/.pi/agent/memory.db)
const dbPath = join(getAgentDir(), "memory.db");
const store = createSQLiteStore(dbPath);
const engine = createMemoryEngine(store);
const memoryToolInterface = createLLMToolInterface(engine);

// Wrap a MemoryTool (from coding-memory) into a ToolDefinition
function wrapMemoryTool(memoryTool: ReturnType<typeof memoryToolInterface.getTools>[number]): ToolDefinition {
	let promptSnippet: string | undefined;
	let promptGuidelines: string[] | undefined;

	switch (memoryTool.name) {
		case "memory_save":
			promptSnippet = "Save information to memory (preferences, project facts, commands, solutions)";
			promptGuidelines = [
				"Proactively save important information the user shares",
				"Save user preferences (indentation, language, frameworks)",
				"Save project facts (databases, APIs, deployment info)",
				"Save solutions to bugs and code patterns for future recall",
			];
			break;
		case "memory_find":
			promptSnippet = "Search memory for relevant information";
			promptGuidelines = [
				"Always recall relevant memories before making assumptions",
				"Ask memory_find when you need context about user preferences or project setup",
				"Use memory_find to retrieve past solutions to similar problems",
			];
			break;
		case "memory_forget":
			promptSnippet = "Delete a memory by ID";
			break;
		case "memory_stats":
			promptSnippet = "Get statistics about stored memories";
			break;
	}

	return {
		name: memoryTool.name,
		label: memoryTool.name.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase()),
		description: memoryTool.description,
		parameters: memoryTool.parameters as any, // JSON schema format, cast to any for compatibility
		promptSnippet,
		promptGuidelines,
		async execute(_toolCallId: string, params: any, _signal?: AbortSignal, _onUpdate?: any, _ctx?: any) {
			const result = await memoryToolInterface.executeTool(memoryTool.name, params);
			return {
				ok: result.ok,
				value: result.ok ? result.value : undefined,
				error: result.ok ? undefined : result.error,
			} as any;
		},
	};
}

// Export tool definitions as an array
export const memoryToolDefinitions = memoryToolInterface.getTools().map(wrapMemoryTool);

// Also export the engine/interface for potential future use
export { engine, memoryToolInterface, store };
