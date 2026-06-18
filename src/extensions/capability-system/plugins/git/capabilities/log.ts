#!/usr/bin/env node
/**
 * git.log capability
 */

import { Type } from "typebox";

export const schema = Type.Object({
  count: Type.Optional(Type.Number({ minimum: 1, maximum: 100, default: 10 }))
}, { additionalProperties: false });

export async function execute(params: { count?: number } = {}, ctx: any): Promise<any> {
  const cwd = ctx.cwd || process.cwd();
  const count = params.count || 10;

  try {
    const result = await ctx.exec("git", ["log", `-${count}`, "--oneline", "--graph", "--decorate"], { cwd });

    if (result.code !== 0) {
      return {
        content: [{ type: "text" as const, text: `❌ git log failed:\n${result.stderr}` }],
        isError: true,
        details: { error: result.stderr, exitCode: result.code }
      };
    }

    return {
      content: [{ type: "text" as const, text: result.stdout }],
      details: { count: result.stdout.split('\n').filter(Boolean).length },
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
