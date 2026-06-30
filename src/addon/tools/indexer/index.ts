import type { ToolDefinition } from '@earendil-works/pi-coding-agent';
import { scanCodebase } from './ast-scanner.js';

export const codebaseIndexTool: ToolDefinition = {
  name: 'codebase.index',
  label: 'Codebase Indexer',
  description: 'Search codebase for symbols (functions, classes, interfaces) using AST',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query (keyword, case-insensitive)' },
      kind: { type: 'string', enum: ['function', 'class', 'interface', 'method', 'constructor', 'type', 'all'], default: 'all' },
      limit: { type: 'number', description: 'Maximum results to return', default: 50 }
    },
    required: ['query']
  },
  async execute(toolCallId: string, params: any, _signal?: AbortSignal, _onUpdate?: any, ctx?: any) {
    const cwd = ctx?.cwd ?? process.cwd();
    try {
      const { matches } = await scanCodebase(cwd, {
        query: params.query,
        kind: params.kind,
        limit: params.limit,
      });
      const output = matches.length
        ? matches.map(m => `${m.file}:${m.line}:${m.column}: ${m.kind} ${m.name}`).join('\n')
        : 'No symbols found';
      return {
        content: [{ type: 'text', text: output }],
        details: { toolCallId, status: 'success', count: matches.length }
      };
    } catch (error: any) {
      return {
        content: [{ type: 'text', text: `Error: ${error.message}` }],
        details: { toolCallId, status: 'error', error: error.message }
      };
    }
  }
};
