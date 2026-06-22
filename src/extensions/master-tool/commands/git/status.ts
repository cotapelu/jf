#!/usr/bin/env node

/**
 * Git Status Command
 *
 * Shows git status in structured format.
 * Category: git
 */

import { Type } from "typebox";
import { Text } from "@earendil-works/pi-tui";

export const metadata = {
  name: "git.status",
  category: "git",
  description: "Show git working tree status (staged, unstaged, untracked files)",
  longDescription: `
Shows the current git status with branch information and file changes.
The output is parsed and structured for easy consumption by AI agents.

This command is equivalent to 'git status --porcelain --branch' but formats the output.
  `.trim(),
  examples: [
    "master_tool({ command: 'git.status', args: {} })",
    "master_tool({ command: 'git.status', args: { porcelain: true } })"
  ],
  tags: ["git", "vcs", "read-only"],
  permissions: ["exec:git"]
};

export const schema = Type.Object({
  porcelain: Type.Optional(Type.Boolean({ description: "Use porcelain format (default: true)" }))
}, { additionalProperties: false });

interface GitStatusResult {
  branch: string;
  staged: string[];
  unstaged: string[];
  untracked: string[];
  totalFiles: number;
}

export async function execute(
  args: { porcelain?: boolean },
  cwd: string,
  signal?: AbortSignal,
  ctx?: any
): Promise<{ code: number; stdout: string; stderr: string; data?: GitStatusResult }> {
  try {
    // Use ctx.exec for proper signal handling and cwd
    const result = await ctx?.exec?.('git', ['status', '--porcelain', '--branch'], { cwd, signal }) 
      ?? { code: 0, stdout: "", stderr: "" };

    if (result.code !== 0) {
      return {
        code: result.code,
        stdout: result.stdout,
        stderr: result.stderr,
        data: undefined
      };
    }

    const lines = result.stdout.trim().split('\n').filter(Boolean);
    const staged: string[] = [];
    const unstaged: string[] = [];
    const untracked: string[] = [];
    let branch = '(unknown)';

    // Extract branch (lines starting with ##)
    const branchLine = lines.find((l: string) => l.startsWith('## '));
    if (branchLine) {
      branch = branchLine.slice(3).split('...')[0].trim();
    }

    // Process file entries
    for (const line of lines) {
      if (line.startsWith('##')) continue; // skip branch meta line
      const code = line.slice(0, 2);
      const file = line.slice(3);
      if (code === '??') {
        untracked.push(file);
      } else if (code.startsWith(' ')) {
        unstaged.push(`${code} ${file}`);
      } else {
        staged.push(`${code} ${file}`);
      }
    }

    const data: GitStatusResult = {
      branch,
      staged,
      unstaged,
      untracked,
      totalFiles: staged.length + unstaged.length + untracked.length
    };

    // Format human-readable output
    const output = [
      `Branch: ${branch}`,
      `Staged: ${staged.length}`,
      ...(staged.length > 0 ? staged.map(f => `  ${f}`) : []),
      `Unstaged: ${unstaged.length}`,
      ...(unstaged.length > 0 ? unstaged.map(f => `  ${f}`) : []),
      `Untracked: ${untracked.length}`,
      ...(untracked.length > 0 ? untracked.map(f => `  ${f}`) : [])
    ].filter(Boolean).join('\n');

    return {
      code: 0,
      stdout: output,
      stderr: "",
      data
    };

  } catch (error: any) {
    return {
      code: 1,
      stdout: "",
      stderr: `git status error: ${error.message}`,
      data: undefined
    };
  }
}

// Optional: Custom renderer
export function renderResult(result: any, options: any, theme: any): any {
  if (result.code !== 0) {
    return new Text(theme.fg("error", `❌ ${result.stderr}`));
  }

  const data = result.data as GitStatusResult | undefined;
  if (!data) {
    return new Text(theme.fg("text", result.stdout));
  }

  const lines: string[] = [];
  lines.push(theme.fg("accent", `📊 Git Status: ${data.branch}`));
  lines.push("");

  if (data.staged.length > 0) {
    lines.push(theme.fg("success", `Staged (${data.staged.length}):`));
    data.staged.slice(0, 5).forEach(f => lines.push(`  ${theme.fg("text", f)}`));
    if (data.staged.length > 5) lines.push(theme.fg("dim", `  ...and ${data.staged.length - 5} more`));
  }

  if (data.unstaged.length > 0) {
    lines.push(theme.fg("warning", `Unstaged (${data.unstaged.length}):`));
    data.unstaged.slice(0, 5).forEach(f => lines.push(`  ${theme.fg("text", f)}`));
    if (data.unstaged.length > 5) lines.push(theme.fg("dim", `  ...and ${data.unstaged.length - 5} more`));
  }

  if (data.untracked.length > 0) {
    lines.push(theme.fg("muted", `Untracked (${data.untracked.length}):`));
    data.untracked.slice(0, 5).forEach(f => lines.push(`  ${theme.fg("text", f)}`));
    if (data.untracked.length > 5) lines.push(theme.fg("dim", `  ...and ${data.untracked.length - 5} more`));
  }

  if (data.totalFiles === 0) {
    lines.push(theme.fg("success", "✓ Working tree clean"));
  }

  return new Text(lines.join("\n"));
}

export default { metadata, schema, execute, renderResult };
