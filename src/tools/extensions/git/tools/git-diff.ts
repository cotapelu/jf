import type { ToolDefinition } from '@earendil-works/pi-coding-agent';
import { execFile } from 'child_process';
import { promisify } from 'util';
const exec = promisify(execFile);

export const gitDiffTool: ToolDefinition = {
  name: 'git.diff',
  label: 'Git Diff',
  description: 'Show changes between commits, commit and working tree, etc.',
  parameters: {
    type: 'object',
    properties: {
      file: { type: 'string', description: 'Path to specific file to diff (optional)' },
      staged: { type: 'boolean', description: 'Show staged changes only', default: false },
    },
  },
  async execute(toolCallId: string, params: any, _signal?: AbortSignal, _onUpdate?: any, ctx?: any) {
    const cwd = ctx?.cwd ?? process.cwd();
    try {
      const args = ['diff'];
      if (params.staged) args.push('--staged');
      if (params.file) args.push('--', params.file);
      const { stdout } = await exec('git', args, { cwd });
      return { content: [{ type: 'text', text: stdout || 'No differences' }], details: { toolCallId, status: 'success' } };
    } catch (err: any) {
      const msg = err.code === 128 ? 'Not a git repository' : (err.stderr || err.message);
      return { content: [{ type: 'text', text: `❌ ${msg}` }], details: { toolCallId, status: 'error', error: msg } };
    }
  }
};
