#!/usr/bin/env node
/**
 * security.scan capability
 */

import { Type } from "typebox";

export const schema = Type.Object({
  path: Type.Optional(Type.String({ description: "Path to scan (default: cwd)" }))
}, { additionalProperties: false });

export async function execute(params: { path?: string }, ctx: any): Promise<any> {
  const cwd = ctx.cwd || process.cwd();

  try {
    const scanPath = params.path || cwd;
    const result = await ctx.exec("npx", ["secret-scanner", "--path", scanPath], { cwd });

    return {
      content: [{ type: "text" as const, text: result.stdout || result.stderr || "Scan complete" }],
      details: { path: scanPath, exitCode: result.code },
      isError: result.code !== 0
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return { content: [{ type: "text" as const, text: `❌ Error: ${msg}` }], isError: true, details: { error: msg } };
  }
}

export default { execute, schema };
