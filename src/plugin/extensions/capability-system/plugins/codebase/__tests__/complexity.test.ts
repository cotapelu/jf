import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { mkdtemp, rm } from 'fs/promises';
import { execute } from '../capabilities/complexity';
import * as complexityInternal from '../capabilities/complexity';

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

  // Additional tests to increase coverage

  it('should count cyclomatic complexity for ternary operator', async () => {
    const fileRel = 'ternary.ts';
    const content = `
function max(a: number, b: number): number {
  return a > b ? a : b;
}
`;
    const fileAbs = join(tmpdir, fileRel);
    await fs.writeFile(fileAbs, content, 'utf8');

    const result = await execute({ file: fileRel }, { cwd: tmpdir });
    expect(result.isError).toBe(false);
    const details = result.details as ComplexityDetails;
    expect(details.cyclomatic).toBe(2); // one conditional expression
  });

  it('should count cyclomatic complexity for try-catch', async () => {
    const fileRel = 'trycatch.ts';
    const content = `
function safeDiv(a: number, b: number): number {
  try {
    return a / b;
  } catch (e) {
    return 0;
  }
}
`;
    const fileAbs = join(tmpdir, fileRel);
    await fs.writeFile(fileAbs, content, 'utf8');

    const result = await execute({ file: fileRel }, { cwd: tmpdir });
    const details = result.details as ComplexityDetails;
    expect(details.cyclomatic).toBe(2); // catch clause adds 1
  });

  it('should count cyclomatic complexity for nested functions', async () => {
    const fileRel = 'nested.ts';
    const content = `
function outer(x: number): number {
  function inner(y: number): number {
    return y * 2;
  }
  return inner(x);
}
`;
    const fileAbs = join(tmpdir, fileRel);
    await fs.writeFile(fileAbs, content, 'utf8');

    const result = await execute({ file: fileRel }, { cwd: tmpdir });
    const details = result.details as ComplexityDetails;
    // outer function: 1, inner function: 1, plus any decisions (none)
    expect(details.cyclomatic).toBe(2);
    expect(details.functions).toBe(2);
  });

  it('should count cyclomatic complexity for member expression calls', async () => {
    const fileRel = 'member.ts';
    const content = `
function callMethod(obj: any, arg: number): number {
  return obj.compute(arg);
}
`;
    const fileAbs = join(tmpdir, fileRel);
    await fs.writeFile(fileAbs, content, 'utf8');

    const result = await execute({ file: fileRel }, { cwd: tmpdir });
    const details = result.details as ComplexityDetails;
    expect(details.cyclomatic).toBe(1);
  });

  it('should detect .js language correctly', async () => {
    const fileRel = 'app.js';
    const content = `
function add(a, b) { return a + b; }
`;
    const fileAbs = join(tmpdir, fileRel);
    await fs.writeFile(fileAbs, content, 'utf8');

    const result = await execute({ file: fileRel }, { cwd: tmpdir });
    const details = result.details as ComplexityDetails;
    expect(details.language).toBe('js');
  });

  it('should detect .jsx language correctly', async () => {
    const fileRel = 'component.jsx';
    const content = `
export const x = <div>Hello</div>;
function foo() { return 1; }
`;
    const fileAbs = join(tmpdir, fileRel);
    await fs.writeFile(fileAbs, content, 'utf8');

    const result = await execute({ file: fileRel }, { cwd: tmpdir });
    const details = result.details as ComplexityDetails;
    expect(details.language).toBe('jsx');
  });

  it('should produce Moderate complexity rating for cc=15', async () => {
    // Generate a file with many if statements to get cc around 15
    const fileRel = 'many-ifs.ts';
    let content = 'function test(x: number): number {\n';
    // Add 15 independent if statements returning values
    for (let i = 0; i < 14; i++) {
      content += `  if (x === ${i}) return ${i};\n`;
    }
    content += '  return 99;\n}';
    const fileAbs = join(tmpdir, fileRel);
    await fs.writeFile(fileAbs, content, 'utf8');

    const result = await execute({ file: fileRel }, { cwd: tmpdir });
    expect(result.isError).toBe(false);
    const details = result.details as ComplexityDetails;
    expect(details.cyclomatic).toBe(15);
    // Check output contains 'Moderate'
    expect(result.content[0].text).toContain('Moderate');
  });

  it('should produce High complexity rating for cc=30', async () => {
    const fileRel = 'high-cc.ts';
    let content = 'function test(x: number): number {\n';
    for (let i = 0; i < 29; i++) {
      content += `  if (x === ${i}) return ${i};\n`;
    }
    content += '  return 99;\n}';
    const fileAbs = join(tmpdir, fileRel);
    await fs.writeFile(fileAbs, content, 'utf8');

    const result = await execute({ file: fileRel }, { cwd: tmpdir });
    expect(result.isError).toBe(false);
    const details = result.details as ComplexityDetails;
    expect(details.cyclomatic).toBeGreaterThanOrEqual(20);
    expect(details.cyclomatic).toBeLessThanOrEqual(31); // 29 ifs + function entry
    expect(result.content[0].text).toContain('High');
  });

  it('should produce Very High complexity rating for cc>50', async () => {
    const fileRel = 'very-high.ts';
    let content = 'function test(x: number): number {\n';
    for (let i = 0; i < 60; i++) {
      content += `  if (x === ${i}) return ${i};\n`;
    }
    content += '  return 99;\n}';
    const fileAbs = join(tmpdir, fileRel);
    await fs.writeFile(fileAbs, content, 'utf8');

    const result = await execute({ file: fileRel }, { cwd: tmpdir });
    expect(result.isError).toBe(false);
    const details = result.details as ComplexityDetails;
    expect(details.cyclomatic).toBeGreaterThan(50);
    expect(result.content[0].text).toContain('Very High');
  });

  it('should produce Excellent MI rating', async () => {
    const fileRel = 'excellent-mi.ts';
    const content = `
function simple(): number { return 42; }
`;
    const fileAbs = join(tmpdir, fileRel);
    await fs.writeFile(fileAbs, content, 'utf8');

    const result = await execute({ file: fileRel }, { cwd: tmpdir });
    expect(result.isError).toBe(false);
    const details = result.details as ComplexityDetails;
    expect(details.maintainability).toBeGreaterThanOrEqual(85);
    expect(result.content[0].text).toContain('Excellent');
  });




});
