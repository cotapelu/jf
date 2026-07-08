#!/usr/bin/env node
/**
 * git.add capability
 */

import { Type } from "typebox";

export const schema = Type.Object({
  files: Type.Optional(Type.Array(Type.String(), { description: "File paths to stage" })),
  all: Type.Optional(Type.Boolean({ description: "Stage all changes (git add -A)" }))
}, {
  // Must have either files or all
  // Using conditional logic in execute
  additionalProperties: false
});

function buildGitAddArgs(params: { files?: string[]; all?: boolean }): string[] {
  if (params.all) {
    return ['add', '-A'];
  }
  if (params.files && params.files.length > 0) {
    return ['add', ...params.files];
  }
  throw new Error("Must specify either 'files' array or 'all: true'");
}

export async function execute(params: { files?: string[]; all?: boolean }, ctx: any): Promise<any> {
  const cwd = ctx.cwd || process.cwd();
  try {
    const args = buildGitAddArgs(params);
    const result = await ctx.exec('git', args, { cwd });
    if (result.code !== 0) {
      return {
        content: [{ type: 'text' as const, text: `❌ git add failed:\n${result.stderr}` }],
        isError: true,
        details: { error: result.stderr, exitCode: result.code }
      };
    }
    const target = params.all ? 'all changes' : params.files?.join(', ') || '';
    return {
      content: [{ type: 'text' as const, text: `✅ Staged ${target}` }],
      details: { files: params.files, all: params.all },
      isError: false
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text' as const, text: `❌ Error: ${msg}` }],
      isError: true,
      details: { error: msg }
    };
  }
}

export default { execute, schema };
