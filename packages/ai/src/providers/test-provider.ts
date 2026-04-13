import type { ProviderOptions } from "../types.ts";

/**
 * Test provider that simulates various error conditions for chaos engineering
 */
export class TestProvider {
	constructor(private options: ProviderOptions = {}) {}

	async *stream(_prompt: string, _options: { signal?: AbortSignal } = {}): AsyncIterable<string> {
		if (this.options.failStream) {
			throw new Error(this.options.failStream);
		}
		// Simulate streaming response
		yield "Hello";
		yield " ";
		yield "World";
		yield "!";
	}

	async complete(_prompt: string, _options: { signal?: AbortSignal } = {}): Promise<string> {
		if (this.options.failComplete) {
			throw new Error(this.options.failComplete);
		}
		return "Hello World!";
	}

	async *_streamWithThoughts(
		_prompt: string,
		_options: { signal?: AbortSignal; onThink?: (thought: string) => void } = {},
	): AsyncIterable<{ type: "text" | "think"; content: string }> {
		if (this.options.failStreamWithThoughts) {
			throw new Error(this.options.failStreamWithThoughts);
		}
		yield { type: "text", content: "Hello World!" };
	}

	get supportsTools(): boolean {
		return true;
	}
}

// Export a provider that simulates timeout
export const timeoutTestProvider = new TestProvider({
	failComplete: "Provider timeout",
	failStream: "Provider timeout",
	failStreamWithThoughts: "Provider timeout",
});

// Export a provider that works normally
export const testProvider = new TestProvider();
