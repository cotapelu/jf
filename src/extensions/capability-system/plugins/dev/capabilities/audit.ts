#!/usr/bin/env node
/**
 * dev.audit capability
 */

import { Type } from "typebox";

export const schema = Type.Object({
  fix: Type.Optional(Type.Boolean({ description: "Attempt to fix vulnerabilities" }))
}, { additionalProperties: false });

export async function execute(params: { fix?: boolean } = {}, ctx: any): Promise<any> {
  const cwd = ctx.cwd || process.cwd();

  try {
    const args = ["audit"];
    if (params.fix) {
      args.push("--", "fix");
    }

    const result = await ctx.exec("npm", args, { cwd });

    return {
      content: [{ type: "text" as const, text: result.stdout || result.stderr || "Audit complete" }],
      details: { fix: params.fix, exitCode: result.code },
      isError: result.code !== 0
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return { content: [{ type: "text" as const, text: `❌ Error: ${msg}` }], isError: true, details: { error: msg } };
  }
}

export default { execute, schema };
