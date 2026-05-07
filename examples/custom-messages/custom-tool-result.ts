import type { Message, ToolResultContent } from "@quangtynu/pi-ai";

/**
 * Enhanced tool result with execution metadata and validation
 */

export interface CustomToolResultMessage extends Message {
	type: "custom_tool_result";
	content: CustomToolResultContent[];
	executionTime: number;
	validationErrors?: string[];
}

export interface CustomToolResultContent extends ToolResultContent {
	metadata?: {
		confidence: number;
		cached: boolean;
		sourceVersion: string;
	};
}

/**
 * Create a custom tool result message with execution metadata
 */
export function createCustomToolResult(
	toolName: string,
	result: any,
	executionTime: number,
	options: {
		confidence?: number;
		cached?: boolean;
		sourceVersion?: string;
		validationErrors?: string[];
	} = {}
): CustomToolResultMessage {
	const { confidence = 1.0, cached = false, sourceVersion = "1.0.0" } = options;
	
	return {
		role: "tool_result",
		type: "custom_tool_result",
		content: [{
			type: "tool_result",
			toolName,
			result,
			metadata: { confidence, cached, sourceVersion }
		}],
		executionTime,
		validationErrors: options.validationErrors,
		timestamp: Date.now()
	};
}

/**
 * Type guard for custom tool result messages
 */
export function isCustomToolResult(msg: Message): msg is CustomToolResultMessage {
	return msg.type === "custom_tool_result";
}

/**
 * Validate custom tool result
 */
export function validateCustomToolResult(msg: CustomToolResultMessage): string[] {
	const errors: string[] = [];
	
	if (msg.executionTime < 0) {
		errors.push("Execution time cannot be negative");
	}
	
	if (!msg.content || msg.content.length === 0) {
		errors.push("Tool result must have content");
	}
	
	if (msg.validationErrors?.length) {
		errors.push(...msg.validationErrors);
	}
	
	return errors;
}
