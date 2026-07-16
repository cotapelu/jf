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
    'master_tool({ command: "master_tool.stats", args: {} })',
    'master_tool({ command: "master_tool.stats", args: { format: "json" } })',
    'master_tool({ command: "master_tool.stats", args: { format: "prometheus" } })'
  ],
  tags: ['observability', 'metrics']
};

export const schema = {
  type: 'object',
  properties: {
    format: { type: 'string', enum: ['text', 'json', 'prometheus'], default: 'text' }
  }
};

function formatPrometheus(stats: any): string[] {
  const lines: string[] = [];
  lines.push(...formatExecutions(stats));
  lines.push(...formatErrors(stats));
  lines.push(...formatDurations(stats));
  lines.push(...formatCache(stats));
  lines.push(...formatRegistered(stats));
  return lines;
}

function formatExecutions(stats: any): string[] {
  return [
    '# HELP jf_command_executions_total Total number of command executions',
    '# TYPE jf_command_executions_total counter',
    `jf_command_executions_total ${stats.totalExecutions}`,
    ''
  ];
}

function formatErrors(stats: any): string[] {
  const lines: string[] = [];
  lines.push('# HELP jf_command_errors_total Total number of command errors');
  lines.push('# TYPE jf_command_errors_total counter');
  for (const e of stats.recentErrors) {
    const error = String(e.error).replace(/['"]/g, '').replace(/\\/g, '/');
    lines.push(`jf_command_errors_total{command="${e.command}",error="${error}"} ${e.count}`);
  }
  lines.push('');
  return lines;
}

function formatDurations(stats: any): string[] {
  const lines: string[] = [];
  lines.push('# HELP jf_command_duration_seconds_total Total duration of command executions in seconds');
  lines.push('# TYPE jf_command_duration_seconds_total counter');
  for (const cs of stats.commandStats) {
    const seconds = (cs.count * cs.avgDuration) / 1000;
    lines.push(`jf_command_duration_seconds_total{command="${cs.command}"} ${seconds.toFixed(6)}`);
  }
  lines.push('');
  return lines;
}

function formatCache(stats: any): string[] {
  return [
    '# HELP jf_command_cache_hits_total Number of cache hits',
    '# TYPE jf_command_cache_hits_total counter',
    `jf_command_cache_hits_total ${stats.cacheStats.hits}`,
    '',
    '# HELP jf_command_cache_misses_total Number of cache misses',
    '# TYPE jf_command_cache_misses_total counter',
    `jf_command_cache_misses_total ${stats.cacheStats.misses}`,
    ''
  ];
}

function formatRegistered(stats: any): string[] {
  return [
    '# HELP jf_command_registered_total Number of registered commands',
    '# TYPE jf_command_registered_total gauge',
    `jf_command_registered_total ${stats.registeredCommands}`,
    ''
  ];
}

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
    if (args.format === 'prometheus') {
      const lines = formatPrometheus(stats);
      return { code: 0, stdout: lines.join('\n'), stderr: '' };
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
