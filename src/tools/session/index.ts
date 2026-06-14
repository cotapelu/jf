import type { ToolDefinition } from '@earendil-works/pi-coding-agent';
import { MultiSessionManager } from './manager.js';
import { getCurrentRuntime } from '../../runtime-context.js';
import {
  operationCreate,
  operationSwitch,
  operationList,
  operationInfo,
  operationRename,
  operationTag,
  operationDelete,
  operationExport,
  operationTree,
  operationHistory,
  operationStatus,
  operationDiagnostics,
} from './operations/index.js';
import { formatListOutput } from './utils.js';

let manager: MultiSessionManager | null = null;

export function initializeSessionTool(): void {
  if (manager) return;

  const runtime = getCurrentRuntime();
  manager = new MultiSessionManager(runtime, {
    allowMultipleChildren: true,
    maxSessions: 0,
  });
  console.log('🔧 Session tool initialized');
}

function getManager(): MultiSessionManager {
  if (!manager) {
    initializeSessionTool();
    if (!manager) throw new Error('Session tool not initialized');
  }
  return manager;
}

export function resetSessionTool(): void {
  manager = null;
}

export function createSessionTool(): ToolDefinition {
  return {
    name: 'session',
    label: 'Session Management',
    description:
      'Comprehensive session management tool. Create, switch, list, rename, tag, export, and inspect sessions.\n\n' +
      'Operations: create, switch, list, info, rename, tag, delete, export, tree, history, status, diagnostics',
    promptSnippet: 'session: manage sessions (create, switch, list, info, export)',
    promptGuidelines: [
      'Use sessions to compartmentalize work: create a new child session for each independent task.',
      'Switch back to parent when done to continue the main conversation flow.',
      'Name sessions meaningfully for easy identification later.',
      "Use tags to categorize sessions (e.g., 'debug', 'feature-x', 'refactor').",
      'List sessions to see what exists and which is active.',
      'Export important sessions to preserve work.',
      'Avoid disposing parent session unless ending the entire runtime.',
      'Session IDs are persistent; save them if you need to reference specific sessions later.',
    ],
    parameters: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          enum: [
            'create',
            'switch',
            'list',
            'info',
            'rename',
            'tag',
            'delete',
            'export',
            'tree',
            'history',
            'status',
            'diagnostics',
          ],
          description: 'The operation to perform',
        },
        sessionId: {
          type: 'string',
          description: "Target session ID (use 'parent' for root, 'last' for most recent child)",
        },
        name: { type: 'string', description: 'New name for the session' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Tags' },
        tagAction: { type: 'string', enum: ['add', 'remove'], description: 'Add or remove tags' },
        exportFormat: { type: 'string', enum: ['json', 'html'], description: 'Export format' },
        exportPath: { type: 'string', description: 'Output file path' },
        filterState: {
          type: 'string',
          enum: ['active', 'inactive', 'all'],
          description: 'Filter sessions',
        },
        sortBy: { type: 'string', enum: ['created', 'name', 'id'], description: 'Sort field' },
        limit: { type: 'number', description: 'Maximum number to return' },
      },
      required: ['operation'],
    },
    async execute(
      toolCallId: string,
      params: {
        operation: string;
        sessionId?: string;
        name?: string;
        tags?: string[];
        tagAction?: 'add' | 'remove';
        exportFormat?: 'json' | 'html';
        exportPath?: string;
        filterState?: 'active' | 'inactive' | 'all';
        sortBy?: 'created' | 'name' | 'id';
        limit?: number;
      }
    ): Promise<any> {
      const mgr = getManager();

      try {
        switch (params.operation) {
          case 'create':
            return await operationCreate(mgr, params);
          case 'switch':
            return await operationSwitch(mgr, params);
          case 'list': {
            const { sessions } = operationList(mgr, params);
            return {
              content: [{ type: 'text', text: formatListOutput(sessions, mgr) }],
              details: {
                operation: 'list',
                count: sessions.length,
                sessions: sessions.map((s) => ({
                  id: s.id,
                  name: s.name,
                  isActive: s.isActive,
                  tags: s.tags,
                  filePath: s.filePath,
                })),
              },
            };
          }
          case 'info':
            return operationInfo(mgr, params);
          case 'rename':
            return operationRename(mgr, params);
          case 'tag':
            return operationTag(mgr, params);
          case 'delete':
            return await operationDelete(mgr, params);
          case 'export':
            return operationExport(mgr, params);
          case 'tree':
            return operationTree(mgr);
          case 'history':
            return operationHistory(mgr, params);
          case 'status':
            return operationStatus(mgr);
          case 'diagnostics':
            return operationDiagnostics(mgr);
          default:
            throw new Error(`Unknown operation: ${params.operation}`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const stack = error instanceof Error ? error.stack : undefined;
        return {
          content: [{ type: 'text', text: `❌ Error: ${message}` }],
          details: { operation: params.operation, error: message, stack },
          isError: true,
        };
      }
    },
  };
}
