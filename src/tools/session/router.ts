import type { ToolDefinition, AgentToolResult, AgentToolUpdateCallback, ExtensionContext } from '@earendil-works/pi-coding-agent';
import { MultiSessionManager } from './manager.js';
import { operationCreate, operationSwitch, operationList, operationInfo, operationRename, operationTag, operationDelete, operationExport, operationTree, operationHistory, operationStatus, operationDiagnostics, operationCleanup, operationPrepareChild, operationChildRead, operationChildWrite, operationParentRead, operationCompleteChild, } from './operations/index.js';
import { formatListOutput } from './utils.js';
import { SESSION_TOOL_DESCRIPTION, SESSION_TOOL_PROMPT_SNIPPET, SESSION_TOOL_PROMPT_GUIDELINES, SESSION_TOOL_PARAMETERS, } from './definition.js';

export interface SessionToolContext {
  initialize: () => MultiSessionManager;
}

function toResult<T>(value: { content: { type: string; text: string }[]; details: T }): AgentToolResult<unknown> {
  return { content: value.content.map((c) => ({ type: 'text' as const, text: c.text })), details: value.details };
}

type SessionOpHandler = (p: any, mgr: MultiSessionManager) => Promise<AgentToolResult<unknown>>;

const sessionOperationHandlers: Record<string, SessionOpHandler> = {
  create: async (p, mgr) => toResult(await operationCreate(mgr, p)),
  switch: async (p, mgr) => toResult(await operationSwitch(mgr, p)),
  list: async (p, mgr) => {
    const { sessions } = operationList(mgr, p);
    return toResult({
      content: [{ type: 'text', text: formatListOutput(sessions, mgr) }],
      details: {
        operation: 'list',
        count: sessions.length,
        sessions: sessions.map((s: any) => ({
          id: s.id,
          name: s.name,
          isActive: s.isActive,
          tags: s.tags,
          filePath: s.filePath,
        })),
      },
    });
  },
  info: async (p, mgr) => toResult(operationInfo(mgr, p)),
  rename: async (p, mgr) => toResult(operationRename(mgr, p)),
  tag: async (p, mgr) => toResult(operationTag(mgr, p)),
  delete: async (p, mgr) => toResult(await operationDelete(mgr, p)),
  export: async (p, mgr) => toResult(operationExport(mgr, p)),
  tree: async (p, mgr) => toResult(operationTree(mgr)),
  history: async (p, mgr) => toResult(operationHistory(mgr, p)),
  status: async (p, mgr) => toResult(operationStatus(mgr)),
  diagnostics: async (p, mgr) => toResult(operationDiagnostics(mgr)),
  cleanup: async (p, mgr) => {
    const res = await operationCleanup(mgr, p);
    return toResult(res as any);
  },
  prepare_child: async (p, mgr) => {
    if (!p.contract?.mission) throw new Error('contract.mission is required for prepare_child');
    return toResult(await operationPrepareChild(mgr, {
      name: p.name,
      tags: p.tags,
      contract: {
        mission: p.contract.mission,
        allowedFiles: p.contract.allowedFiles,
        outputPath: p.contract.outputPath,
        doneCriteria: p.contract.doneCriteria,
      },
    }));
  },
  child_read: async (p, mgr) => toResult(await operationChildRead(mgr, { sessionId: p.sessionId })),
  child_write: async (p, mgr) => {
    if (!p.content) throw new Error('content is required for child_write');
    return toResult(await operationChildWrite(mgr, { sessionId: p.sessionId, content: p.content, checkpoint: p.checkpoint }));
  },
  parent_read: async (p, mgr) => {
    if (!p.sessionId) throw new Error('sessionId is required for parent_read');
    return toResult(await operationParentRead(mgr, { sessionId: p.sessionId }));
  },
  complete_child: async (p, mgr) => toResult(await operationCompleteChild(mgr, { sessionId: p.sessionId })),
};

export function createSessionToolRouter(context: SessionToolContext): ToolDefinition {
  return {
    name: 'session',
    label: 'Session Management',
    description: SESSION_TOOL_DESCRIPTION,
    promptSnippet: SESSION_TOOL_PROMPT_SNIPPET,
    promptGuidelines: SESSION_TOOL_PROMPT_GUIDELINES,
    parameters: SESSION_TOOL_PARAMETERS,
    async execute(toolCallId: string, params: unknown, _signal?: AbortSignal, _onUpdate?: AgentToolUpdateCallback<unknown>, _ctx?: ExtensionContext): Promise<AgentToolResult<unknown>> {
      const p = params as any;
      const mgr = context.initialize();
      try {
        const handler = sessionOperationHandlers[p.operation];
        if (!handler) {
          throw new Error(`Unknown operation: ${p.operation}`);
        }
        return await handler(p, mgr);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text', text: `Error: ${message}` }],
          details: { operation: p.operation, error: message },
          isError: true,
        };
      }
    },
  };
}
