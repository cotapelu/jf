import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { mkdtemp, rm } from 'fs/promises';
import { execute, complexityRating, miRating } from '../capabilities/complexity';

// Define type for details (matches ComplexityResult from capability)
interface ComplexityDetails {
  file: string;
  exists: boolean;
  language: string;
  lines: number;
  functions: number;
  cyclomatic: number;
  halstead: { volume: number; difficulty: number; effort: number; bugs: number };
  maintainability: number;
}

describe('codebase.complexity', () => {
  let tmpdir: string;

  beforeEach(async () => {
    tmpdir = await mkdtemp('evo-test-complexity-');
  });

  afterEach(async () => {
    await rm(tmpdir, { recursive: true, force: true });
  });

  it('should compute complexity for a simple function', async () => {
    const fileRel = 'simple.ts';
    const content = `
export function add(a: number, b: number): number {
  return a + b;
}
`;
    const fileAbs = join(tmpdir, fileRel);
    await fs.writeFile(fileAbs, content, 'utf8');

    const result = await execute({ file: fileRel }, { cwd: tmpdir });
    expect(result.isError).toBe(false);
    const details = result.details as ComplexityDetails;
    expect(details.lines).toBeGreaterThan(0);
    expect(details.functions).toBe(1);
    expect(details.cyclomatic).toBe(1);
  });

  it('should count cyclomatic complexity for if/else', async () => {
    const fileRel = 'conditionals.ts';
    const content = `
function process(x: number): number {
  if (x > 0) {
    return x;
  } else if (x < 0) {
    return -x;
  } else {
    return 0;
  }
}
`;
    const fileAbs = join(tmpdir, fileRel);
    await fs.writeFile(fileAbs, content, 'utf8');

    const result = await execute({ file: fileRel }, { cwd: tmpdir });
    const details = result.details as ComplexityDetails;
    expect(details.cyclomatic).toBe(3);
  });

  it('should count loops as decision points', async () => {
    const fileRel = 'loops.ts';
    const content = `
function sum(arr: number[]): number {
  let total = 0;
  for (let i = 0; i < arr.length; i++) {
    total += arr[i];
  }
  while (i < 10) { i++; }
  do { i--; } while (i > 0);
  return total;
}
`;
    const fileAbs = join(tmpdir, fileRel);
    await fs.writeFile(fileAbs, content, 'utf8');

    const result = await execute({ file: fileRel }, { cwd: tmpdir });
    const details = result.details as ComplexityDetails;
    expect(details.cyclomatic).toBe(4);
  });

  it('should handle switch statements', async () => {
    const fileRel = 'switch.ts';
    const content = `
function categorize(x: number): string {
  switch (x) {
    case 1: return 'one';
    case 2: return 'two';
    case 3: return 'three';
    default: return 'other';
  }
}
`;
    const fileAbs = join(tmpdir, fileRel);
    await fs.writeFile(fileAbs, content, 'utf8');

    const result = await execute({ file: fileRel }, { cwd: tmpdir });
    const details = result.details as ComplexityDetails;
    expect(details.cyclomatic).toBe(4);
  });

  it('should count logical operators as decision points', async () => {
    const fileRel = 'logical.ts';
    const content = `
function test(a: boolean, b: boolean, c: boolean): boolean {
  return a && b || c;
}
`;
    const fileAbs = join(tmpdir, fileRel);
    await fs.writeFile(fileAbs, content, 'utf8');

    const result = await execute({ file: fileRel }, { cwd: tmpdir });
    const details = result.details as ComplexityDetails;
    expect(details.cyclomatic).toBe(3);
  });

  it('should compute Halstead metrics', async () => {
    const fileRel = 'halstead.ts';
    const content = `
function multiply(x: number, y: number): number {
  return x * y;
}
function divide(x: number, y: number): number {
  if (y === 0) throw new Error('Divide by zero');
  return x / y;
}
`;
    const fileAbs = join(tmpdir, fileRel);
    await fs.writeFile(fileAbs, content, 'utf8');

    const result = await execute({ file: fileRel }, { cwd: tmpdir });
    const details = result.details as ComplexityDetails;
    expect(details.halstead).toBeDefined();
    expect(details.halstead.volume).toBeGreaterThan(0);
    expect(details.halstead.difficulty).toBeGreaterThan(0);
    expect(details.halstead.effort).toBeGreaterThan(0);
    expect(details.halstead.bugs).toBeGreaterThanOrEqual(0);
  });

  it('should compute maintainability index', async () => {
    const fileRel = 'mi.ts';
    const content = `
function foo() { return 1; }
function bar() { return 2; }
function baz() { return 3; }
`;
    const fileAbs = join(tmpdir, fileRel);
    await fs.writeFile(fileAbs, content, 'utf8');

    const result = await execute({ file: fileRel }, { cwd: tmpdir });
    const details = result.details as ComplexityDetails;
    expect(details.maintainability).toBeGreaterThan(0);
    expect(details.maintainability).toBeLessThanOrEqual(100);
  });

  it('should detect language based on extension', async () => {
    const fileRel = 'test.tsx';
    const content = `
export const x = 1;
function foo() { return x; }
`;
    const fileAbs = join(tmpdir, fileRel);
    await fs.writeFile(fileAbs, content, 'utf8');

    const result = await execute({ file: fileRel }, { cwd: tmpdir });
    const details = result.details as ComplexityDetails;
    expect(details.language).toBe('tsx');
  });

  it('should handle missing file gracefully', async () => {
    const result = await execute({ file: 'nonexistent.ts' }, { cwd: tmpdir });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('File not found');
  });

  it('should handle parse errors', async () => {
    const fileRel = 'broken.ts';
    const content = `
function broken(
  // missing closing brace
`;
    const fileAbs = join(tmpdir, fileRel);
    await fs.writeFile(fileAbs, content, 'utf8');

    const result = await execute({ file: fileRel }, { cwd: tmpdir });
    expect(result.isError).toBe(true);
    expect(result.details?.error).toBeDefined();
  });
});

// Additional branch coverage for rating functions

describe('complexityRating', () => {
  it('returns Low for cc=5', () => {
    expect(complexityRating(5)).toBe('Low (simple)');
  });
  it('returns Moderate for cc=15', () => {
    expect(complexityRating(15)).toBe('Moderate');
  });
  it('returns High for cc=30', () => {
    expect(complexityRating(30)).toBe('High (complex)');
  });
  it('returns Very High for cc=60', () => {
    expect(complexityRating(60)).toBe('Very High (risky)');
  });
});

describe('miRating', () => {
  it('returns Excellent for mi=90', () => {
    expect(miRating(90)).toBe('Excellent');
  });
  it('returns Good for mi=70', () => {
    expect(miRating(70)).toBe('Good');
  });
  it('returns Fair for mi=50', () => {
    expect(miRating(50)).toBe('Fair');
  });
  it('returns Poor for mi=30', () => {
    expect(miRating(30)).toBe('Poor');
  });
});
