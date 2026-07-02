#!/usr/bin/env node

/**
 * Branch Summary Renderer
 *
 * Beautiful UI for branch_summary entries.
 * Shows branch point, summary, and branch tree structure.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";

interface BranchSummaryDetails {
  fromId: string;
  summary: string;
  details?: any;
}

/**
 * Register the branch summary renderer.
 */
export function registerBranchSummaryRenderer(api: ExtensionAPI): void {
  if (typeof api.registerMessageRenderer !== 'function') {
    return;
  }

  api.registerMessageRenderer("branch_summary", (_msg: any, options, theme) => {
    const details = _msg.details as BranchSummaryDetails | undefined;
    if (!details) {
      return new Text("🌿 Branch point");
    }

    const lines: string[] = [];

    // Header
    lines.push(theme.fg("accent", "🌿 Branch Summary").bold());

    // Summary
    if (details.summary) {
      lines.push("");
      lines.push(theme.fg("text", details.summary));
    }

    // Branch point info
    if (details.fromId) {
      lines.push(`\nFrom entry: ${theme.fg("accent", details.fromId)}`);
    }

    // Details (if any)
    if (details.details) {
      lines.push("\nAdditional context:");
      const detailStr = typeof details.details === 'string' 
        ? details.details 
        : JSON.stringify(details.details, null, 2);
      lines.push(theme.fg("dim", detailStr));
    }

    // Visual separator
    lines.push(`\n${  theme.fg("border", "─".repeat(40))}`);

    return new Text(lines.join("\n"));
  });
}
