#!/usr/bin/env node
/* eslint-disable no-await-in-loop */
/**
 * Benchmark Harness
 *
 * Provides statistical benchmarking with multiple iterations,
 * warm-up runs, and comprehensive metrics reporting.
 */

interface BenchmarkResult {
  name: string;
  iterations: number;
  mean: number;
  median: number;
  min: number;
  max: number;
  p95: number;
  p99: number;
  stddev: number;
  total: number;
  opsPerSecond: number;
}

interface BenchmarkConfig {
  iterations?: number;
  warmup?: number;
  concurrency?: number;
}

class BenchmarkHarness {
  private results: BenchmarkResult[] = [];

  /**
   * Run a single benchmark function multiple times and collect statistics.
   */
  async runBenchmark(
    name: string,
    fn: () => Promise<number> | number,
    config: BenchmarkConfig = {}
  ): Promise<BenchmarkResult> {
    const {
      iterations = 30,
      warmup = 5,
      concurrency = 1
    } = config;

    // Warm-up runs (not measured)
    for (let i = 0; i < warmup; i++) {
      const duration = typeof fn === 'function' ? fn() : fn;
      if (duration instanceof Promise) await duration;
    }

    // Measurement runs
    const measurements: number[] = [];
    for (let i = 0; i < iterations; i++) {
      const start = process.hrtime.bigint();
      const duration = typeof fn === 'function' ? fn() : fn;
      if (duration instanceof Promise) await duration;
      const end = process.hrtime.bigint();
      measurements.push(Number(end - start) / 1_000_000); // Convert to milliseconds
    }

    const result = this.calculateStats(name, measurements);
    this.results.push(result);
    return result;
  }

  /**
   * Calculate statistics from measurement array.
   */
  private calculateStats(name: string, measurements: number[]): BenchmarkResult {
    const sorted = [...measurements].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    const mean = sum / sorted.length;
    const median = this.percentile(sorted, 50);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const p95 = this.percentile(sorted, 95);
    const p99 = this.percentile(sorted, 99);
    const variance = sorted.reduce((acc, val) => acc + (val - mean)**2, 0) / sorted.length;
    const stddev = Math.sqrt(variance);
    const opsPerSecond = 1000 / mean;

    return {
      name,
      iterations: sorted.length,
      mean,
      median,
      min,
      max,
      p95,
      p99,
      stddev,
      total: sum,
      opsPerSecond
    };
  }

  /**
   * Calculate percentile from sorted array.
   */
  private percentile(sorted: number[], p: number): number {
    const index = (p / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;

    if (lower === upper) return sorted[lower];
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  }

  /**
   * Generate a formatted report of all benchmark results.
   */
  generateReport(): string {
    const lines: string[] = [
      '═'.repeat(100),
      '📊 BENCHMARK RESULTS',
      '═'.repeat(100),
      '',
      `Timestamp: ${new Date().toISOString()}`,
      `Total Benchmarks: ${this.results.length}`,
      '',
      '─'.repeat(100)
    ];

    for (const result of this.results) {
      lines.push(
        `\n🎯 ${result.name}`,
        `   Iterations:   ${result.iterations}`,
        `   Mean:         ${result.mean.toFixed(3)} ms`,
        `   Median:       ${result.median.toFixed(3)} ms`,
        `   Min:          ${result.min.toFixed(3)} ms`,
        `   Max:          ${result.max.toFixed(3)} ms`,
        `   P95:          ${result.p95.toFixed(3)} ms`,
        `   P99:          ${result.p99.toFixed(3)} ms`,
        `   StdDev:       ${result.stddev.toFixed(3)} ms`,
        `   Ops/sec:      ${result.opsPerSecond.toFixed(2)}`,
        `   Total:        ${result.total.toFixed(3)} ms`
      );
    }

    lines.push(
      '',
      '═'.repeat(100),
      '📈 SUMMARY',
      '═'.repeat(100)
    );

    // Aggregate summary
    const totalOps = this.results.reduce((sum, r) => sum + r.opsPerSecond, 0);
    const avgMean = this.results.reduce((sum, r) => sum + r.mean, 0) / this.results.length;
    lines.push(
      `Total Operations:  ${totalOps.toFixed(2)} ops/sec`,
      `Average Mean:      ${avgMean.toFixed(3)} ms`,
      `Fastest:           ${Math.min(...this.results.map(r => r.mean)).toFixed(3)} ms (${this.results.reduce((a, b) => a.mean < b.mean ? a : b, this.results[0]).name})`,
      `Slowest:           ${Math.max(...this.results.map(r => r.mean)).toFixed(3)} ms (${this.results.reduce((a, b) => a.mean > b.mean ? a : b, this.results[0]).name})`
    );

    lines.push('');
    return lines.join('\n');
  }

  /**
   * Export results as JSON.
   */
  toJSON(): string {
    return JSON.stringify(this.results, null, 2);
  }

  /**
   * Clear all results.
   */
  reset(): void {
    this.results = [];
  }
}

// Singleton harness instance
export const harness = new BenchmarkHarness();

export { BenchmarkHarness, BenchmarkResult, BenchmarkConfig };
