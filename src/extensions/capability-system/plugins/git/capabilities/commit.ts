#!/usr/bin/env node
/**
 * git.commit capability
 */

import { Type } from "typebox";

export const schema = Type.Object({
  message: Type.String({ description: "Commit message" }),
  all: Type.Optional(Type.Boolean({ description: "Stage all changes (git commit -a)" })),
  amend: Type.Optional(Type.Boolean({ description: "Amend previous commit" }))
}, { additionalProperties: false });

export async function execute(params: { message: string; all?: boolean; amend?: boolean }, ctx: any): Promise<any> {
  const cwd = ctx.cwd || process.cwd();

  try {
    // Build command
    const args = ["commit"];
    if (params.all) args.push("-a");
    if (params.amend) args.push("--amend");
    args.push("-m", params.message);

    const result = await ctx.exec("git", args, { cwd });

    if (result.code !== 0) {
      return {
        content: [{ type: "text" as const, text: `❌ git commit failed:\n${result.stderr}` }],
        isError: true,
        details: { error: result.stderr, exitCode: result.code }
      };
    }

    return {
      content: [{ type: "text" as const, text: result.stdout || "✅ Committed" }],
      details: { message: params.message, all: params.all, amend: params.amend },
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
