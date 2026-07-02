#!/usr/bin/env node
/* eslint-disable no-await-in-loop */
/**
 * PiClaw Benchmark Suite
 *
 * Comprehensive performance benchmarking for the piclaw coding agent.
 * Run with: npm run benchmark
 */

import { harness } from './benchmark-harness.js';
import { cpus, totalmem } from 'os';

interface BenchmarkSuite {
  name: string;
  description: string;
  run: () => Promise<void>;
}

const suites: BenchmarkSuite[] = [
  {
    name: 'team-performance',
    description: 'Team management operations (creation, claiming, heartbeats)',
    run: async () => {
      await import('./team-performance.js');
    }
  },
  {
    name: 'codebase-performance',
    description: 'Codebase plugin capabilities (analyze, search, complexity, etc.)',
    run: async () => {
      await import('./codebase-performance.js');
    }
  },
  {
    name: 'memory-tool',
    description: 'Memory tool operations (add, search, delete)',
    run: async () => {
      await import('./memory-tool.js');
    }
  },
  {
    name: 'tui-rendering',
    description: 'TUI component rendering performance',
    run: async () => {
      await import('./tui-rendering.js');
    }
  }
];

function printHeader(): void {
  console.log(`\n${  '═'.repeat(80)}`);
  console.log('🎯 PICLAW BENCHMARK SUITE');
  console.log('═'.repeat(80));
  console.log(`\nNode.js: ${process.version}`);
  console.log(`Platform: ${process.platform} ${process.arch}`);
  console.log(`CPU Cores: ${cpus().length}`);
  console.log(`Memory: ${(totalmem() / (1024 ** 3)).toFixed(1)} GB`);
  console.log(`\n${  '─'.repeat(80)  }\n`);
}

function printSuiteHeader(name: string, description: string): void {
  console.log(`\n📋 Suite: ${name}`);
  console.log(`   ${description}`);
  console.log(`${'─'.repeat(80)  }\n`);
}

function printSummary(totalSuites: number, totalTime: number): void {
  console.log(`\n${  '═'.repeat(80)}`);
  console.log('📊 SUMMARY');
  console.log('═'.repeat(80));
  console.log(`Total Suites:  ${totalSuites}`);
  console.log(`Total Time:    ${totalTime.toFixed(3)} ms`);
  console.log(`Avg per Suite: ${(totalTime / totalSuites).toFixed(3)} ms`);
  console.log(`${'═'.repeat(80)  }\n`);
}

// Main entry point
async function main(suiteFilter?: string): Promise<void> {
  const startTime = process.hrtime.bigint();

  printHeader();

  let suitesToRun = suites;
  if (suiteFilter) {
    suitesToRun = suites.filter(s => s.name.includes(suiteFilter));
    if (suitesToRun.length === 0) {
      console.error(`❌ No suite matches filter: ${suiteFilter}`);
      console.log(`Available suites: ${suites.map(s => s.name).join(', ')}`);
      process.exit(1);
    }
  }

  for (const suite of suitesToRun) {
    harness.reset();
    printSuiteHeader(suite.name, suite.description);

    const suiteStart = process.hrtime.bigint();
    try {
      await suite.run();
    } catch (err) {
      console.error(`❌ Suite failed: ${suite.name}`);
      console.error(err);
      continue;
    }
    const suiteTime = Number(process.hrtime.bigint() - suiteStart) / 1_000_000;
    console.log(`⏱️  Suite completed in ${suiteTime.toFixed(3)} ms\n`);
  }

  const totalTime = Number(process.hrtime.bigint() - startTime) / 1_000_000;
  printSummary(suitesToRun.length, totalTime);

  // Also output JSON to stderr for programmatic consumption
  if (process.env.BENCHMARK_JSON === 'true') {
    console.error(harness.toJSON());
  }
}

// Export harness for individual benchmarks
export { harness, BenchmarkHarness } from './benchmark-harness.js';

// CLI entry point
const suiteArg = process.argv[2];
main(suiteArg).catch(console.error);
