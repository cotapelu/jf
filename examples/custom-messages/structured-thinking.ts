import type { Message, ThinkingContent } from "@mariozechner/pi-ai";

/**
 * Structured thinking with step-by-step reasoning
 */

export interface ThinkingStep {
	id: string;
	description: string;
	reasoning: string;
	confidence: number;
	inputs?: Record<string, any>;
	outputs?: Record<string, any>;
}

export interface StructuredThinkingMessage extends Message {
	type: "structured_thinking";
	content: StructuredThinkingContent[];
	steps: ThinkingStep[];
	finalConclusion?: string;
	totalTime?: number;
}

export interface StructuredThinkingContent extends ThinkingContent {
	steps?: ThinkingStep[];
}

/**
 * Create a structured thinking message with reasoning steps
 */
export function createStructuredThinking(
	steps: ThinkingStep[],
	conclusion?: string,
	totalTime?: number
): StructuredThinkingMessage {
	return {
		role: "assistant",
		type: "structured_thinking",
		content: [{
			type: "thinking",
			thinking: steps.map(s => `${s.description}: ${s.reasoning}`).join("\n"),
			steps
		}],
		steps,
		finalConclusion: conclusion,
		totalTime,
		timestamp: Date.now()
	};
}

/**
 * Type guard for structured thinking messages
 */
export function isStructuredThinking(msg: Message): msg is StructuredThinkingMessage {
	return msg.type === "structured_thinking";
}

/**
 * Calculate average confidence across thinking steps
 */
export function getAverageConfidence(steps: ThinkingStep[]): number {
	if (steps.length === 0) return 0;
	const sum = steps.reduce((acc, step) => acc + step.confidence, 0);
	return sum / steps.length;
}

/**
 * Format structured thinking for display
 */
export function formatStructuredThinking(msg: StructuredThinkingMessage): string {
	const lines: string[] = [];
	
	lines.push("Structured Analysis:");
	lines.push("=" .repeat(50));
	
	msg.steps.forEach((step, index) => {
		lines.push(`\n${index + 1}. ${step.description}`);
		lines.push(`   Confidence: ${(step.confidence * 100).toFixed(1)}%`);
		lines.push(`   ${step.reasoning}`);
		
		if (step.inputs && Object.keys(step.inputs).length > 0) {
			lines.push(`   Inputs: ${JSON.stringify(step.inputs)}`);
		}
		
		if (step.outputs && Object.keys(step.outputs).length > 0) {
			lines.push(`   Outputs: ${JSON.stringify(step.outputs)}`);
		}
	});
	
	if (msg.finalConclusion) {
		lines.push(`\nConclusion: ${msg.finalConclusion}`);
	}
	
	if (msg.totalTime !== undefined) {
		lines.push(`\nTotal time: ${msg.totalTime}ms`);
	}
	
	return lines.join("\n");
}
