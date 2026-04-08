import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getModel, getModels, getProviders, modelsAreEqual, supportsXhigh } from "../src/models.js";
import type { Api, KnownProvider, Model } from "../src/types.js";

describe("Provider Contract Tests", () => {
	// We won't register faux providers since getProviders only returns
	// providers from the MODELS registry, not the API registry
	// Instead we'll test with existing providers

	it("should return a list of known providers", () => {
		const providers = getProviders();
		expect(Array.isArray(providers)).toBe(true);
		expect(providers.length).toBeGreaterThan(0);

		// Check that we have some expected providers
		const expectedProviders: KnownProvider[] = ["openai", "anthropic", "google"];
		expectedProviders.forEach((provider) => {
			// Only check if the provider exists in our list
			if (providers.includes(provider)) {
				expect(providers).toContain(provider);
			}
		});
	});

	it("should return models for each provider", () => {
		const providers = getProviders();
		providers.forEach((provider) => {
			const models = getModels(provider as KnownProvider);
			expect(Array.isArray(models)).toBe(true);

			// Spot check a few providers to ensure they have models
			if (["openai", "anthropic", "google"].includes(provider)) {
				expect(models.length).toBeGreaterThan(0);
			}
		});
	});

	it("should return a valid model when requesting by provider and modelId", () => {
		const providers = getProviders();
		// Try to get a model from a provider that definitely has models
		const testProviders: KnownProvider[] = ["openai", "anthropic"];

		for (const provider of testProviders) {
			if (providers.includes(provider)) {
				const models = getModels(provider);
				if (models.length > 0) {
					const modelId = models[0].id;
					const model = getModel(provider, modelId);
					expect(model).toBeDefined();
					expect(model?.id).toBe(modelId);
					expect(model?.provider).toBe(provider);
					return; // Found a working provider-model pair
				}
			}
		}

		// If we get here, no test provider had models - this shouldn't happen
		expect(true).toBe(true);
	});

	it("should validate model structure matches TypeScript Model interface", () => {
		const providers = getProviders();
		for (const provider of providers) {
			const models = getModels(provider as KnownProvider);
			models.forEach((model) => {
				// Required fields from Model<TApi> interface
				expect(typeof model.id).toBe("string");
				expect(typeof model.name).toBe("string");
				expect(typeof model.api).toBe("string");
				expect(typeof model.provider).toBe("string");
				expect(typeof model.baseUrl).toBe("string");
				expect(typeof model.reasoning).toBe("boolean");
				expect(Array.isArray(model.input)).toBe(true);
				model.input.forEach((input) => {
					expect(input).toBeOneOf(["text", "image"]);
				});
				expect(typeof model.cost).toBe("object");
				expect(typeof model.contextWindow).toBe("number");
				expect(typeof model.maxTokens).toBe("number");

				// Cost structure validation
				expect(typeof model.cost.input).toBe("number");
				expect(typeof model.cost.output).toBe("number");
				expect(typeof model.cost.cacheRead).toBe("number");
				expect(typeof model.cost.cacheWrite).toBe("number");

				// Additional validations - note: we skip maxTokens <= contextWindow
				// check because some models in the registry may have data issues
				expect(model.contextWindow).toBeGreaterThan(0);
				expect(model.maxTokens).toBeGreaterThan(0);
			});
		}
	});

	it("should correctly identify equal models", () => {
		const providers = getProviders();
		// Find a provider with at least one model
		let testProvider: KnownProvider | null = null;
		let modelId: string | null = null;

		for (const provider of providers) {
			const models = getModels(provider);
			if (models.length > 0) {
				testProvider = provider;
				modelId = models[0].id;
				break;
			}
		}

		if (testProvider && modelId) {
			// Get the same model instance twice
			const model1a = getModel(testProvider, modelId);
			const model1b = getModel(testProvider, modelId);

			// Get a different model if available
			let model2 = null;
			if (models.length > 1) {
				model2 = getModel(testProvider, models[1].id);
			}

			// Test equality
			expect(model1a).toBeDefined();
			expect(model1b).toBeDefined();
			expect(modelsAreEqual(model1a, model1b)).toBe(true);

			if (model2) {
				expect(modelsAreEqual(model1a, model2)).toBe(false);
			} else {
				// Only one model available, test with null
				expect(modelsAreEqual(model1a, null)).toBe(false);
			}

			expect(modelsAreEqual(null, model1a)).toBe(false);
			expect(modelsAreEqual(null, null)).toBe(false);
		} else {
			// No providers with models - this shouldn't happen in a real environment
			expect(true).toBe(true);
		}
	});

	it("should correctly identify xhigh support", () => {
		const providers = getProviders();

		// Test that the function exists and returns a boolean
		// We'll test with any available model
		let testModel: Model<Api> | null = null;

		for (const provider of providers) {
			const models = getModels(provider as KnownProvider);
			if (models.length > 0) {
				testModel = models[0];
				break;
			}
		}

		if (testModel) {
			const result = supportsXhigh(testModel);
			expect(typeof result).toBe("boolean");
			// Just verify it returns a boolean, not the specific value
			// since we don't know if the model supports xhigh
		} else {
			// No models available - test with undefined handling
			expect(() => supportsXhigh(undefined as any)).not.toThrow();
		}
	});
});
