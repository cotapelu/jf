/**
 * Type augmentations for Pi SDK extensions
 * Extensions use custom properties not in official types
 */

import type { AgentToolResult, ExtensionContext } from '@earendil-works/pi-coding-agent';

declare module '@earendil-works/pi-coding-agent' {
  interface AgentToolResult<T = any> {
    /** Custom flag used by extensions to mark error results */
    isError?: boolean;
  }

  interface ExtensionContext {
    /** Runtime reference used by extensions (custom addition) */
    runtime?: any;
  }
}
