/**
 * Glob Action - Find files/directories by glob pattern
 * 
 * Uses bash globstar for ** recursive matching.
 */

import { Type } from "typebox";

// ==================== SCHEMA ====================
export const schema = Type.Object({
  pattern: Type.String({ 
    description: "Glob pattern (e.g., '**/*.ts', '*.json', 'src/**/*.test.ts')" 
  }),
  path: Type.Optional(Type.String({ 
    description: "Base directory (default: current working directory)" 
  }))
});

// ==================== BUILD COMMAND ====================
export const buildCommand = (args: any): string => {
  const basePath = args.path || '.';
  const pattern = args.pattern;
  
  // Use bash with globstar for ** support
  // nullglob: if no matches, return empty string (not pattern literal)
  return `bash -c 'shopt -s globstar nullglob; echo ${JSON.stringify(basePath)}/${JSON.stringify(pattern)}'`;
};

// ==================== OPTIONAL RENDERER ====================
export const render = (result: any, theme: any) => {
  const stdout = result.stdout.trim();
  
  if (!stdout) {
    return new Text(theme.fg('dim', 'No files found'));
  }
  
  const files = stdout.split(/\s+/).filter((f: string) => f);
  const lines: string[] = [];
  
  lines.push(theme.fg('accent', `Found ${files.length} file(s):`));
  files.forEach((file: string, idx: number) => {
    lines.push(`  ${idx + 1}. ${file}`);
  });
  
  return new Text(lines.join('\n'));
};

// ==================== DEFAULT EXPORT ====================
export default {
  schema,
  buildCommand,
  render
};
