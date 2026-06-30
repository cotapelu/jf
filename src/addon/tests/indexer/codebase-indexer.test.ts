/**
 * Codebase Indexer Tool Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { codebaseIndexTool as rawTool } from '../../tools/indexer/index.js';

const tool: any = rawTool;

describe('Codebase Indexer Tool', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp('.test-codebase-');
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should have correct metadata', () => {
    expect(rawTool).toBeDefined();
    expect(rawTool.name).toBe('codebase.index');
    expect(rawTool.description).toContain('code');
  });

  it('should return empty when no symbols found', async () => {
    await writeFile(join(tempDir, 'empty.ts'), '');
    const result: any = await tool.execute('call', { query: 'test' }, undefined, undefined, { cwd: tempDir });
    expect(result.details?.status).toBe('success');
    expect(result.content[0].text).toBe('No symbols found');
  });

  it('should find functions in simple file', async () => {
    const code = `
      function foo() {}
      function bar() {}
    `;
    await writeFile(join(tempDir, 'sample.ts'), code);
    const result: any = await tool.execute('call', { query: 'foo', kind: 'function' }, undefined, undefined, { cwd: tempDir });
    expect(result.details?.status).toBe('success');
    expect(result.content[0].text).toContain('foo');
    expect(result.content[0].text).toContain('function');
  });

  it('should find class declarations', async () => {
    const code = `
      class MyClass {}
    `;
    await writeFile(join(tempDir, 'sample.ts'), code);
    const result: any = await tool.execute('call', { query: 'MyClass', kind: 'class' }, undefined, undefined, { cwd: tempDir });
    expect(result.details?.status).toBe('success');
    expect(result.content[0].text).toContain('MyClass');
    expect(result.content[0].text).toContain('class');
  });

  it('should find variable declarations', async () => {
    const code = `
      const myVar = 123;
      let other = 'x';
    `;
    await writeFile(join(tempDir, 'sample.ts'), code);
    const result: any = await tool.execute('call', { query: 'myVar', kind: 'variable' }, undefined, undefined, { cwd: tempDir });
    expect(result.details?.status).toBe('success');
    expect(result.content[0].text).toContain('myVar');
    expect(result.content[0].text).toContain('variable');
  });

  it('should find constructor symbols', async () => {
    const code = `
      class C {
        constructor() {}
      }
    `;
    await writeFile(join(tempDir, 'sample.ts'), code);
    const result: any = await tool.execute('call', { query: 'constructor', kind: 'constructor' }, undefined, undefined, { cwd: tempDir });
    expect(result.details?.status).toBe('success');
    expect(result.content[0].text).toContain('constructor');
    expect(result.content[0].text).toContain('constructor');
  });

  it('should find type aliases', async () => {
    const code = `
      type MyType = string;
    `;
    await writeFile(join(tempDir, 'sample.ts'), code);
    const result: any = await tool.execute('call', { query: 'MyType', kind: 'type' }, undefined, undefined, { cwd: tempDir });
    expect(result.details?.status).toBe('success');
    expect(result.content[0].text).toContain('MyType');
    expect(result.content[0].text).toContain('type');
  });

  it('should perform case-insensitive search', async () => {
    const code = `
      function Foo() {}
    `;
    await writeFile(join(tempDir, 'sample.ts'), code);
    const result: any = await tool.execute('call', { query: 'FOO', kind: 'function' }, undefined, undefined, { cwd: tempDir });
    expect(result.details?.status).toBe('success');
    expect(result.content[0].text).toContain('Foo');
  });

  it('should ignore non-TypeScript files (.js)', async () => {
    // Create a .js file with a function
    const jsCode = `function jsFunc() {}`;
    await writeFile(join(tempDir, 'sample.js'), jsCode);
    // Also create a .ts file with a different symbol to ensure the tool is working
    const tsCode = `function tsFunc() {}`;
    await writeFile(join(tempDir, 'tsfile.ts'), tsCode);
    const result: any = await tool.execute('call', { query: 'jsFunc' }, undefined, undefined, { cwd: tempDir });
    expect(result.details?.status).toBe('success');
    expect(result.content[0].text).toBe('No symbols found');
  });

  it('should respect result limit', async () => {
    // Create a file with many functions
    const functions = Array.from({ length: 10 }, (_, i) => `function func${i}() {}`).join('\n');
    await writeFile(join(tempDir, 'many.ts'), functions);
    const result: any = await tool.execute('call', { query: 'func', kind: 'function', limit: 5 }, undefined, undefined, { cwd: tempDir });
    expect(result.details?.status).toBe('success');
    const matches = result.content[0].text.split('\n');
    // matches could be up to 5
    expect(matches.length).toBeLessThanOrEqual(5);
  });

  it('should return empty matches when cwd does not exist', async () => {
    const result: any = await tool.execute('call', { query: 'anything' }, undefined, undefined, { cwd: '/non/existent/path' });
    expect(result.details?.status).toBe('success');
    expect(result.content[0].text).toBe('No symbols found');
  });

  it('should scan files in subdirectories', async () => {
    const subdir = join(tempDir, 'sub');
    await mkdir(subdir, { recursive: true });
    const code = `function nestedFunc() {}`;
    await writeFile(join(subdir, 'nested.ts'), code);
    const result: any = await tool.execute('call', { query: 'nestedFunc', kind: 'function' }, undefined, undefined, { cwd: tempDir });
    expect(result.details?.status).toBe('success');
    expect(result.content[0].text).toContain('nestedFunc');
  });
});
