#!/usr/bin/env node
/**
 * Benchmark Harness Unit Tests
 *
 * Tests for the BenchmarkHarness class public API.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BenchmarkHarness } from './benchmark-harness.js';

describe('BenchmarkHarness', () => {
  let harness: BenchmarkHarness;

  beforeEach(() => {
    harness = new BenchmarkHarness();
  });

  describe('runBenchmark', () => {
    it('should execute a function and return a BenchmarkResult', async () => {
      const fn = async () => 5;
      const result = await harness.runBenchmark('test', fn, { iterations: 5, warmup: 0 });

      expect(result).toBeInstanceOf(Object);
      expect(result.name).toBe('test');
      expect(result.iterations).toBe(5);
      expect(result.mean).toBeGreaterThan(0);
    });

    it('should respect iteration count', async () => {
      const fn = async () => 1;
      await harness.runBenchmark('test', fn, { iterations: 10, warmup: 0 });
      expect(harness.results.length).toBe(1);
      expect(harness.results[0].iterations).toBe(10);
    });

    it('should perform warmup runs without counting them', async () => {
      let callCount = 0;
      const fn = async () => {
        callCount++;
        return 1;
      };
      await harness.runBenchmark('test', fn, { iterations: 3, warmup: 5 });
      expect(callCount).toBe(8); // 5 warmup + 3 measured
    });

    it('should handle synchronous functions', async () => {
      const fn = () => 10;
      const result = await harness.runBenchmark('sync test', fn, { iterations: 5, warmup: 0 });
      expect(result.iterations).toBe(5);
      expect(result.mean).toBeGreaterThan(0);
    });

    it('should accumulate results in harness.results', async () => {
      await harness.runBenchmark('test1', async () => 1, { iterations: 2, warmup: 0 });
      await harness.runBenchmark('test2', async () => 2, { iterations: 2, warmup: 0 });
      expect(harness.results.length).toBe(2);
    });
  });

  describe('result properties', () => {
    it('should include all required statistical properties', async () => {
      const result = await harness.runBenchmark('statistics', async () => 10, { iterations: 10, warmup: 0 });
      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('iterations');
      expect(result).toHaveProperty('mean');
      expect(result).toHaveProperty('median');
      expect(result).toHaveProperty('min');
      expect(result).toHaveProperty('max');
      expect(result).toHaveProperty('p95');
      expect(result).toHaveProperty('p99');
      expect(result).toHaveProperty('stddev');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('opsPerSecond');
    });

    it('should compute reasonable statistical relationships', async () => {
      const result = await harness.runBenchmark('relationships', async () => 50, { iterations: 30, warmup: 5 });
      // min <= median <= max
      expect(result.min).toBeLessThanOrEqual(result.median);
      expect(result.median).toBeLessThanOrEqual(result.max);
      // p95 <= p99
      expect(result.p95).toBeLessThanOrEqual(result.p99);
      // stddev non-negative
      expect(result.stddev).toBeGreaterThanOrEqual(0);
      // opsPerSecond > 0
      expect(result.opsPerSecond).toBeGreaterThan(0);
    });

    it('should have total = sum of all measurements', async () => {
      // This is implicitly true but good to verify the value is plausible
      const result = await harness.runBenchmark('total', async () => 20, { iterations: 10, warmup: 0 });
      expect(result.total).toBeCloseTo(result.mean * result.iterations, 1);
    });
  });

  describe('generateReport', () => {
    it('should generate a string report', async () => {
      await harness.runBenchmark('report test', async () => 1, { iterations: 2, warmup: 0 });
      const report = harness.generateReport();
      expect(typeof report).toBe('string');
      expect(report.length).toBeGreaterThan(0);
    });

    it('should contain benchmark name in report', async () => {
      await harness.runBenchmark('FindMe', async () => 1, { iterations: 1, warmup: 0 });
      const report = harness.generateReport();
      expect(report).toContain('FindMe');
    });

    it('should contain statistical labels', async () => {
      await harness.runBenchmark('labels', async () => 1, { iterations: 1, warmup: 0 });
      const report = harness.generateReport();
      expect(report).toContain('Mean:');
      expect(report).toContain('Median:');
      expect(report).toContain('Min:');
      expect(report).toContain('Max:');
      expect(report).toContain('P95:');
      expect(report).toContain('P99:');
      expect(report).toContain('StdDev:');
      expect(report).toContain('Ops/sec:');
    });

    it('should include summary section', async () => {
      await harness.runBenchmark('summary', async () => 1, { iterations: 1, warmup: 0 });
      const report = harness.generateReport();
      expect(report).toContain('SUMMARY');
      expect(report).toContain('Total Operations:');
      expect(report).toContain('Average Mean:');
      expect(report).toContain('Fastest:');
      expect(report).toContain('Slowest:');
    });

    it('should format numbers with 3 decimal places', async () => {
      await harness.runBenchmark('format', async () => 1.234567, { iterations: 1, warmup: 0 });
      const report = harness.generateReport();
      expect(report).toMatch(/\d+\.\d{3} ms/);
    });
  });

  describe('toJSON', () => {
    it('should return valid JSON string', async () => {
      await harness.runBenchmark('json test', async () => 1, { iterations: 2, warmup: 0 });
      const json = harness.toJSON();
      const parsed = JSON.parse(json);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBeGreaterThan(0);
    });

    it('should include all result properties in JSON', async () => {
      await harness.runBenchmark('json props', async () => 1, { iterations: 1, warmup: 0 });
      const json = harness.toJSON();
      const parsed = JSON.parse(json);
      expect(parsed[0]).toHaveProperty('name');
      expect(parsed[0]).toHaveProperty('iterations');
      expect(parsed[0]).toHaveProperty('mean');
      expect(parsed[0]).toHaveProperty('median');
      expect(parsed[0]).toHaveProperty('min');
      expect(parsed[0]).toHaveProperty('max');
      expect(parsed[0]).toHaveProperty('p95');
      expect(parsed[0]).toHaveProperty('p99');
      expect(parsed[0]).toHaveProperty('stddev');
      expect(parsed[0]).toHaveProperty('total');
      expect(parsed[0]).toHaveProperty('opsPerSecond');
    });
  });

  describe('reset', () => {
    it('should clear all results', async () => {
      await harness.runBenchmark('reset1', async () => 1, { iterations: 1, warmup: 0 });
      await harness.runBenchmark('reset2', async () => 2, { iterations: 1, warmup: 0 });
      expect(harness.results.length).toBe(2);
      harness.reset();
      expect(harness.results.length).toBe(0);
    });

    it('should allow reuse after reset', async () => {
      await harness.runBenchmark('first', async () => 1, { iterations: 1, warmup: 0 });
      harness.reset();
      await harness.runBenchmark('second', async () => 2, { iterations: 1, warmup: 0 });
      expect(harness.results.length).toBe(1);
      expect(harness.results[0].name).toBe('second');
    });
  });

  describe('edge cases', () => {
    it('should handle very fast operations', async () => {
      const result = await harness.runBenchmark('fast', async () => {}, { iterations: 100, warmup: 10 });
      expect(result.mean).toBeGreaterThan(0);
      expect(result.mean).toBeLessThan(10); // Should be sub-millisecond or low ms
    });

    it('should handle operations with variation', async () => {
      // Introduce variability
      const fn = async () => {
        const variance = Math.random() * 10;
        return 20 + variance;
      };
      const result = await harness.runBenchmark('variable', fn, { iterations: 50, warmup: 5 });
      expect(result.stddev).toBeGreaterThan(0);
    });
  });

  describe('realistic benchmark scenario', () => {
    it('should produce statistically reasonable output', async () => {
      const fn = async () => {
        // Simulate CPU-bound work
        let sum = 0;
        for (let i = 0; i < 1000; i++) {
          sum += Math.sqrt(i) * Math.sin(i);
        }
        return sum;
      };

      const result = await harness.runBenchmark('cpu-work', fn, {
        iterations: 20,
        warmup: 5
      });

      expect(result.iterations).toBe(20);
      expect(result.mean).toBeGreaterThan(0);
      expect(result.min).toBeLessThan(result.max);
      expect(result.median).toBeGreaterThan(0);
      // p99 should be >= p95 >= median
      expect(result.p99).toBeGreaterThanOrEqual(result.p95);
      expect(result.p95).toBeGreaterThanOrEqual(result.median);
    });
  });

  describe('concurrency safety', () => {
    it('should maintain independent state for separate instances', async () => {
      const h1 = new BenchmarkHarness();
      const h2 = new BenchmarkHarness();

      await h1.runBenchmark('A', async () => 1, { iterations: 5, warmup: 0 });
      await h2.runBenchmark('B', async () => 2, { iterations: 5, warmup: 0 });

      expect(h1.results.length).toBe(1);
      expect(h2.results.length).toBe(1);
      expect(h1.results[0].name).toBe('A');
      expect(h2.results[0].name).toBe('B');
    });
  });
});
