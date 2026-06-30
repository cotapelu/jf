/**
 * Base Extension class - provides default no-op implementations
 * Extensions can extend this instead of implementing Extension interface from scratch
 */
import type { ToolDefinition } from '@earendil-works/pi-coding-agent';
import { Extension, ExtensionRegistry } from './registry.js';

export abstract class BaseExtension implements Extension {
  abstract name: string;
  abstract version: string;
  description?: string;

  abstract getTools(cwd: string): ToolDefinition[];

  initialize?(_registry: ExtensionRegistry): Promise<void> | void {}
  dispose?(): Promise<void> | void {}
}
