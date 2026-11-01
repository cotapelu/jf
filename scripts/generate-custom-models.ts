#!/usr/bin/env tsx

/**
 * Generate Custom Models Script
 *
 * Fetch models từ models.dev API cho các custom providers đã khai báo.
 *
 * Để thêm provider mới: thêm key vào CUSTOM_PROVIDERS trong
 * src/extensions/providers/registry.ts rồi chạy lại script này.
 *
 * Chạy: npm run generate-custom-models
 */

import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type { Model } from "@earendil-works/pi-ai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PROJECT_ROOT = join(__dirname, "..");
const OUTPUT_DIR = join(PROJECT_ROOT, "src", "extensions", "providers", "models");
const OUTPUT_FILE = join(OUTPUT_DIR, "custom-models.generated.ts");

interface ModelsDevProvider {
  id: string;
  env?: string[];
  npm?: string;
  api: string; // base URL
  name: string;
  doc?: string;
  models: Record<string, any>;
}

interface ModelsDevModel {
  id: string;
  name: string;
  tool_call?: boolean;
  reasoning?: boolean;
  limit?: { context?: number; output?: number };
  cost?: { input?: number; output?: number; cache_read?: number; cache_write?: number };
  modalities?: { input?: string[] };
}

// ============================================================================
// CUSTOM PROVIDER KEYS
// Import từ registry (được khai báo tập trung)
// ============================================================================
const { CUSTOM_PROVIDERS } = await import(
  join(PROJECT_ROOT, "src", "extensions", "providers", "registry.ts"));
const CUSTOM_PROVIDER_KEYS = CUSTOM_PROVIDERS as readonly string[];

function getApiTypeFromNpm(npm?: string): string {
  if (!npm) return "openai-completions";
  if (npm.includes("@ai-sdk/anthropic")) return "anthropic-messages";
  if (npm.includes("@ai-sdk/google")) return "google-generative-ai";
  // @ai-sdk/openai, @ai-sdk/openai-compatible, etc.
  return "openai-completions";
}

function escapeName(name: string): string {
  return name.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

async function loadModelsDevData(): Promise<Model<any>[]> {
  console.log("Fetching models from models.dev API...");
  const response = await fetch("https://models.dev/api.json");
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();

  const models: Model<any>[] = [];

  for (const key of CUSTOM_PROVIDER_KEYS) {
    const provider = data[key] as ModelsDevProvider | undefined;

    if (!provider?.models || !provider.api) {
      console.log(`  ⚠️  ${key}: Missing provider data or api field in models.dev`);
      continue;
    }

    const apiType = getApiTypeFromNpm(provider.npm) as any;
    // Only include OpenAI-compatible providers
    if (apiType !== "openai-completions") {
      console.log(`  ⏭️  ${key}: Skipping (api type: ${apiType}, not openai-completions)`);
      continue;
    }
    const baseUrl = provider.api;

    let modelCount = 0;
    for (const [modelId, model] of Object.entries(provider.models)) {
      const m = model as ModelsDevModel;
      if (m.tool_call !== true) continue;

      models.push({
        id: modelId,
        name: m.name || modelId,
        api: apiType,
        provider: key,
        baseUrl,
        reasoning: m.reasoning === true,
        input: (m.modalities?.input?.includes("image") ? ["text", "image"] : ["text"]) as ("text" | "image")[],
        cost: {
          input: m.cost?.input || 0,
          output: m.cost?.output || 0,
          cacheRead: m.cost?.cache_read || 0,
          cacheWrite: m.cost?.cache_write || 0,
        },
        contextWindow: m.limit?.context || 4096,
        maxTokens: m.limit?.output || 4096,
      });
      modelCount++;
    }

    console.log(`  ✅ ${key}: ${modelCount} model(s) (api: ${apiType}, baseUrl: ${baseUrl})`);
  }

  console.log(`\nTotal loaded: ${models.length} models`);
  return models;
}

async function generate(): Promise<void> {
  console.log("🚀 Generating custom models from models.dev...\n");

  try {
    const allModels = await loadModelsDevData();

    // Group by provider
    const providers: Record<string, Record<string, Model<any>>> = {};
    for (const model of allModels) {
      if (!providers[model.provider]) {
        providers[model.provider] = {};
      }
      providers[model.provider][model.id] = model;
    }

    // Generate file content - EXACTLY like pi-ai
    const lines: string[] = [
      "// THIS FILE IS AUTO-GENERATED",
      "// Source: https://models.dev/api.json",
      `// Generated: ${new Date().toISOString()}`,
      "// DO NOT EDIT MANUALLY - Run 'npm run generate-custom-models' to update",
      "",
      "import type { Model } from \"@earendil-works/pi-ai\";",
      "",
      "export const CUSTOM_MODELS = {",
    ];

    const sortedProviderNames = Object.keys(providers).sort();
    for (const providerName of sortedProviderNames) {
      const providerModels = providers[providerName];
      lines.push(`  "${providerName}": {`);

      const sortedModelIds = Object.keys(providerModels).sort();
      for (const modelId of sortedModelIds) {
        const model = providerModels[modelId];
        const inputArray = model.input.includes("image") ? '["text", "image"]' : '["text"]';

        lines.push(`    "${modelId}": {`);
        lines.push(`      id: "${escapeName(model.id)}",`);
        lines.push(`      name: "${escapeName(model.name)}",`);
        lines.push(`      api: "${model.api}",`);
        lines.push(`      provider: "${model.provider}",`);
        lines.push(`      baseUrl: "${model.baseUrl}",`);
        lines.push(`      reasoning: ${model.reasoning},`);
        lines.push(`      input: ${inputArray},`);
        lines.push(`      cost: {`);
        lines.push(`        input: ${model.cost.input},`);
        lines.push(`        output: ${model.cost.output},`);
        lines.push(`        cacheRead: ${model.cost.cacheRead},`);
        lines.push(`        cacheWrite: ${model.cost.cacheWrite},`);
        lines.push(`      },`);
        lines.push(`      contextWindow: ${model.contextWindow},`);
        lines.push(`      maxTokens: ${model.maxTokens},`);
        lines.push(`    } satisfies Model<"${model.api}">,`);
      }

      lines.push(`  },`);
    }

    lines.push(`} as const;`);

    mkdirSync(OUTPUT_DIR, { recursive: true });
    writeFileSync(OUTPUT_FILE, lines.join("\n"), "utf-8");
    console.log(`\n✅ Generated: ${OUTPUT_FILE}\n`);
  } catch (error) {
    console.error("❌ Generation failed:", error);
    if (error instanceof Error) console.error(`   Error: ${error.message}`);
    process.exit(1);
  }
}

generate();
