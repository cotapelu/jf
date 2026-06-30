import type { ChildStatus, ChildType } from './types.js';
import type { ToolDefinition } from '@earendil-works/pi-coding-agent';

export const MULTI_AGENT_TOOL_DESCRIPTION =
  'Spawn and manage true parallel child agents. Each child runs in its own worker thread with an isolated LLM context and inherits parent services (model, auth, tools). Use for offloading independent tasks while the parent continues working.';

export const MULTI_AGENT_TOOL_PROMPT_SNIPPET =
  'multi-agent: spawn_child child_id; send_message(child_id, input/output/cancel); await_result(child_id); list_children([status]); terminate_child(child_id, force); child tools: reportProgress, askQuestion, complete, error';

export const MULTI_AGENT_TOOL_PROMPT_GUIDELINES = [
  'Use spawn_child only when the task is independent and can run fully in parallel with the parent.',
  'After spawn_child, immediately continue parent work; do not await_result unless the parent path depends on child output.',
  'Pass relevant files or context in the context object so the child does not need to read the parent session state.',
  'Use send_message(child_id, input) to answer a clarifying question (status=waiting-input) from a running child.',
  'Use send_message(child_id, cancel) to stop a child early; prefer non-force first to allow graceful shutdown.',
  'Use list_children([status]) to inspect alive, stuck, or completed children after detaching.',
  'Use await_result(child_id) only when the parent cannot proceed without the child output.',
  'Use terminate_child(child_id, force=true) only as last resort; prefer cancel so the child can emit a final message.',
  'Children do not share conversation history with parent and do not auto-inherit parent tool results or session state.',
  'Child tools (reportProgress, askQuestion, complete, error) are available inside the child agent runtime only.',
];

export const MULTI_AGENT_TOOL_PARAMETERS = {
	type: 'object',
	properties: {
		operation: {
			type: 'string',
			enum: ['spawn_child', 'send_message', 'await_result', 'list_children', 'terminate_child'],
			description: 'The operation to perform',
		},
		type: {
			type: 'string',
			enum: ['llm', 'executor', 'test-runner', 'custom'] as ChildType[],
			description: 'Child agent type (default: llm)',
		},
		mission: {
			type: 'string',
			description: 'Concise mission statement for the child agent',
		},
		context: {
			type: 'object',
			description: 'Frozen context passed to the child; use this instead of expecting parent session memory',
			additionalProperties: true,
		},
		tools: {
			type: 'array',
			items: { type: 'string' },
			description: 'Tool names available to the child (default: same as parent allowlist)',
		},
		childId: {
			type: 'string',
			description: 'Target child agent ID returned by spawn_child',
		},
		message: {
			type: 'object',
			description: 'Message to send to the child',
			properties: {
				type: { type: 'string', enum: ['input', 'output', 'cancel'], description: 'Message kind' },
				payload: { type: 'object', description: 'Message body', additionalProperties: true },
			},
			required: ['type'],
		},
		timeoutMs: {
			type: 'number',
			description: 'Timeout for await_result in milliseconds (default: 120000)',
		},
		status: {
			type: 'string',
			enum: ['idle', 'starting', 'running', 'waiting-input', 'completed', 'error', 'terminated'] as ChildStatus[],
			description: 'Filter children by status',
		},
		force: {
			type: 'string',
			description: 'Force behavior for send or terminate (true/false/ask)',
		},
	},
	required: ['operation'],
} as const;

export function buildMultiAgentToolDefinition(): Omit<ToolDefinition, 'execute'> {
	return {
		name: 'multi-agent',
		label: 'Multi-Agent Orchestration',
		description: MULTI_AGENT_TOOL_DESCRIPTION,
		promptSnippet: MULTI_AGENT_TOOL_PROMPT_SNIPPET,
		promptGuidelines: MULTI_AGENT_TOOL_PROMPT_GUIDELINES,
		parameters: MULTI_AGENT_TOOL_PARAMETERS,
	};
}
