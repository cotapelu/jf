#!/usr/bin/env node
/**
 * dev.build capability
 */

import { Type } from "typebox";

export const schema = Type.Object({}, { additionalProperties: false });

export async function execute(params: Record<string, never>, ctx: any): Promise<any> {
  const cwd = ctx.cwd || process.cwd();

  try {
    const result = await ctx.exec("npm", ["run", "build"], { cwd });

    return {
      content: [{ type: "text" as const, text: result.stdout || result.stderr || "Build complete" }],
      details: { exitCode: result.code },
      isError: result.code !== 0
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return { content: [{ type: "text" as const, text: `❌ Error: ${msg}` }], isError: true, details: { error: msg } };
  }
}

export default { execute, schema };
