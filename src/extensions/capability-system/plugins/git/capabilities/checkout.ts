#!/usr/bin/env node
/**
 * git.checkout capability
 */

import { Type } from "typebox";

export const schema = Type.Object({
  branch: Type.String({ description: "Branch name to checkout" }),
  create: Type.Optional(Type.Boolean({ description: "Create new branch if not exists" }))
}, { additionalProperties: false });

export async function execute(params: { branch: string; create?: boolean }, ctx: any): Promise<any> {
  const cwd = ctx.cwd || process.cwd();
  const { branch, create } = params;

  try {
    const args = ["checkout"];
    if (create) args.push("-b");
    args.push(branch);

    const result = await ctx.exec("git", args, { cwd });

    if (result.code !== 0) {
      return {
        content: [{ type: "text" as const, text: `❌ git checkout failed:\n${result.stderr}` }],
        isError: true,
        details: { error: result.stderr, exitCode: result.code }
      };
    }

    return {
      content: [{ type: "text" as const, text: result.stdout || `Switched to ${branch}` }],
      details: { branch, created: create || false },
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
