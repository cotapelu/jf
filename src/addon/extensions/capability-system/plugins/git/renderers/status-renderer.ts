#!/usr/bin/env node
/**
 * Git Status Renderer
 */

import { Text } from "@earendil-works/pi-tui";

export function renderResult(result: any, options: any, theme: any) {
  if (result.isError) {
    return new Text(theme.fg("error", result.details?.error || "Unknown error"), 0, 0);
  }

  const { branch, staged = [], unstaged = [], untracked = [] } = result.details || {};

  const lines = [
    theme.fg("accent", "📋 Git Status").bold(),
    "",
    `Branch: ${theme.fg("muted", branch || "unknown")}`,
    `Staged: ${theme.fg(staged.length > 0 ? "success" : "text", `${staged.length}`)}`,
    ...(staged.length > 0 ? staged.map((f: string) => `  ${theme.fg("success", "✓")} ${f}`) : []),
    `Unstaged: ${theme.fg(unstaged.length > 0 ? "warning" : "text", `${unstaged.length}`)}`,
    ...(unstaged.length > 0 ? unstaged.map((f: string) => `  ${theme.fg("warning", "✗")} ${f}`) : []),
    `Untracked: ${theme.fg(untracked.length > 0 ? "dim" : "text", `${untracked.length}`)}`,
    ...(untracked.length > 0 ? untracked.map((f: string) => `  ${theme.fg("dim", "?")} ${f}`) : [])
  ].filter(Boolean);

  return new Text(lines.join('\n'), 0, 0);
}

export default { renderResult };
