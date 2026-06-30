import type { AgentToolResult, AgentToolUpdateCallback, ExtensionContext, ToolDefinition } from '@earendil-works/pi-coding-agent';
import { multiAgentRuntime } from './runtime.js';
import { setRuntime, spawnChild, sendMessage, awaitResult, listChildren, terminateChild } from './parent-tools.js';
import { getCurrentRuntime } from '../../runtime-context.js';
import {
	MULTI_AGENT_TOOL_DESCRIPTION,
	MULTI_AGENT_TOOL_PROMPT_SNIPPET,
	MULTI_AGENT_TOOL_PROMPT_GUIDELINES,
	MULTI_AGENT_TOOL_PARAMETERS,
} from './definition.js';

setRuntime(multiAgentRuntime);

function toResult<T>(value: { content: { type: string; text: string }[]; details?: T }): AgentToolResult<unknown> {
	return {
		content: value.content.map((c) => ({ type: 'text' as const, text: c.text })),
		details: value.details,
	};
}

function ensureParentConfig(): void {
	const existing = (multiAgentRuntime as any).parentConfig;
	if (existing?.services) return;
	try {
		const runtime = getCurrentRuntime();
		const services = (runtime as any).services;
		const sessionManager = (runtime as any).sessionManager;
		if (services || sessionManager) {
			multiAgentRuntime.setParentConfig({
				cwd: runtime.cwd,
				agentDir: (runtime as any).agentDir ?? process.cwd(),
				model: 'anthropic/claude-sonnet-4-20250514',
				thinkingLevel: 'medium',
				tools: [],
				services,
				sessionManager,
			});
		}
	} catch {
		// runtime chưa sẵn sàng; spawnChild sẽ ném lỗi rõ ràng
	}
}

export function createMultiAgentTool(): ToolDefinition {
	return {
		name: 'multi-agent',
		label: 'Multi-Agent Orchestration',
		description: MULTI_AGENT_TOOL_DESCRIPTION,
		promptSnippet: MULTI_AGENT_TOOL_PROMPT_SNIPPET,
		promptGuidelines: MULTI_AGENT_TOOL_PROMPT_GUIDELINES,
		parameters: MULTI_AGENT_TOOL_PARAMETERS,
		async execute(
			_toolCallId: string,
			params: unknown,
			_signal?: AbortSignal,
			_onUpdate?: AgentToolUpdateCallback<unknown>,
			_ctx?: ExtensionContext
		): Promise<AgentToolResult<unknown>> {
			ensureParentConfig();
			const p = params as {
				operation: string;
				type?: 'llm' | 'executor' | 'test-runner' | 'custom';
				mission?: string;
				context?: Record<string, unknown>;
				tools?: string[];
				childId?: string;
				message?: { type: string; payload?: unknown };
				timeoutMs?: number;
				status?: string;
				force?: boolean;
			};

			try {
				switch (p.operation) {
					case 'spawn_child': {
						if (!p.mission) throw new Error('mission is required for spawn_child');
						return toResult(
							await spawnChild({
								type: p.type ?? 'llm',
								mission: p.mission,
								context: p.context,
								tools: p.tools,
							})
						);
					}
					case 'send_message': {
						if (!p.childId) throw new Error('childId is required for send_message');
						if (!p.message) throw new Error('message is required for send_message');
						return toResult(await sendMessage({ childId: p.childId, message: p.message as any }));
					}
					case 'await_result': {
						if (!p.childId) throw new Error('childId is required for await_result');
						return toResult(await awaitResult({ childId: p.childId, timeoutMs: p.timeoutMs }));
					}
					case 'list_children': {
						return toResult(await listChildren({ status: p.status as any }));
					}
					case 'terminate_child': {
						if (!p.childId) throw new Error('childId is required for terminate_child');
						return toResult(await terminateChild({ childId: p.childId, force: p.force }));
					}
					default:
						throw new Error(`Unknown operation: ${p.operation}`);
				}
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				return toResult({
					content: [{ type: 'text', text: `Error: ${message}` }],
					details: { operation: p.operation, error: message },
				});
			}
		},
	};
}