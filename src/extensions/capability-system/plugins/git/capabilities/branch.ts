#!/usr/bin/env node
/**
 * git.branch capability
 */

import { Type } from "typebox";

export const schema = Type.Object({
  action: Type.Union([
    Type.Literal("list"),
    Type.Literal("create"),
    Type.Literal("delete")
  ], { description: "Branch action" }),
  name: Type.Optional(Type.String({ description: "Branch name (required for create/delete)" }))
}, { additionalProperties: false });

export async function execute(params: { action: string; name?: string }, ctx: any): Promise<any> {
  const cwd = ctx.cwd || process.cwd();
  const { action, name } = params;

  try {
    const args = ["branch"];
    if (action === "create") {
      if (!name) throw new Error("name required for create");
      args.push(name);
    } else if (action === "delete") {
      if (!name) throw new Error("name required for delete");
      args.push("-d", name);
    } else {
      args.push("-a"); // list all
    }

    const result = await ctx.exec("git", args, { cwd });

    if (result.code !== 0) {
      return {
        content: [{ type: "text" as const, text: `❌ git branch failed:\n${result.stderr}` }],
        isError: true,
        details: { error: result.stderr, exitCode: result.code }
      };
    }

    return {
      content: [{ type: "text" as const, text: result.stdout.trim() }],
      details: { action, branch: name },
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
