#!/usr/bin/env node
/**
 * TUI Rendering Performance Benchmark
 *
 * Measures performance of Text User Interface rendering:
 * - Basic text rendering
 * - Complex layout with multiple components
 * - Update frequency and responsiveness
 * - Large data set rendering
 */

import { harness } from './benchmark-harness.js';

// Minimal Text mock (pi-tui uses Text objects)
class Text {
  text: string;
  annotations: Array<{ start: number; end: number; style: string }> = [];

  constructor(text: string) {
    this.text = text;
  }

  setSpan(start: number, end: number, style: string): this {
    this.annotations.push({ start, end, style });
    return this;
  }

  toString(): string {
    return this.text;
  }
}

// Simulate component rendering
interface Component {
  render(): Text | Text[];
  update(data: any): void;
}

class SimpleListComponent implements Component {
  private items: string[] = [];
  private visibleCount = 10;

  update(items: string[]): void {
    this.items = items.slice(0, this.visibleCount);
  }

  render(): Text {
    const text = this.items.map((item, i) => `${i + 1}. ${item}`).join('\n');
    return new Text(text);
  }
}

class TableComponent implements Component {
  private data: Array<Array<string>> = [];
  private headers: string[] = [];

  setHeaders(headers: string[]): void {
    this.headers = headers;
  }

  update(rows: Array<Array<string>>): void {
    this.data = rows.slice(0, 20);
  }

  render(): Text {
    const lines: string[] = [];

    // Header
    lines.push(this.headers.join(' | '));
    lines.push('-'.repeat(this.headers.join(' | ').length));

    // Rows
    for (const row of this.data) {
      lines.push(row.join(' | '));
    }

    return new Text(lines.join('\n'));
  }
}

type TreeNode = { label: string; children?: TreeNode[] };

class TreeComponent implements Component {
  private nodes: TreeNode[] = [];
  private expanded = new Set<number>();

  update(nodes: TreeNode[]): void {
    this.nodes = nodes;
  }

  toggle(index: number): void {
    if (this.expanded.has(index)) {
      this.expanded.delete(index);
    } else {
      this.expanded.add(index);
    }
  }

  render(): Text {
    const lines: string[] = [];

    const renderNode = (node: any, depth: number, index: number) => {
      const indent = '  '.repeat(depth);
      const expanded = this.expanded.has(index);
      const prefix = expanded ? '▼ ' : '▶ ';

      lines.push(indent + prefix + node.label);

      if (expanded && node.children) {
        node.children.forEach((child: any, i: number) => {
          renderNode(child, depth + 1, index * 100 + i);
        });
      }
    };

    this.nodes.forEach((node, i) => renderNode(node, 0, i));

    return new Text(lines.join('\n'));
  }
}

async function benchmarkRenderText(iterations: number = 1000): Promise<number> {
  const start = process.hrtime.bigint();

  for (let i = 0; i < iterations; i++) {
    const text = new Text(`Render iteration ${i}`);
    text.toString();
  }

  const end = process.hrtime.bigint();
  return Number(end - start) / 1_000_000;
}

async function benchmarkRenderList(iterations: number = 100): Promise<number> {
  const component = new SimpleListComponent();
  const sampleItems = Array.from({ length: 100 }, (_, i) => `Item ${i}: Some descriptive text`);

  const start = process.hrtime.bigint();

  for (let i = 0; i < iterations; i++) {
    component.update(sampleItems);
    component.render().toString();
  }

  const end = process.hrtime.bigint();
  return Number(end - start) / 1_000_000;
}

async function benchmarkRenderTable(iterations: number = 100): Promise<number> {
  const component = new TableComponent();
  component.setHeaders(['ID', 'Name', 'Status', 'Progress']);

  const sampleRows = Array.from({ length: 50 }, (_, i) => [
    `${i}`,
    `Task ${i}: Description here`,
    i % 3 === 0 ? 'Completed' : i % 3 === 1 ? 'In Progress' : 'Pending',
    `${Math.floor(Math.random() * 100)}%`
  ]);

  const start = process.hrtime.bigint();

  for (let i = 0; i < iterations; i++) {
    component.update(sampleRows);
    component.render().toString();
  }

  const end = process.hrtime.bigint();
  return Number(end - start) / 1_000_000;
}

async function benchmarkRenderTree(iterations: number = 100): Promise<number> {
  const component = new TreeComponent();

  // Generate tree data
  const generateTree = (depth: number, breadth: number): any[] => {
    if (depth === 0) return [];
    return Array.from({ length: breadth }, (_, i) => ({
      label: `Node ${i}`,
      children: depth > 1 ? generateTree(depth - 1, 3) : undefined
    }));
  };

  const treeData = generateTree(3, 5);

  const start = process.hrtime.bigint();

  for (let i = 0; i < iterations; i++) {
    component.update(treeData);
    component.render().toString();
  }

  const end = process.hrtime.bigint();
  return Number(end - start) / 1_000_000;
}

async function benchmarkRenderWithStyles(iterations: number = 100): Promise<number> {
  const start = process.hrtime.bigint();

  for (let i = 0; i < iterations; i++) {
    const text = new Text('Styled text: ');
    text.setSpan(0, 5, 'bold');
    text.setSpan(6, 9, 'color:blue');
    text.setSpan(10, 14, 'underline');
    text.toString();
  }

  const end = process.hrtime.bigint();
  return Number(end - start) / 1_000_000;
}

async function benchmarkLargeDataset(iterations: number = 20): Promise<number> {
  const component = new SimpleListComponent();
  const largeDataset = Array.from({ length: 1000 }, (_, i) => `Large item ${i}: ${'x'.repeat(50)}`);

  const start = process.hrtime.bigint();

  for (let i = 0; i < iterations; i++) {
    component.update(largeDataset);
    component.render().toString();
  }

  const end = process.hrtime.bigint();
  return Number(end - start) / 1_000_000;
}

// Main
async function main() {
  console.log('\n🖥️  TUI Rendering Performance Benchmarks\n');

  await harness.runBenchmark('Render Text (1000 iterations)', () => benchmarkRenderText(1000), {
    iterations: 30,
    warmup: 5
  });

  await harness.runBenchmark('Render List (100 items, 100 iterations)', () => benchmarkRenderList(100), {
    iterations: 30,
    warmup: 5
  });

  await harness.runBenchmark('Render Table (50 rows, 100 iterations)', () => benchmarkRenderTable(100), {
    iterations: 30,
    warmup: 5
  });

  await harness.runBenchmark('Render Tree (depth 3, breadth 5)', () => benchmarkRenderTree(100), {
    iterations: 30,
    warmup: 5
  });

  await harness.runBenchmark('Render with Styles (100 iterations)', () => benchmarkRenderWithStyles(100), {
    iterations: 30,
    warmup: 5
  });

  await harness.runBenchmark('Large Dataset (1000 items, 20 iterations)', () => benchmarkLargeDataset(20), {
    iterations: 20,
    warmup: 5
  });

  console.log(harness.generateReport());
}

main().catch(console.error);
