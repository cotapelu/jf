/**
 * Git Extension
 * Provides git operations as Pi SDK tools
 */

import type { ToolDefinition } from '@earendil-works/pi-coding-agent';
import { gitStatusTool } from './tools/git-status.js';
import { gitDiffTool } from './tools/git-diff.js';
import { gitCommitTool } from './tools/git-commit.js';
import { gitPushTool } from './tools/git-push.js';
import { gitPullTool } from './tools/git-pull.js';

export interface GitExtensionOptions {
  /** Default commit author (format: "Name <email>") */
  defaultAuthor?: string;
}

export class GitExtension {
  name = 'git';
  version = '1.0.0';
  description = 'Git version control operations';
  constructor(private options: GitExtensionOptions = {}) {}
  getTools(_cwd: string): ToolDefinition[] { return [gitStatusTool, gitDiffTool, gitCommitTool, gitPushTool, gitPullTool]; }
  initialize(_registry: any): void {}
  dispose(): void {}
}

