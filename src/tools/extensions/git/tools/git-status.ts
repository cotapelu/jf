import type { ToolDefinition } from '@earendil-works/pi-coding-agent';
import { execFile } from 'child_process';
import { promisify } from 'util';
const exec = promisify(execFile);

export const gitStatusTool: ToolDefinition = {
  name: 'git.status',
  label: 'Git Status',
  description: 'Show working tree status',
  parameters: {
    type: 'object',
    properties: {
      porcelain: { type: 'boolean', description: 'Machine-readable format', default: true }
    }
  },
  async execute(toolCallId: string, params: any, _signal?: AbortSignal, _onUpdate?: any, ctx?: any) {
    const cwd = ctx?.cwd ?? process.cwd();
    try {
      const args = ['status', '--porcelain'].filter(() => params.porcelain !== false);
      const { stdout } = await exec('git', args, { cwd });
      return { content: [{ type: 'text', text: stdout.trim() || '✓ Clean' }], details: { toolCallId, status: 'success' } };
    } catch (err: any) {
      const msg = err.code === 128 ? 'Not a git repository' : (err.stderr || err.message);
      return { content: [{ type: 'text', text: `❌ ${msg}` }], details: { toolCallId, status: 'error', error: msg } };
    }
  }
};
