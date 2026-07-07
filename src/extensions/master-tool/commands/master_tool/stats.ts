#!/usr/bin/env node
/**
 * master_tool.stats command
 *
 * Returns executor statistics: registered commands, total executions, success rate,
 * command-specific count and average duration, recent errors, cache stats.
 */

import type { CommandMetadata, CommandResult } from '../../types/command-module.js';
import { getRegistry } from '../../master-tool.js';

export const metadata: CommandMetadata = {
  name: 'master_tool.stats',
  category: 'master',
  description: 'Show CommandExecutor statistics (executions, success rate, command latency)',
  examples: [
    'master_tool({ command: "master_tool.stats", args: {} })'
  ],
  tags: ['observability', 'metrics']
};

export const schema = {
  type: 'object',
  properties: {
    format: { type: 'string', enum: ['text', 'json'], default: 'text' }
  }
};

export async function execute(args: any, _cwd: string, _signal: any, _ctx: any): Promise<CommandResult> {
  try {
    const registry = getRegistry();
    if (!registry) {
      return {
        code: 1,
        stdout: '',
        stderr: 'Command registry not initialized',
        data: { error: 'registry_unavailable' }
      };
    }
    const stats = registry.getStats();
    if (args.format === 'json') {
      return { code: 0, stdout: JSON.stringify(stats, null, 2), stderr: '' };
    }
    const lines = [
      '📊 CommandExecutor Statistics',
      '',
      `Registered commands: ${stats.registeredCommands}`,
      `Total executions: ${stats.totalExecutions}`,
      `Success rate: ${stats.successRate}%`,
      '',
      'Command Stats (count, avg ms):',
      ...stats.commandStats.map((cs: any) => 
        `  ${cs.command}: ${cs.count} execs, avg ${cs.avgDuration.toFixed(2)}ms`
      ),
      '',
      `Cache: ${stats.cacheStats.size} entries, ${stats.cacheStats.hits} hits, ${stats.cacheStats.misses} misses`,
      '',
      'Recent Errors (top 10):',
      ...(stats.recentErrors.length > 0 
        ? stats.recentErrors.map((e: any) => `  ${e.command}: ${e.count} errors – ${e.error}`) 
        : ['  (none)'])
    ];
    const output = lines.join('\n');
    return { code: 0, stdout: output, stderr: '' };
  } catch (err: any) {
    return {
      code: 1,
      stdout: '',
      stderr: `Error retrieving stats: ${err.message}`,
      data: { error: 'stats_failed' }
    };
  }
}

export default { execute, schema, metadata };
