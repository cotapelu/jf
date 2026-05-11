import { describe, expect, it } from "vitest";
import {
	DEFAULT_PRICING,
	formatCost,
	getSessionTokenTracker,
	resetSessionTokenTracker,
	TokenTracker,
} from "../src/utils/token-tracker.js";

describe("token tracking", () => {
	it("TokenTracker tracks usage correctly", () => {
		const tracker = new TokenTracker();
		tracker.addUsage(100, 200);
		tracker.addUsage(50, 100);

		const usage = tracker.getUsage();
		expect(usage.promptTokens).toBe(150);
		expect(usage.completionTokens).toBe(300);
		expect(usage.totalTokens).toBe(450);
	});

	it("TokenTracker resets correctly", () => {
		const tracker = new TokenTracker();
		tracker.addUsage(100, 200);
		tracker.reset();

		const usage = tracker.getUsage();
		expect(usage.promptTokens).toBe(0);
		expect(usage.completionTokens).toBe(0);
		expect(usage.totalTokens).toBe(0);
	});

	it("calculateCost returns correct estimates", () => {
		const tracker = new TokenTracker();
		tracker.addUsage(1000, 1000);

		const cost = tracker.calculateCost("gpt-4");
		expect(cost.promptTokens).toBe(1000);
		expect(cost.completionTokens).toBe(1000);
		expect(cost.totalTokens).toBe(2000);
		// GPT-4: 0.03/1k prompt + 0.06/1k completion = $0.09
		expect(cost.estimatedCost).toBeCloseTo(0.09, 5);
	});

	it("calculateCost uses custom pricing when provided", () => {
		const tracker = new TokenTracker();
		tracker.addUsage(1000, 1000);

		const cost = tracker.calculateCost("custom", { promptCostPer1k: 0.01, completionCostPer1k: 0.02 });
		expect(cost.estimatedCost).toBeCloseTo(0.03, 5);
	});

	it("calculateCost returns 0 for unknown model", () => {
		const tracker = new TokenTracker();
		tracker.addUsage(1000, 1000);

		const cost = tracker.calculateCost("unknown-model");
		expect(cost.estimatedCost).toBe(0);
	});

	it("getSessionTokenTracker returns singleton", () => {
		resetSessionTokenTracker();
		const t1 = getSessionTokenTracker();
		const t2 = getSessionTokenTracker();
		expect(t1).toBe(t2);
	});

	it("formatCost formats small amounts correctly", () => {
		expect(formatCost(0.001)).toBe("$0.001");
		expect(formatCost(0.005)).toBe("$0.005");
	});

	it("formatCost formats larger amounts correctly", () => {
		expect(formatCost(0.5)).toBe("$0.50");
		expect(formatCost(1.234)).toBe("$1.23");
	});

	it("DEFAULT_PRICING has expected models", () => {
		expect(DEFAULT_PRICING["gpt-4"]).toBeDefined();
		expect(DEFAULT_PRICING["claude-3-5-sonnet"]).toBeDefined();
		expect(DEFAULT_PRICING["gemini-1.5-pro"]).toBeDefined();
	});
});
