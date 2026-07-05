// ============================================================================
// 1. IMPORTS
// ============================================================================

import type { ExtensionAPI, ExtensionContext } from '@earendil-works/pi-coding-agent';
import { createLogger } from '../utils/logger.js';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { getBuiltinPrompt, getAllBuiltinPrompts } from './prompts/index.js';

const logger = createLogger('PromptHook');

// ============================================================================
// 2. PUBLIC API
// ============================================================================

/**
 * Main extension factory
 */
export default function(pi: ExtensionAPI) {
  logger.log('Extension loaded');

  // Command: /goal - reads GOAL.md from project root
  pi.registerCommand('goal', {
    description: 'Send GOAL.md content to the conversation',
    handler: async (_argsString: string, ctx: ExtensionContext) => {
      const goalPath = join(ctx.cwd, 'GOAL.md');
      try {
        const content = await readFile(goalPath, 'utf-8');
        pi.sendUserMessage(content);
      } catch (err) {
        if (err instanceof Error) {
          const nodeErr = err as NodeJS.ErrnoException;
          if (nodeErr.code === 'ENOENT') {
            ctx.ui.notify('GOAL.md not found in project root.', 'error');
          } else {
            ctx.ui.notify(`Error reading GOAL.md: ${err.message}`, 'error');
          }
        } else {
          ctx.ui.notify(`Unexpected error: ${String(err)}`, 'error');
        }
      }
    },
  });

  // Command: /prompt - execute built-in prompts with argument substitution
  const prompts = getAllBuiltinPrompts();

  pi.registerCommand('prompt', {
    description: `Built-in prompts: ${prompts.map(p => p.name).join(', ')}. Usage: /prompt <prompt-name> [args...]`,
    getArgumentCompletions: (prefix: string) => {
      return prompts
        .filter(p => p.name.startsWith(prefix))
        .map(p => ({
          label: p.name,
          value: p.name,
          description: p.description,
        }));
    },
    handler: async (_argsString: string, ctx: ExtensionContext) => {
      const args = parseCommandArgs(_argsString);
      if (args.length === 0) {
        const names = prompts.map(p => p.name).join(', ');
        ctx.ui.notify(`Usage: /prompt <prompt-name> [args...]\nAvailable prompts: ${names}`, 'warning');
        return;
      }
      const promptName = args[0];
      const promptArgs = args.slice(1);
      const prompt = getBuiltinPrompt(promptName);
      if (!prompt) {
        const names = prompts.map(p => p.name).join(', ');
        ctx.ui.notify(`Prompt "${promptName}" not found. Available: ${names}`, 'error');
        return;
      }
      try {
        const content = substitutePromptArgs(prompt.content, promptArgs);
        pi.sendUserMessage(content);
      } catch (err) {
        if (err instanceof Error) {
          ctx.ui.notify(`Error: ${err.message}`, 'error');
        } else {
          ctx.ui.notify(`Unexpected error: ${String(err)}`, 'error');
        }
      }
    },
  });
}

// ============================================================================
// 3. PRIVATE IMPLEMENTATION
// ============================================================================

/**
 * Parses a command line string into arguments, respecting quoted strings.
 * @param input - Raw input string
 * @returns Array of argument strings
 */
export function parseCommandArgs(input: string): string[] {
  const result: string[] = [];
  const regex = /[^\s"']+|"([^"]*)"|'([^']*)'/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(input)) !== null) {
    if (match[1] !== undefined) {
      result.push(match[1]);
    } else if (match[2] !== undefined) {
      result.push(match[2]);
    } else {
      result.push(match[0]);
    }
  }
  return result;
}

/**
 * Substitutes placeholders in content with provided arguments.
 *
 * Placeholders:
 * - $1, $2, ...: positional args (1-indexed), missing -> empty string
 * - $@ or $ARGUMENTS: all args joined by space
 * - ${N:-default}: arg N if present and non-empty, else default
 * - ${@:N}: slice from N (1-indexed) to end
 * - ${@:N:L}: slice from N with length L
 *
 * @param content - Template content
 * @param args - Argument values
 * @returns Substituted string
 */
export function substitutePromptArgs(content: string, args: string[]): string {
  let result = content;

  result = result.replace(/\$(\d+)/g, (_, n) => {
    const index = parseInt(n, 10) - 1;
    return index >= 0 && index < args.length ? args[index] : '';
  });

  result = result.replace(/\$(?:@|ARGUMENTS)/g, () => args.join(' '));

  result = result.replace(/\$\{(\d+):-(.*?)\}/g, (_, n, def) => {
    const index = parseInt(n, 10) - 1;
    const arg = args[index];
    return (arg !== undefined && arg !== '') ? arg : def;
  });

  result = result.replace(/\$\{@:(\d+)(?::(\d+))?\}/g, (_, startStr, lenStr) => {
    const start = parseInt(startStr, 10) - 1;
    if (start < 0) return '';
    const length = lenStr ? parseInt(lenStr, 10) : undefined;
    const slice = length !== undefined ? args.slice(start, start + length) : args.slice(start);
    return slice.join(' ');
  });

  return result;
}
