#!/usr/bin/env node
/**
 * dev.test capability
 */

import { Type } from "typebox";

export const schema = Type.Object({
  files: Type.Optional(Type.Array(Type.String(), { description: "Test file paths" })),
  watch: Type.Optional(Type.Boolean({ description: "Watch mode" }))
}, { additionalProperties: false });

export async function execute(params: { files?: string[]; watch?: boolean } = {}, ctx: any): Promise<any> {
  const cwd = ctx.cwd || process.cwd();

  try {
    let cmd = "npm test";
    if (params.files?.length) {
      const files = params.files.map(f => `"${f}"`).join(' ');
      cmd += ` -- ${files}`;
    }
    if (params.watch) {
      cmd += " -- --watch";
    }

    const result = await ctx.exec("bash", ["-c", cmd], { cwd });

    return {
      content: [{ type: "text" as const, text: result.stdout || (result.stderr || "No output") }],
      details: { files: params.files, watch: params.watch, exitCode: result.code },
      isError: result.code !== 0
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return { content: [{ type: "text" as const, text: `❌ Error: ${msg}` }], isError: true, details: { error: msg } };
  }
}

export default { execute, schema };
