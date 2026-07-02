#!/usr/bin/env node
/**
 * dev.scripts capability
 */

import { Type } from "typebox";

export const schema = Type.Object({
  action: Type.Union([
    Type.Literal("list"),
    Type.Literal("run")
  ], { description: "Action: list or run" }),
  script: Type.Optional(Type.String({ description: "Script name to run (required for 'run')" }))
}, { additionalProperties: false });

export async function execute(params: { action: string; script?: string }, ctx: any): Promise<any> {
  const cwd = ctx.cwd || process.cwd();

  try {
    if (params.action === "list") {
      const result = await ctx.exec("npm", ["run"], { cwd });
      return {
        content: [{ type: "text" as const, text: result.stdout || "No scripts" }],
        details: { action: "list" },
        isError: result.code !== 0
      };
    } 
      if (!params.script) {
        throw new Error("script required when action='run'");
      }
      const result = await ctx.exec("npm", ["run", params.script], { cwd });
      return {
        content: [{ type: "text" as const, text: result.stdout || result.stderr || `Ran ${params.script}` }],
        details: { action: "run", script: params.script, exitCode: result.code },
        isError: result.code !== 0
      };
    
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return { content: [{ type: "text" as const, text: `❌ Error: ${msg}` }], isError: true, details: { error: msg } };
  }
}

export default { execute, schema };
