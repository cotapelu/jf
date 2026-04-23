import type { Message, Model } from "@quangtynu/pi-ai";
import { bench, describe } from "vitest";
import { agentLoop } from "../../src/agent-loop.js";
import type { AgentContext, AgentLoopConfig, AgentMessage } from "../../src/types.js";

// Simple faux provider that returns quickly
const createMockConfig = (): AgentLoopConfig => ({
	model: {
		id: "mock-model",
		name: "Mock Model",
		api: "openai-completions" as const,
		provider: "openai" as const,
		baseUrl: "https://api.openai.com/v1",
		reasoning: false,
		input: ["text"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 8192,
		maxTokens: 4096,
	} as Model<any>,
	convertToLlm: (msgs): Message[] => msgs as unknown as Message[],
});

const createUserMessage = (text: string): AgentMessage => ({
	role: "user",
	content: [{ type: "text", text }],
	timestamp: Date.now(),
});

describe("agentLoop benchmarks", () => {
	bench("single turn with 1 message", async () => {
		const context: AgentContext = {
			systemPrompt: "You are helpful.",
			messages: [createUserMessage("Hello")],
			tools: [],
		};
		const config = createMockConfig();
		const stream = agentLoop([createUserMessage("Hello")], context, config);
		await stream;
	});

	bench("single turn with 10 messages", async () => {
		const messages: AgentMessage[] = [];
		for (let i = 0; i < 10; i++) {
			messages.push(createUserMessage(`Message ${i}`));
		}
		const context: AgentContext = {
			systemPrompt: "You are helpful.",
			messages: [...messages],
			tools: [],
		};
		const config = createMockConfig();
		const stream = agentLoop(messages, context, config);
		await stream;
	});
});
