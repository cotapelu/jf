/**
 * Shared utility for truncating text to visual lines (accounting for line wrapping).
 * Used by both tool-execution.ts and bash-execution.ts for consistent behavior.
 */

import { Text } from "@earendil-works/pi-tui";

export interface VisualTruncateResult {
	/** The visual lines to display */
	visualLines: string[];
	/** Number of visual lines that were skipped (hidden) */
	skippedCount: number;
}

function getAllVisualLines(text: string, width: number, paddingX: number): string[] {
	const tempText = new Text(text, paddingX, 0);
	return tempText.render(width);
}

function truncateLines(allLines: string[], maxVisualLines: number): { visualLines: string[]; skippedCount: number } {
	if (allLines.length <= maxVisualLines) {
		return { visualLines: allLines, skippedCount: 0 };
	}
	const truncated = allLines.slice(-maxVisualLines);
	const skipped = allLines.length - maxVisualLines;
	return { visualLines: truncated, skippedCount: skipped };
}

/**
 * Truncate text to a maximum number of visual lines (from the end).
 * This accounts for line wrapping based on terminal width.
 */
export function truncateToVisualLines(
	text: string,
	maxVisualLines: number,
	width: number,
	paddingX: number = 0,
): VisualTruncateResult {
	if (!text) {
		return { visualLines: [], skippedCount: 0 };
	}

	const allVisualLines = getAllVisualLines(text, width, paddingX);
	return truncateLines(allVisualLines, maxVisualLines);
}
