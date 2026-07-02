/**
 * Piclaw - AI Coding Agent System
 * Main entry point for library usage
 */

import extensionsAggregator from './extensions/index.js';

// Export extensions aggregator and factory function
export { default as extensionsAggregator, getExtensionFactories } from './extensions/index.js';

// Version info
export const VERSION = '0.0.1';

/**
 * ĐĂNG KÝ TẤT CẢ PLUGIN (extensions only)
 *
 * @returns { extensions: ExtensionFactory[] }
 *
 * USAGE:
 * const { extensions } = registerAllPlugin();
 */
export function registerAllPlugin() {
  return {
    extensions: [extensionsAggregator],
  };
}

// Default export
export default registerAllPlugin;
