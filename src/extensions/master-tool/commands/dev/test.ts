#!/usr/bin/env node

/**
 * Dev Test Command
 *
 * Run tests with optional coverage, filtering, and reporting.
 * Category: dev
 */

import { Type } from "typebox";
import { Text } from "@earendil-works/pi-tui";

export const metadata = {
  name: "dev.test",
  category: "dev",
  description: "Run project tests (Vitest/Jest) with optional coverage and filtering",
  longDescription: `
Run the project's test suite using the configured test runner (Vitest/Jest).

Supports:
- File/pattern filtering
- Coverage collection
- Watch mode (continuous)
- Specific test name matching
- Concurrent execution control
  `.trim(),
  examples: [
    "master_tool({ command: 'dev.test', args: {} })",
    "master_tool({ command: 'dev.test', args: { files: ['src/utils/'], coverage: true } })",
    "master_tool({ command: 'dev.test', args: { name: 'should handle errors' } })"
  ],
  tags: ["dev", "testing", "ci"],
  permissions: ["exec:npm", "fs:read"],
  dependsOn: [] // Could depend on 'dev.build' if needed
};

export const schema = Type.Object({
  files: Type.Optional(Type.Array(Type.String(), { description: "Files or directories to test (relative to cwd)" })),
  pattern: Type.Optional(Type.String({ description: "Test file pattern (e.g., '**/*.test.ts')" })),
  name: Type.Optional(Type.String({ description: "Run only tests matching this name" })),
  coverage: Type.Optional(Type.Boolean({ description: "Generate coverage report (default false)" })),
  watch: Type.Optional(Type.Boolean({ description: "Run in watch mode (default false)" })),
  threads: Type.Optional(Type.Integer({ description: "Number of worker threads (default auto)" })),
  silent: Type.Optional(Type.Boolean({ description: "Silent output (default false)" }))
}, { additionalProperties: false });

interface TestResult {
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  coverage?: {
    lines: number;
    functions: number;
    statements: number;
    branches: number;
  };
}

export async function execute(
  args: {
    files?: string[];
    pattern?: string;
    name?: string;
    coverage?: boolean;
    watch?: boolean;
    threads?: number;
    silent?: boolean;
  },
  cwd: string,
  signal?: AbortSignal,
  ctx?: any
): Promise<{ code: number; stdout: string; stderr: string; data?: TestResult }> {
  try {
    // Build command
    const cmdArgs: string[] = ['test'];
    
    if (args.coverage) cmdArgs.push('--coverage');
    if (args.watch) cmdArgs.push('--watch');
    if (args.silent) cmdArgs.push('--silent');
    if (args.threads) cmdArgs.push(`--threads=${args.threads}`);
    
    if (args.name) {
      cmdArgs.push('--testNamePattern', args.name);
    }
    
    if (args.files?.length) {
      cmdArgs.push(...args.files);
    }
    
    // Execute via npm (assumes project uses npm scripts)
    const result = await ctx?.exec?.('npm', cmdArgs, { cwd, signal })
      ?? { code: 0, stdout: "", stderr: "" };

    // Parse output for stats (simple regex)
    const stats = parseTestOutput(result.stdout);
    
    return {
      code: result.code,
      stdout: result.stdout,
      stderr: result.stderr,
      data: stats
    };

  } catch (error: any) {
    return {
      code: 1,
      stdout: "",
      stderr: `Test execution error: ${error.message}`,
      data: undefined
    };
  }
}

// Simple parser for test output (customize based on your test runner)
export function parseTestOutput(stdout: string): TestResult {
  const result: TestResult = {
    passed: 0,
    failed: 0,
    skipped: 0,
    duration: 0
  };

  // Vitest pattern: "✓ src/utils/format.test.ts (45)"
  // Jest pattern: "PASS src/utils/format.test.ts"
  
  // Rough estimation - in real implementation, use proper parser
  const passedMatches = stdout.match(/✓|PASS|passed/gi);
  const failedMatches = stdout.match(/✗|FAIL|failed/gi);
  
  result.passed = passedMatches?.length ?? 0;
  result.failed = failedMatches?.length ?? 0;
  result.skipped = (stdout.match(/⊘|pending|skipped/gi)?.length ?? 0);
  
  // Extract duration if available: "Test Files  X passed ( TIME )"
  const durationMatch = stdout.match(/\(\s*(\d+)\s*(ms|s)\s*\)/);
  if (durationMatch) {
    const value = parseInt(durationMatch[1], 10);
    result.duration = durationMatch[2] === 's' ? value * 1000 : value;
  }

  return result;
}
function buildTestResultLines(data: TestResult, theme: any): string[] {
  const lines: string[] = [];
  lines.push(theme.fg("accent", "🧪 Test Results").bold());
  lines.push("");
  lines.push(`Passed: ${theme.fg("success", data.passed.toString())}`);
  lines.push(`Failed: ${theme.fg(data.failed > 0 ? "error" : "text", data.failed.toString())}`);
  lines.push(`Skipped: ${theme.fg("muted", data.skipped.toString())}`);
  if (data.duration > 0) {
    lines.push(`Duration: ${theme.fg("text", `${(data.duration / 1000).toFixed(2)}s`)}`);
  }
  if (data.coverage) {
    lines.push("");
    lines.push(theme.fg("accent", "Coverage:"));
    lines.push(`  Lines: ${data.coverage.lines}%`);
    lines.push(`  Functions: ${data.coverage.functions}%`);
  }
  const total = data.passed + data.failed + data.skipped;
  if (total > 0) {
    const passRate = ((data.passed / total) * 100).toFixed(1);
    lines.push(`\nPass rate: ${passRate}%`);
  }
  return lines;
}

// Optional custom renderer
export function renderResult(result: any, options: any, theme: any): any {
  if (result.code !== 0) {
    return new Text(theme.fg("error", `❌ Tests failed\n\n${result.stderr?.slice(0, 500) || ''}`));
  }
  const data = result.data as TestResult | undefined;
  if (!data) {
    return new Text(theme.fg("text", result.stdout));
  }
  return new Text(buildTestResultLines(data, theme).join("\n"));
}

export default { metadata, schema, execute, renderResult };
