#!/usr/bin/env node
/**
 * system.metrics capability
 */

import { Type } from "typebox";

export const schema = Type.Object({}, { additionalProperties: false });

export async function execute(params: Record<string, never>, ctx: any): Promise<any> {
  try {
    const result = await ctx.exec("node", ["-e", "console.log(JSON.stringify(require('@earendil-works/pi-coding-agent/metrics')()))"], { cwd: ctx.cwd || process.cwd() });

    let data;
    try {
      data = JSON.parse(result.stdout);
    } catch {
      data = { raw: result.stdout };
    }

    return {
      content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      details: data,
      isError: result.code !== 0
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return { content: [{ type: "text" as const, text: `❌ Error: ${msg}` }], isError: true, details: { error: msg } };
  }
}

export default { execute, schema };
