import { promises as fs } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execute } from '../capabilities/dependency_tree';

const __filename = fileURLToPath(import.meta.url);

// Types for test
interface DepTreeSuccessDetails {
  nodes: Array<{ id: string; file: string; exports: string[]; imports: string[] }>;
  edges: Array<{ from: string; to: string; symbols: string[] }>;
  cycles: string[][];
  summary: { totalFiles: number; totalEdges: number; cycleCount: number };
}

function debugResult(result: any) {
  if (result.isError) {
    // eslint-disable-next-line no-console
    console.error('CAP ERROR:', result.details, result.content);
  }
}

describe('codebase.dependency_tree', () => {
  let tmpDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tmpDir = await fs.mkdtemp('dep-tree-test-');
    process.chdir(tmpDir);
    tmpDir = process.cwd(); // ensure absolute path
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    // cleanup
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('basic single import', async () => {
    // File A: a.ts imports { foo } from './b'
    // File B: b.ts exports const foo = 1;
    await fs.writeFile('a.ts', `import { foo } from './b';\nexport const a = 2;`);
    await fs.writeFile('b.ts', `export const foo = 1;`);

    const result = await execute({ files: ['a.ts', 'b.ts'] }, { cwd: tmpDir } as { cwd: string });
    expect(result.isError).toBe(false);
    const details = result.details as DepTreeSuccessDetails;

    // nodes count 2
    expect(details.nodes.length).toBe(2);
    // edges: a.ts -> b.ts
    const edge = details.edges.find(e => e.from.endsWith('a.ts') && e.to.endsWith('b.ts'));
    expect(edge).toBeDefined();
    expect(edge?.symbols).toContain('foo');
    // cycles none
    expect(details.cycles.length).toBe(0);
    // summary
    expect(details.summary.totalFiles).toBe(2);
    expect(details.summary.totalEdges).toBe(1);
    expect(details.summary.cycleCount).toBe(0);
  });

  it('detects simple cycle', async () => {
    // a.ts imports from b
    // b.ts imports from c
    // c.ts imports from a
    await fs.writeFile('a.ts', `import x from './b';`);
    await fs.writeFile('b.ts', `import y from './c';`);
    await fs.writeFile('c.ts', `import z from './a';`);

    const result = await execute({ files: ['a.ts', 'b.ts', 'c.ts'] }, { cwd: tmpDir } as { cwd: string });
    expect(result.isError).toBe(false);
    const details = result.details as DepTreeSuccessDetails;

    expect(details.cycles.length).toBeGreaterThan(0);
    // cycle should contain all three
    const hasCycle = details.cycles.some((c: string[]) => c.length === 4 && c.includes('a.ts') && c.includes('b.ts') && c.includes('c.ts'));
    expect(hasCycle).toBe(true);
    expect(details.summary.cycleCount).toBeGreaterThan(0);
  });

  it('handles re-exports and wildcard', async () => {
    // a.ts: export { bar } from './b'
    // b.ts: export { foo } from './c'
    // c.ts: export const foo = 1;
    await fs.writeFile('a.ts', `export { bar } from './b';`);
    await fs.writeFile('b.ts', `export { foo } from './c';`);
    await fs.writeFile('c.ts', `export const foo = 1; export const bar = 2;`);

    const result = await execute({ files: ['a.ts', 'b.ts', 'c.ts'] }, { cwd: tmpDir } as { cwd: string });
    expect(result.isError).toBe(false);
    const details = result.details as DepTreeSuccessDetails;

    // Edges: b->c (from re-export), a->b (from re-export)
    const bToC = details.edges.find(e => e.from.endsWith('b.ts') && e.to.endsWith('c.ts'));
    expect(bToC).toBeDefined();
    const aToB = details.edges.find(e => e.from.endsWith('a.ts') && e.to.endsWith('b.ts'));
    expect(aToB).toBeDefined();
  });

  it('includes default and namespace imports', async () => {
    // a.ts: import React from 'react'; import * as utils from './b';
    // b.ts: export function helper() {}
    // We'll skip 'react' as external, but './b' should be resolved
    await fs.writeFile('a.ts', `import React from 'react';\nimport * as utils from './b';`);
    await fs.writeFile('b.ts', `export function helper() {}`);

    const result = await execute({ files: ['a.ts', 'b.ts'] }, { cwd: tmpDir } as { cwd: string });
    expect(result.isError).toBe(false);
    const details = result.details as DepTreeSuccessDetails;

    // a.ts imports from b.ts via namespace '*'
    const edge = details.edges.find(e => e.from.endsWith('a.ts') && e.to.endsWith('b.ts'));
    expect(edge).toBeDefined();
    expect(edge?.symbols).toContain('*');
  });

  it('gracefully handles missing dependency file', async () => {
    // a.ts imports from non-existent file
    await fs.writeFile('a.ts', `import { foo } from './missing';`);

    const result = await execute({ files: ['a.ts'] }, { cwd: tmpDir } as { cwd: string });
    // Since missing file is not in the file list, it should not create edge, but no error
    expect(result.isError).toBe(false);
    const details = result.details as DepTreeSuccessDetails;
    expect(details.nodes.length).toBe(1);
    expect(details.edges.length).toBe(0);
  });

  it('correctly collects exports and imports per node', async () => {
    await fs.writeFile('a.ts', `import { x } from './b';\nexport const a = 1;\n`);
    await fs.writeFile('b.ts', `export const x = 2;\nexport const y = 3;\n`);

    const result = await execute({ files: ['a.ts', 'b.ts'] }, { cwd: tmpDir } as { cwd: string });
    expect(result.isError).toBe(false);
    const details = result.details as DepTreeSuccessDetails;

    const nodeA = details.nodes.find(n => n.file.endsWith('a.ts'));
    const nodeB = details.nodes.find(n => n.file.endsWith('b.ts'));
    expect(nodeA).toBeDefined();
    expect(nodeB).toBeDefined();

    // a.ts exports ['a']; imports from b.ts
    expect(nodeA?.exports).toContain('a');
    expect(nodeA?.imports).toContain('b.ts');

    // b.ts exports ['x','y']; no imports
    expect(nodeB?.exports).toHaveLength(2);
    expect(nodeB?.exports).toContain('x');
    expect(nodeB?.exports).toContain('y');
    expect(nodeB?.imports).toHaveLength(0);
  });

  it('filters by entry points to reachable subgraph', async () => {
    // Graph: a -> b -> c
    await fs.writeFile('a.ts', `import { x } from './b';
export const a = 1;`);
    await fs.writeFile('b.ts', `import { y } from './c';
export const x = 2;
export const z = 3;`);
    await fs.writeFile('c.ts', `export const y = 3;`);

    // With entry point a, all nodes reachable
    const result = await execute({ files: ['a.ts', 'b.ts', 'c.ts'], entryPoints: ['a.ts'] }, { cwd: tmpDir } as { cwd: string });
    expect(result.isError).toBe(false);
    const details = result.details as DepTreeSuccessDetails;
    expect(details.nodes.length).toBe(3);
    const ids = details.nodes.map((n: any) => n.id);
    expect(ids).toContain('a.ts');
    expect(ids).toContain('b.ts');
    expect(ids).toContain('c.ts');

    // With entry point b only, a is unreachable, b and c reachable
    const resultB = await execute({ files: ['a.ts', 'b.ts', 'c.ts'], entryPoints: ['b.ts'] }, { cwd: tmpDir } as { cwd: string });
    expect(resultB.isError).toBe(false);
    const detailsB = resultB.details as DepTreeSuccessDetails;
    expect(detailsB.nodes.length).toBe(2);
    const idsB = detailsB.nodes.map((n: any) => n.id);
    expect(idsB).not.toContain('a.ts');
    expect(idsB).toContain('b.ts');
    expect(idsB).toContain('c.ts');
  });

  it('ignores entry points not in provided files', async () => {
    await fs.writeFile('a.ts', `export const a = 1;`);
    await fs.writeFile('b.ts', `import { a } from './a';
export const b = 2;`);

    const result = await execute({ files: ['a.ts', 'b.ts'], entryPoints: ['missing.ts', 'b.ts'] }, { cwd: tmpDir } as { cwd: string });
    expect(result.isError).toBe(false);
    const details = result.details as DepTreeSuccessDetails;
    // Only b.ts is valid entry; b imports a => both included
    expect(details.nodes.length).toBe(2);
    const ids = details.nodes.map((n: any) => n.id);
    expect(ids).toContain('a.ts');
    expect(ids).toContain('b.ts');
  });

  it('multiple entry points combine reachable sets', async () => {
    // Two independent graphs: a->b and c->d
    await fs.writeFile('a.ts', `import { x } from './b';
export const a = 1;`);
    await fs.writeFile('b.ts', `export const x = 2;`);
    await fs.writeFile('c.ts', `import { y } from './d';
export const c = 3;`);
    await fs.writeFile('d.ts', `export const y = 4;`);

    const result = await execute({ files: ['a.ts','b.ts','c.ts','d.ts'], entryPoints: ['a.ts','c.ts'] }, { cwd: tmpDir } as { cwd: string });
    expect(result.isError).toBe(false);
    const details = result.details as DepTreeSuccessDetails;
    expect(details.nodes.length).toBe(4);
  });
});
