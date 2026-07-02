// ============================================================================
// 1. IMPORTS
// ============================================================================

import { defaultAssistantPrompt } from './default-assistant.prompt.js';
import { codeReviewPrompt } from './code-review.prompt.js';

// ============================================================================
// 2. PUBLIC API
// ============================================================================

/**
 * Built-in Prompt Registry
 *
 * Central registry for all built-in prompt templates.
 * Prompts are accessed by name and can be triggered through the prompt hook extension.
 *
 * @example
 * ```
 * import { getBuiltinPrompt, getAllBuiltinPrompts } from './buildin/extensions/prompts/index.js';
 * const prompt = getBuiltinPrompt('jf');
 * const all = getAllBuiltinPrompts();
 * ```
 */

// Prompt Template Registry (private)
const PROMPT_REGISTRY = new Map<string, import('@earendil-works/pi-coding-agent').PromptTemplate>();

// Register built-in prompts (module initialization)
PROMPT_REGISTRY.set(defaultAssistantPrompt.name, defaultAssistantPrompt);
PROMPT_REGISTRY.set(codeReviewPrompt.name, codeReviewPrompt);
// TODO: Register additional prompts here

/**
 * Get all registered prompts as array
 */
export function getAllBuiltinPrompts(): import('@earendil-works/pi-coding-agent').PromptTemplate[] {
  return Array.from(PROMPT_REGISTRY.values());
}

/**
 * Get prompt by name
 */
export function getBuiltinPrompt(name: string): import('@earendil-works/pi-coding-agent').PromptTemplate | undefined {
  return PROMPT_REGISTRY.get(name);
}

/**
 * Register a new built-in prompt at runtime
 * Useful for dynamic prompt loading or testing
 */
export function registerBuiltinPrompt(prompt: import('@earendil-works/pi-coding-agent').PromptTemplate): void {
  PROMPT_REGISTRY.set(prompt.name, prompt);
}

/**
 * Check if a prompt name exists in registry
 */
export function hasBuiltinPrompt(name: string): boolean {
  return PROMPT_REGISTRY.has(name);
}

// Export individual prompts for direct access if needed
export { defaultAssistantPrompt };
// export { codeReviewPrompt };
// export { testPrompt };
