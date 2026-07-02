import type { ToolDefinition } from '@earendil-works/pi-coding-agent';
import { compactSession } from './algorithm.js';

/**
 * Context Compaction Tool
 *
 * Compacts session history to fit within token budget by summarizing older messages.
 * Useful for managing LLM context window limits.
 */
export const compactContextTool: ToolDefinition = {
  name: 'session.compact',
  label: 'Context Compaction',
  description: 'Summarize session history to reduce token count while preserving key information',
  parameters: {
    type: 'object',
    properties: {
      maxTokens: { type: 'number', description: 'Target token budget (approx)', default: 4000 },
      preserveRecent: { type: 'boolean', description: 'Keep most recent messages untouched', default: true },
      strategy: {
        type: 'string',
        enum: ['sliding-window', 'hierarchical'],
        default: 'hierarchical',
        description: 'Compaction strategy',
      },
    },
  },
  async execute(toolCallId: string, params: { messages?: { role: string; content: string }[]; maxTokens?: number; preserveRecent?: boolean; strategy?: 'sliding-window' | 'hierarchical' }, _signal?: AbortSignal, _onUpdate?: any, _ctx?: any) {
    try {
      const messages = params.messages;
      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return {
          content: [{ type: 'text', text: 'Error: messages array is required (list of {role, content} objects)' }],
          details: { toolCallId, status: 'error', error: 'Missing messages' },
          isError: true,
        };
      }
      const result = await compactSession(messages, {
        maxTokens: params.maxTokens ?? 4000,
        preserveRecent: params.preserveRecent ?? true,
        strategy: params.strategy ?? 'hierarchical',
      });
      const output = result.summary
        ? `Compacted ${result.removedMessages} older messages into summary.\nOriginal tokens: ~${result.originalTokens}, after: ~${result.compactedTokens}.\n\nSummary:\n${result.summary}`
        : `No compaction needed (${result.originalTokens} tokens <= ${result.compactedTokens}).`;
      return {
        content: [{ type: 'text', text: output }],
        details: { toolCallId, status: 'success', ...result },
      };
    } catch (error: any) {
      return {
        content: [{ type: 'text', text: `Error: ${error.message}` }],
        details: { toolCallId, status: 'error', error: error.message },
        isError: true,
      };
    }
  },
};
