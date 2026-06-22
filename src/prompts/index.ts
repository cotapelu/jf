/**
 * JF Prompt Templates
 *
 * Central export for all prompt templates.
 * Add new prompt templates here and they'll be available via /template_name slash command.
 */

import { defaultAssistantPrompt } from './default-assistant.prompt.js';

// Re-export all prompt templates
export { defaultAssistantPrompt };

// Re-export default as convenience
export { defaultAssistantPrompt as defaultPrompt };
