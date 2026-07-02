#!/usr/bin/env node

/**
 * Kilo Provider Registration
 *
 * Registers Kilo Gateway as an API key provider.
 * Users can authenticate via /login → "Use an API key" → kilo.
 *
 * Environment variable: KILO_API_KEY
 * API endpoint: https://api.kilo.ai/v1
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { ProviderConfig } from "@earendil-works/pi-coding-agent";
import { KILO_MODELS_ALL } from "./models/index.js";

export function registerKiloProvider(api: ExtensionAPI): void {
  // Lấy baseUrl từ generated models nếu có, nếu không dùng fallback
  const baseUrl = KILO_MODELS_ALL[0]?.baseUrl || "https://api.kilo.ai/api/gateway";

  const config: ProviderConfig = {
    baseUrl,
    apiKey: "$KILO_API_KEY",
    api: "openai-completions",
    models: KILO_MODELS_ALL,
  };

  api.registerProvider("kilo", config);
}
