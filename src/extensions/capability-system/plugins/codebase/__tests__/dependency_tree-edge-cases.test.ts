import { promises as fs } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execute } from '../capabilities/dependency_tree';

const __filename = fileURLToPath(import.meta.url);

describe('dependency_tree edge cases', () => {
  let tmpDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tmpDir = await fs.mkdtemp('dep-tree-edge-');
    process.chdir(tmpDir);
    tmpDir = process.cwd();
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    try { await fs.rm(tmpDir, { recursive: true, force: true }); } catch {}
  });

  it('handles export default declaration', async () => {
    await fs.writeFile('a.ts', `export default 42;`);
    await fs.writeFile('b.ts', `import x from './a'; console.log(x);`);

    const result = await execute({ files: ['a.ts', 'b.ts'] }, { cwd: tmpDir } as any);
    expect(result.isError).toBe(false);
    const details = result.details as any;
    // b.ts imports default from a.ts -> edge
    const edge = details.edges.find(e => e.from.endsWith('b.ts') && e.to.endsWith('a.ts'));
    expect(edge).toBeDefined();
    expect(edge?.symbols).toContain('default');
  });

  it('handles export all from another module', async () => {
    await fs.writeFile('lib.ts', `export const a = 1; export const b = 2;`);
    await fs.writeFile('main.ts', `export * from './lib';`);
    await fs.writeFile('consumer.ts', `import { a } from './main';`);

    const result = await execute({ files: ['lib.ts', 'main.ts', 'consumer.ts'] }, { cwd: tmpDir } as any);
    expect(result.isError).toBe(false);
    const details = result.details as any;
    // main.ts imports (re-exports) from lib -> edge
    const mainToLib = details.edges.find(e => e.from.endsWith('main.ts') && e.to.endsWith('lib.ts'));
    expect(mainToLib).toBeDefined();
    // consumer.ts imports from main -> edge
    const consToMain = details.edges.find(e => e.from.endsWith('consumer.ts') && e.to.endsWith('main.ts'));
    expect(consToMain).toBeDefined();
  });

  it('includes all nodes when entryPoints is empty', async () => {
    await fs.writeFile('a.ts', `import y from './b'; export const a = 1;`);
    await fs.writeFile('b.ts', `import z from './c'; export const y = 2;`);
    await fs.writeFile('c.ts', `export const z = 3;`);

    const result = await execute({ files: ['a.ts','b.ts','c.ts'] }, { cwd: tmpDir } as any); // no entryPoints
    expect(result.isError).toBe(false);
    const details = result.details as any;
    // When entryPoints is empty, should include all nodes (graph not filtered)
    expect(details.nodes.length).toBe(3);
    expect(details.edges.length).toBeGreaterThan(0);
  });

  it('detects cycle with longer path and start index tracking', async () => {
    // a -> b -> c -> a, plus an extra node d -> b
    await fs.writeFile('a.ts', `import { x } from './b';`);
    await fs.writeFile('b.ts', `import { y } from './c';`);
    await fs.writeFile('c.ts', `import { z } from './a';`);
    await fs.writeFile('d.ts', `import { w } from './b';`);

    const result = await execute({ files: ['a.ts','b.ts','c.ts','d.ts'] }, { cwd: tmpDir } as any);
    expect(result.isError).toBe(false);
    const details = result.details as any;
    expect(details.cycles.length).toBeGreaterThan(0);
    // Cycle should contain a,b,c
    const cycleABC = details.cycles.find((c: string[]) => c.includes('a.ts') && c.includes('b.ts') && c.includes('c.ts'));
    expect(cycleABC).toBeDefined();
    // d is not part of cycle but points into cycle, should be allowed
    const dNode = details.nodes.find((n: any) => n.file.endsWith('d.ts'));
    expect(dNode).toBeDefined();
  });

  it('handles import declaration with all specifier types combined', async () => {
    // a.ts: import default, namespace, and named
    await fs.writeFile('b.ts', `export const named = 1; export const another = 2;`);
    await fs.writeFile('a.ts', `import DefaultExport, { named as renamed } from './b'; import * as ns from './b';`);

    const result = await execute({ files: ['a.ts','b.ts'] }, { cwd: tmpDir } as any);
    expect(result.isError).toBe(false);
    const details = result.details as any;
    const edge = details.edges.find(e => e.from.endsWith('a.ts') && e.to.endsWith('b.ts'));
    expect(edge).toBeDefined();
    // import { named as renamed } from './b' collects the original exported name 'named', not alias
    expect(edge?.symbols).toContain('default');
    expect(edge?.symbols).toContain('named');
    expect(edge?.symbols).toContain('*');
  });

  it('gracefully handles file read error during scanning', async () => {
    // Create file, then remove before scan
    await fs.writeFile('a.ts', `import { x } from './b';`);
    await fs.unlink('a.ts'); // remove

    const result = await execute({ files: ['a.ts'] }, { cwd: tmpDir } as any);
    // Should not throw; likely node skipped or error reported
    expect(result).toBeDefined();
    // Implementation currently may throw or return error; accept either
    if (result.isError) {
      const msg = typeof result.content === 'string' ? result.content : JSON.stringify(result.content);
      expect(msg.toLowerCase()).toMatch(/file not found|enoent|cannot find file/i);
    } else {
      expect((result.details as any).nodes.length).toBe(0);
    }
  });

  it('handles re-export default from another module', async () => {
    await fs.writeFile('impl.ts', `const value = 123; export default value;`);
    await fs.writeFile('api.ts', `export { default } from './impl';`);
    await fs.writeFile('user.ts', `import x from './api';`);

    const result = await execute({ files: ['impl.ts','api.ts','user.ts'] }, { cwd: tmpDir } as any);
    expect(result.isError).toBe(false);
    const details = result.details as any;
    // api.ts re-exports default from impl
    const apiToImpl = details.edges.find(e => e.from.endsWith('api.ts') && e.to.endsWith('impl.ts'));
    expect(apiToImpl).toBeDefined();
    // user.ts imports default from api
    const userToApi = details.edges.find(e => e.from.endsWith('user.ts') && e.to.endsWith('api.ts'));
    expect(userToApi).toBeDefined();
  });
});
