#!/usr/bin/env node
/**
 * git.status capability
 */

import { Type } from "typebox";

export const schema = Type.Object({
  // No parameters
}, { additionalProperties: false });

export async function execute(_params: Record<string, never> = {}, ctx: any): Promise<any> {
  const cwd = ctx.cwd || process.cwd();

  try {
    const result = await ctx.exec("git", ["status", "--porcelain", "--branch"], { cwd });

    if (result.code !== 0) {
      return {
        content: [{ type: "text" as const, text: `❌ git status failed:\n${result.stderr}` }],
        isError: true,
        details: { error: result.stderr, exitCode: result.code }
      };
    }

    const lines = result.stdout.trim().split('\n').filter(Boolean);
    const staged: string[] = [];
    const unstaged: string[] = [];
    const untracked: string[] = [];

    for (const line of lines) {
      const code = line.slice(0, 2);
      const file = line.slice(3);
      if (code === '??') {
        untracked.push(file);
      } else if (code.startsWith(' ')) {
        unstaged.push(`${code} ${file}`);
      } else {
        staged.push(`${code} ${file}`);
      }
    }

    const branchLine = lines.find((l: string) => l.startsWith('## '));
    const branch = branchLine ? branchLine.slice(3).split('...')[0] : '(unknown)';

    const summary = [
      `Branch: ${branch}`,
      `Staged: ${staged.length}`,
      staged.length > 0 ? `  ${staged.join('\n  ')}` : '',
      `Unstaged: ${unstaged.length}`,
      unstaged.length > 0 ? `  ${unstaged.join('\n  ')}` : '',
      `Untracked: ${untracked.length}`,
      untracked.length > 0 ? `  ${untracked.join('\n  ')}` : ''
    ].filter(Boolean).join('\n');

    return {
      content: [{ type: "text" as const, text: summary }],
      details: {
        branch,
        staged,
        unstaged,
        untracked,
        totalFiles: lines.length
      },
      isError: false
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text" as const, text: `❌ Error: ${msg}` }],
      isError: true,
      details: { error: msg }
    };
  }
}

export default { execute, schema };
