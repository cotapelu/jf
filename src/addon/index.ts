// ============================================
// ADD-ON REGISTRY - SINGLE FUNCTION
// ============================================
// Copy entire folder src/addon/ to reuse

import extensionsAggregator from './extensions/index.js';
import { registerAllBuiltinAndCustomTools } from './tools/index.js';

/**
 * ĐĂNG KÝ TẤT CẢ ADD-ON (extensions + tools)
 *
 * @param cwd - Current working directory
 * @returns { extensions: ExtensionFactory[], tools: ToolDefinition[] }
 *
 * USAGE:
 * const { extensions, tools } = registerAllAddon(cwd);
 */
export function registerAllAddon(cwd: string) {
  return {
    extensions: [extensionsAggregator],
    tools: registerAllBuiltinAndCustomTools(cwd),
  };
}

// Default export
export default registerAllAddon;


