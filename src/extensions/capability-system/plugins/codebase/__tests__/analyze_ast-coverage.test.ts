import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import analyzeAstModule from '../capabilities/analyze_ast.js';

describe('analyze_ast coverage gaps', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'jf-ast-'));
  });

  afterEach(async () => {
    try { await rm(tempDir, { recursive: true, force: true }); } catch {}
  });

  it('should handle non-existent file', async () => {
    const ctx = { cwd: tempDir };
    const result = await analyzeAstModule.execute({ file: 'missing.ts' }, ctx as any);
    expect(result.exists).toBe(false);
    expect(result.error).toContain('Cannot read file');
  });

  it('should handle TypeScript parse error', async () => {
    const file = join(tempDir, 'bad.ts');
    // Incomplete class declaration
    await writeFile(file, 'class ', 'utf-8');
    const ctx = { cwd: tempDir };
    const result = await analyzeAstModule.execute({ file: 'bad.ts' }, ctx as any);
    expect(result.error).toContain('TypeScript parse error');
  });
});
