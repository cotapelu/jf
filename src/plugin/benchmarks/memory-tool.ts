#!/usr/bin/env node
/* eslint-disable no-await-in-loop */
/**
 * Memory Tool Performance Benchmark
 *
 * Measures performance of memory operations:
 * - Adding memories (single and batch)
 * - Searching memories
 * - Retrieving and deleting memories
 * - Memory with different tag counts
 */

import { harness } from './benchmark-harness.js';

// Simulate memory storage (the actual tool uses in-memory store)
class MockMemoryStore {
  private entries: Array<{ id: number; text: string; tags: string[]; timestamp: number }> = [];
  private idCounter = 0;

  async add(text: string, tags: string[] = []): Promise<number> {
    const id = ++this.idCounter;
    this.entries.push({ id, text, tags, timestamp: Date.now() });
    return id;
  }

  async addBatch(items: Array<{ text: string; tags: string[] }>): Promise<number[]> {
    const ids: number[] = [];
    for (const item of items) {
      const id = ++this.idCounter;
      this.entries.push({ id, text: item.text, tags: item.tags, timestamp: Date.now() });
      ids.push(id);
    }
    return ids;
  }

  async search(query: string): Promise<typeof this.entries> {
    return this.entries.filter(e => e.text.toLowerCase().includes(query.toLowerCase()));
  }

  async get(id: number): Promise<typeof this.entries[0] | undefined> {
    return this.entries.find(e => e.id === id);
  }

  async delete(id: number): Promise<boolean> {
    const idx = this.entries.findIndex(e => e.id === id);
    if (idx !== -1) {
      this.entries.splice(idx, 1);
      return true;
    }
    return false;
  }

  clear(): void {
    this.entries = [];
    this.idCounter = 0;
  }

  size(): number {
    return this.entries.length;
  }
}

const store = new MockMemoryStore();

async function benchmarkAddSingle(iterations: number = 100): Promise<number> {
  const start = process.hrtime.bigint();

  for (let i = 0; i < iterations; i++) {
    await store.add(`Memory entry ${i}`, ['benchmark', 'test']);
  }

  const end = process.hrtime.bigint();
  store.clear();
  return Number(end - start) / 1_000_000;
}

async function benchmarkAddBatch(iterations: number = 10, batchSize: number = 100): Promise<number> {
  const start = process.hrtime.bigint();

  for (let i = 0; i < iterations; i++) {
    const items = Array.from({ length: batchSize }, (_, j) => ({
      text: `Batch entry ${i}-${j}`,
      tags: ['batch', `group-${i}`]
    }));
    await store.addBatch(items);
  }

  const end = process.hrtime.bigint();
  store.clear();
  return Number(end - start) / 1_000_000;
}

async function benchmarkSearch(entries: number = 1000, queries: number = 100): Promise<number> {
  // Pre-populate
  for (let i = 0; i < entries; i++) {
    await store.add(`Entry with keyword${i % 10} and other text`, ['tag1', `tag${i % 5}`]);
  }

  const start = process.hrtime.bigint();

  for (let i = 0; i < queries; i++) {
    const query = `keyword${i % 10}`;
    await store.search(query);
  }

  const end = process.hrtime.bigint();
  store.clear();
  return Number(end - start) / 1_000_000;
}

async function benchmarkGetById(entries: number = 1000, gets: number = 500): Promise<number> {
  // Pre-populate
  const ids: number[] = [];
  for (let i = 0; i < entries; i++) {
    const id = await store.add(`Entry ${i}`, []);
    ids.push(id);
  }

  const start = process.hrtime.bigint();

  for (let i = 0; i < gets; i++) {
    const id = ids[i % ids.length];
    await store.get(id);
  }

  const end = process.hrtime.bigint();
  store.clear();
  return Number(end - start) / 1_000_000;
}

async function benchmarkDelete(entries: number = 1000, deletes: number = 500): Promise<number> {
  // Pre-populate
  const ids: number[] = [];
  for (let i = 0; i < entries; i++) {
    const id = await store.add(`Entry ${i}`, []);
    ids.push(id);
  }

  const start = process.hrtime.bigint();

  for (let i = 0; i < deletes; i++) {
    const idx = i % ids.length;
    await store.delete(ids[idx]);
  }

  const end = process.hrtime.bigint();
  store.clear();
  return Number(end - start) / 1_000_000;
}

async function benchmarkMixedWorkload(iterations: number = 100): Promise<number> {
  store.clear();

  const start = process.hrtime.bigint();

  for (let i = 0; i < iterations; i++) {
    // Add
    const id = await store.add(`Entry ${i}`, ['mixed', `group-${i % 3}`]);

    // Search
    await store.search(`Entry ${i}`);

    // Get
    await store.get(id);

    // Delete
    await store.delete(id);
  }

  const end = process.hrtime.bigint();
  store.clear();
  return Number(end - start) / 1_000_000;
}

// Main
async function main() {
  console.log('\n🧠 Memory Tool Performance Benchmarks\n');

  await harness.runBenchmark('Add Single Memory (100 adds)', () => benchmarkAddSingle(100), {
    iterations: 30,
    warmup: 5
  });

  await harness.runBenchmark('Add Batch Memory (10 batches × 100)', () => benchmarkAddBatch(10, 100), {
    iterations: 20,
    warmup: 5
  });

  await harness.runBenchmark('Search Memory (1000 entries, 100 queries)', () => benchmarkSearch(1000, 100), {
    iterations: 30,
    warmup: 5
  });

  await harness.runBenchmark('Get by ID (1000 entries, 500 gets)', () => benchmarkGetById(1000, 500), {
    iterations: 30,
    warmup: 5
  });

  await harness.runBenchmark('Delete Memory (1000 entries, 500 deletes)', () => benchmarkDelete(1000, 500), {
    iterations: 30,
    warmup: 5
  });

  await harness.runBenchmark('Mixed Workload (100 cycles)', () => benchmarkMixedWorkload(100), {
    iterations: 30,
    warmup: 5
  });

  console.log(harness.generateReport());
}

main().catch(console.error);
