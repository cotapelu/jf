#!/usr/bin/env node

/**
 * Custom Providers Registry
 *
 * List of custom provider identifiers to generate models for.
 * These correspond to top-level keys in models.dev/api.json.
 *
 * To add a new provider:
 * 1. Add the provider key to this array
 * 2. Run: npm run generate-custom-models
 * 3. Create provider registration file (e.g., moonshot-provider.ts)
 *
 * Example:
 *   export const CUSTOM_PROVIDERS = ["kilo", "moonshot"] as const;
 */

export const CUSTOM_PROVIDERS = [
  "kilo",
] as const;
