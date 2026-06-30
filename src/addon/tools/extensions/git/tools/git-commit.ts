import type { ToolDefinition } from '@earendil-works/pi-coding-agent';
import { execFile } from 'child_process';
import { promisify } from 'util';
const exec = promisify(execFile);

export const gitCommitTool: ToolDefinition = {
  name: 'git.commit',
  label: 'Git Commit',
  description: 'Record changes to repository',
  parameters: {
    type: 'object',
    properties: {
      message: { type: 'string', description: 'Commit message' },
      all: { type: 'boolean', description: 'Stage all changes (git commit -a)', default: false },
      amend: { type: 'boolean', description: 'Amend previous commit', default: false },
    },
    required: ['message'],
  },
  async execute(toolCallId: string, params: any, _signal?: AbortSignal, _onUpdate?: any, ctx?: any) {
    const cwd = ctx?.cwd ?? process.cwd();
    try {
      const args = ['commit'];
      if (params.all) args.push('-a');
      if (params.amend) args.push('--amend');
      args.push('-m', params.message);
      const { stdout } = await exec('git', args, { cwd });
      return { content: [{ type: 'text', text: stdout }], details: { toolCallId, status: 'success' } };
    } catch (err: any) {
      const msg = err.code === 128 ? 'Not a git repository' : (err.stderr || err.message);
      return { content: [{ type: 'text', text: `❌ ${msg}` }], details: { toolCallId, status: 'error', error: msg } };
    }
  }
};
