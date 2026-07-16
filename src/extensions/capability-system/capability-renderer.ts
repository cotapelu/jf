#!/usr/bin/env node
/**
 * Capability Result Renderer Component
 * Renders capability execution results in the TUI.
 */

import { Container, Text, truncateToWidth } from "@earendil-works/pi-tui";

export interface RouterRendererState {
  startedAt?: number;
  endedAt?: number;
  interval?: NodeJS.Timeout;
}

const CAPABILITY_PREVIEW_LINES = 5;

function formatDuration(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

function truncateToVisualLines(text: string, maxLines: number, width: number): { visualLines: string[]; skippedCount: number } {
  const lines: string[] = [];
  let skipped = 0;
  for (const line of text.split('\n')) {
    if (lines.length >= maxLines) {
      skipped++;
      continue;
    }
    let pos = 0;
    while (pos < line.length) {
      if (lines.length >= maxLines) {
        skipped++;
        break;
      }
      lines.push(line.slice(pos, pos + width));
      pos += width;
    }
  }
  return { visualLines: lines, skippedCount: skipped };
}

function keyHint(action: string, fallback: string): string {
  return fallback;
}

export class CapabilityResultRenderComponent extends Container {
  state: {
    cachedWidth?: number;
    cachedLines?: string[];
    cachedSkipped?: number;
  } = {};
}

function updatePreviewCache(state: any, styledOutput: string, width: number): void {
  if (state.cachedLines === undefined || state.cachedWidth !== width) {
    const preview = truncateToVisualLines(styledOutput, CAPABILITY_PREVIEW_LINES, width);
    state.cachedLines = preview.visualLines;
    state.cachedSkipped = preview.skippedCount;
    state.cachedWidth = width;
  }
}

function buildSkippedHint(state: any, theme: any, width: number): string {
  const hint = theme.fg("muted", `... (${state.cachedSkipped} earlier lines,`) + ` ${keyHint("app.tools.expand", "to expand")}${theme.fg("muted", ")")}`;
  return truncateToWidth(hint, width, "...");
}

function createPreviewRenderer(styledOutput: string, state: any, theme: any): any {
  return {
    render: (width: number) => {
      updatePreviewCache(state, styledOutput, width);
      if (state.cachedSkipped > 0) {
        return ["", buildSkippedHint(state, theme, width), ...(state.cachedLines ?? [])];
      }
      return ["", ...(state.cachedLines ?? [])];
    },
    invalidate: () => {
      state.cachedWidth = undefined;
      state.cachedLines = undefined;
      state.cachedSkipped = undefined;
    }
  };
}

function renderOutput(component: CapabilityResultRenderComponent, output: string, options: any, theme: any, state: any): void {
  const styledOutput = output
    .split("\n")
    .map((line: string) => theme.fg("toolOutput", line))
    .join("\n");

  if (options.expanded) {
    component.addChild(new Text(`\n${styledOutput}`, 0, 0));
  } else {
    component.addChild(createPreviewRenderer(styledOutput, state, theme));
  }
}

export function rebuildCapabilityRenderComponent(
  component: CapabilityResultRenderComponent,
  result: any,
  options: any,
  theme: any,
  startedAt: number | undefined,
  endedAt: number | undefined,
): void {
  const state = component.state;
  component.clear();

  let output = "";
  if (result.content) {
    output = result.content
      .filter((c: any) => c.type === "text")
      .map((c: any) => c.text || "")
      .join("\n")
      .trim();
  }

  if (output) {
    renderOutput(component, output, options, theme, state);
  }

  // Timing
  if (startedAt !== undefined) {
    const label = options.isPartial ? "Elapsed" : "Took";
    const endTime = endedAt ?? Date.now();
    component.addChild(new Text(`\n${theme.fg("muted", `${label} ${formatDuration(endTime - startedAt)}`)}`, 0, 0));
  }
}
