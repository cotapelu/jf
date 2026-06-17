/**
 * Codebase Indexer Tool Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'fs/promises';
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
});
