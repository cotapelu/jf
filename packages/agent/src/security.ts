/**
 * Security utilities for the agent - sanitization, validation, and injection prevention.
 */

import type { ImageContent, TextContent } from "@quangtynu/pi-ai";

/**
 * Patterns that could be used for prompt injection attacks in tool outputs.
 * These patterns attempt to override or inject instructions into the LLM context.
 */
const INJECTION_PATTERNS = [
	/ignore all (previous|prior|above) instructions/gi,
	/ignore all (previous|prior|above) (prompts?|directives?|commands?)/gi,
	/from now on/gi,
	/you are now/gi,
	/you're now/gi,
	/new instructions?/gi,
	/system:/gi,
	/<\|system\|>/gi,
	/<\|user\|>/gi,
	/\[system/gi,
	/\[user/gi,
	/forget (your|the) instructions?/gi,
	/disregard (previous|prior|all) instructions?/gi,
	/override (previous|prior|all) instructions?/gi,
	/output:/gi,
	/response:/gi,
];

/**
 * Sanitizes tool output to prevent prompt injection attacks.
 *
 * This function removes or neutralizes patterns in tool results that could
 * be interpreted as instructions to the LLM. It's critical for security because
 * tool outputs become part of the conversation context sent back to the model.
 *
 * @param text - The text content to sanitize
 * @returns Sanitized text with potential injection patterns neutralized
 */
export function sanitizeToolOutput(text: string): string {
	let sanitized = text;

	for (const pattern of INJECTION_PATTERNS) {
		sanitized = sanitized.replace(pattern, (match) => {
			return `[INJECTION BLOCKED: ${match}]`;
		});
	}

	return sanitized;
}

/**
 * Sanitizes the content array of a tool result.
 * Each text content item is sanitized individually.
 *
 * @param content - Array of text/image content from tool result
 * @returns Sanitized content array
 */
export function sanitizeToolResultContent(
	content: (TextContent | ImageContent)[],
): (TextContent | ImageContent)[] {
	return content.map((item) => {
		if (item.type === "text" && item.text.length > 10) {
			return {
				...item,
				text: sanitizeToolOutput(item.text),
			};
		}
		return item;
	});
}

/**
 * Represents the level of risk detected in content.
 */
export interface InjectionRisk {
	/** Whether any injection patterns were detected */
	risky: boolean;
	/** List of detected patterns */
	patterns: string[];
}

/**
 * Scans text for potential injection patterns without modifying it.
 * Useful for logging and monitoring suspicious activity.
 *
 * @param text - The text to scan
 * @returns InjectionRisk object with detection results
 */
export function detectInjectionPatterns(text: string): InjectionRisk {
	const detectedPatterns: string[] = [];

	for (const pattern of INJECTION_PATTERNS) {
		const matches = text.match(pattern);
		if (matches) {
			detectedPatterns.push(...matches);
		}
	}

	return {
		risky: detectedPatterns.length > 0,
		patterns: [...new Set(detectedPatterns)], // Deduplicate
	};
}

/**
 * Configuration for sanitization behavior.
 */
export interface SanitizationConfig {
	/** Enable sanitization (default: true) */
	enabled?: boolean;
	/** Log when injection patterns are detected */
	logDetections?: boolean;
}

/**
 * Sanitizes tool output with configurable behavior.
 *
 * @param text - The text content to sanitize
 * @param config - Sanitization configuration
 * @returns Sanitized text
 */
export function sanitizeToolOutputWithConfig(
	text: string,
	config: SanitizationConfig = {},
): string {
	const { enabled = true, logDetections = false } = config;

	if (!enabled) {
		return text;
	}

	// Detect patterns for logging (before sanitization modifies the text)
	if (logDetections) {
		const risk = detectInjectionPatterns(text);
		if (risk.risky) {
			console.warn(`[Security] Detected potential prompt injection in tool output:`, {
				patterns: risk.patterns,
				preview: text.substring(0, 100),
			});
		}
	}

	return sanitizeToolOutput(text);
}
