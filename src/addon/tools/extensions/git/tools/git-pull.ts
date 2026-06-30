import type { ToolDefinition } from '@earendil-works/pi-coding-agent';
import { execFile } from 'child_process';
import { promisify } from 'util';
const exec = promisify(execFile);

export const gitPullTool: ToolDefinition = {
  name: 'git.pull',
  label: 'Git Pull',
  description: 'Fetch from and integrate with another repository or a local branch',
  parameters: {
    type: 'object',
    properties: {
      remote: { type: 'string', description: 'Remote name', default: 'origin' },
      branch: { type: 'string', description: 'Branch to pull (optional, defaults to current)' },
    },
  },
  async execute(toolCallId: string, params: any, _signal?: AbortSignal, _onUpdate?: any, ctx?: any) {
    const cwd = ctx?.cwd ?? process.cwd();
    try {
      const args = ['pull', params.remote];
      if (params.branch) args.push(params.branch);
      const { stdout } = await exec('git', args, { cwd });
      return { content: [{ type: 'text', text: stdout }], details: { toolCallId, status: 'success' } };
    } catch (err: any) {
      const msg = err.code === 128 ? 'Not a git repository' : (err.stderr || err.message);
      return { content: [{ type: 'text', text: `❌ ${msg}` }], details: { toolCallId, status: 'error', error: msg } };
    }
  }
};
