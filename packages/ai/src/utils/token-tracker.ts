/**
 * Token usage and cost tracking utility
 * Provides per-session tracking of LLM token consumption and costs
 */

export interface TokenUsage {
	promptTokens: number;
	completionTokens: number;
	totalTokens: number;
}

export interface ModelPricing {
	/** Cost per 1000 prompt tokens in USD */
	promptCostPer1k: number;
	/** Cost per 1000 completion tokens in USD */
	completionCostPer1k: number;
}

/**
 * Default pricing for common models (USD per 1000 tokens)
 */
export const DEFAULT_PRICING: Record<string, ModelPricing> = {
	// OpenAI
	"gpt-4": { promptCostPer1k: 0.03, completionCostPer1k: 0.06 },
	"gpt-4-turbo": { promptCostPer1k: 0.01, completionCostPer1k: 0.03 },
	"gpt-4o": { promptCostPer1k: 0.005, completionCostPer1k: 0.015 },
	"gpt-4o-mini": { promptCostPer1k: 0.00015, completionCostPer1k: 0.0006 },
	"gpt-3.5-turbo": { promptCostPer1k: 0.0005, completionCostPer1k: 0.0015 },
	// Anthropic
	"claude-3-5-sonnet": { promptCostPer1k: 0.003, completionCostPer1k: 0.015 },
	"claude-3-7-sonnet": { promptCostPer1k: 0.003, completionCostPer1k: 0.015 },
	"claude-3-opus": { promptCostPer1k: 0.015, completionCostPer1k: 0.075 },
	// Google
	"gemini-1.5-pro": { promptCostPer1k: 0.00125, completionCostPer1k: 0.005 },
	"gemini-1.5-flash": { promptCostPer1k: 0.000075, completionCostPer1k: 0.0003 },
};

export interface TokenUsageSummary {
	promptTokens: number;
	completionTokens: number;
	totalTokens: number;
	estimatedCost: number;
}

export class TokenTracker {
	private usage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

	addUsage(promptTokens: number, completionTokens: number): void {
		this.usage.promptTokens += promptTokens;
		this.usage.completionTokens += completionTokens;
		this.usage.totalTokens += promptTokens + completionTokens;
	}

	getUsage(): TokenUsage {
		return { ...this.usage };
	}

	reset(): void {
		this.usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
	}

	calculateCost(model: string, customPricing?: ModelPricing): TokenUsageSummary {
		const pricing = customPricing ?? DEFAULT_PRICING[model] ?? { promptCostPer1k: 0, completionCostPer1k: 0 };
		const estimatedCost = 
			(this.usage.promptTokens / 1000) * pricing.promptCostPer1k +
			(this.usage.completionTokens / 1000) * pricing.completionCostPer1k;

		return {
			...this.usage,
			estimatedCost,
		};
	}
}

// Singleton for session-level tracking
let sessionTracker: TokenTracker | null = null;

export function getSessionTokenTracker(): TokenTracker {
	if (!sessionTracker) {
		sessionTracker = new TokenTracker();
	}
	return sessionTracker;
}

export function resetSessionTokenTracker(): void {
	if (sessionTracker) {
		sessionTracker.reset();
	}
}

/**
 * Format cost for display
 */
export function formatCost(cost: number): string {
	if (cost < 0.01) {
		return `$${Math.round(cost * 1000) / 1000}`;
	}
	return `$${cost.toFixed(2)}`;
}