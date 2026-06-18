import type { ProviderModelConfig } from "@earendil-works/pi-coding-agent";

/**
 * Kilo Provider Models
 *
 * Source: https://models.dev/api.json (kilo provider)
 * API: https://api.kilo.ai/v1
 */

export const KILO_MODELS: ProviderModelConfig[] = [
  {
    id: "qwen/qwen3.5-397b-a17b",
    name: "Qwen3.5 397B (Kilo)",
    reasoning: true,
    input: ["text", "image"] as const,
    cost: { input: 0.39, output: 2.34, cacheRead: 0.1, cacheWrite: 0 },
    contextWindow: 262144,
    maxTokens: 65536,
  },
  {
    id: "stepfun/step-3.5-flash",
    name: "Step 3.5 Flash (Kilo)",
    reasoning: true,
    input: ["text"] as const,
    cost: { input: 0.1, output: 0.3, cacheRead: 0.02, cacheWrite: 0 },
    contextWindow: 256000,
    maxTokens: 256000,
  },
  {
    id: "x-ai/grok-4",
    name: "Grok 4 (Kilo)",
    reasoning: true,
    input: ["text", "image"] as const,
    cost: { input: 3, output: 15, cacheRead: 0.75, cacheWrite: 0 },
    contextWindow: 256000,
    maxTokens: 51200,
  },
];
