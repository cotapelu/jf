#!/usr/bin/env node
/**
 * git.pull capability
 */

import { Type } from "typebox";

export const schema = Type.Object({
  remote: Type.Optional(Type.String({ description: "Remote name (default: origin)" })),
  branch: Type.Optional(Type.String({ description: "Branch to pull (default: current)" }))
}, { additionalProperties: false });

export async function execute(params: { remote?: string; branch?: string }, ctx: any): Promise<any> {
  const cwd = ctx.cwd || process.cwd();
  const { remote = "origin", branch } = params;

  try {
    const args = ["pull", remote];
    if (branch) args.push(branch);

    const result = await ctx.exec("git", args, { cwd });

    if (result.code !== 0) {
      return {
        content: [{ type: "text" as const, text: `❌ git pull failed:\n${result.stderr}` }],
        isError: true,
        details: { error: result.stderr, exitCode: result.code }
      };
    }

    return {
      content: [{ type: "text" as const, text: result.stdout || `✅ Pulled from ${remote}${branch ? `/${branch}` : ''}` }],
      details: { remote, branch },
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
