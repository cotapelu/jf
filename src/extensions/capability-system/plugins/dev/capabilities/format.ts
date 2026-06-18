#!/usr/bin/env node
/**
 * dev.format capability
 */

import { Type } from "typebox";

export const schema = Type.Object({
  files: Type.Array(Type.String(), { description: "File paths to format (required)" })
}, { additionalProperties: false });

export async function execute(params: { files: string[] }, ctx: any): Promise<any> {
  const cwd = ctx.cwd || process.cwd();

  try {
    if (!params.files?.length) {
      throw new Error("files array required");
    }

    const files = params.files.map(f => `"${f}"`).join(' ');
    const result = await ctx.exec("npx", ["prettier", "--write", ...params.files], { cwd });

    return {
      content: [{ type: "text" as const, text: result.stdout || result.stderr || "✅ Formatted" }],
      details: { files: params.files },
      isError: result.code !== 0
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return { content: [{ type: "text" as const, text: `❌ Error: ${msg}` }], isError: true, details: { error: msg } };
  }
}

export default { execute, schema };
