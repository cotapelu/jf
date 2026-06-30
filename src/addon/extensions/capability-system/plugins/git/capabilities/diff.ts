#!/usr/bin/env node
/**
 * git.diff capability
 */

import { Type } from "typebox";

export const schema = Type.Object({
  revision: Type.Optional(Type.String({ description: "Revision to diff against (default: HEAD)" }))
}, { additionalProperties: false });

export async function execute(params: { revision?: string } = {}, ctx: any): Promise<any> {
  const cwd = ctx.cwd || process.cwd();
  const revision = params.revision || "HEAD";

  try {
    const result = await ctx.exec("git", ["diff", revision, "--color=never"], { cwd });

    if (result.code !== 0) {
      return {
        content: [{ type: "text" as const, text: `❌ git diff failed:\n${result.stderr}` }],
        isError: true,
        details: { error: result.stderr, exitCode: result.code }
      };
    }

    const output = result.stdout || "(no changes)";

    return {
      content: [{ type: "text" as const, text: output }],
      details: { revision, lines: output.split('\n').length },
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
