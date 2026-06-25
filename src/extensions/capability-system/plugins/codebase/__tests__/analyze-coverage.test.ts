import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { mkdtemp, rm } from 'fs/promises';
import analyzeModule from '../capabilities/analyze.ts';

describe('codebase.analyze coverage gaps', () => {
  let tempDir: string;
  beforeEach(async () => {
    tempDir = await mkdtemp('evo-analyze-coverage-');
  });
  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should parse wide variety of syntax to maximize branch coverage', async () => {
    const code = `
// Empty import
import {} from 'empty-named';

// Star import
import * as ns from 'star-mod';

// Default import
import def from 'default-mod';

// Named imports with alias and without
import { named1, named2 as alias2 } from 'named-mod';

// Exports
export default class DefaultClass {}
export default interface DefaultInterface {}
export default function defaultFn() {}
export default type DefaultT = string;

export { simpleExport } from 're-export';
export { another as aliasAnother } from 're-export-as';
export interface IMyInterface {}
export type MyType = number;
export enum MyEnum { A, B, C }

// Symbol declarations
function myFunction() {}
class MyClass {}
interface IAnotherInterface {}
type AnotherType = boolean;
const myConst = 123;
let myLet = 456;
var myVar = 789;
enum AnotherEnum { X, Y, Z }
`;
    const file = join(tempDir, 'coverage-sample.ts');
    await fs.writeFile(file, code, 'utf8');
    const ctx = { cwd: tempDir };
    const result = await analyzeModule.execute({ file: 'coverage-sample.ts' }, ctx as { cwd: string });

    expect(result.isError).toBe(false);
    const details = result.details as any;
    // Verify that we detected various imports and exports
    expect(details.imports.length).toBeGreaterThanOrEqual(4); // empty named, star, default, named
    expect(details.exports.length).toBeGreaterThanOrEqual(8); // various exports
    expect(details.symbols.length).toBeGreaterThanOrEqual(9); // function, class, interface, type, const, let, var, enum, another enum
  });

  it('should cover star export and default const export branches', async () => {
    const code = `
// Star export
export * from 'mod';

// Default const export (TypeScript allows this)
export default const defaultConst = 42;

// Symbol to be exported
function foo() {}
`;
    const file = join(tempDir, 'star-const.ts');
    await fs.writeFile(file, code, 'utf8');
    const ctx = { cwd: tempDir };
    const result = await analyzeModule.execute({ file: 'star-const.ts' }, ctx as { cwd: string });
    expect(result.isError).toBe(false);
    const details = result.details as any;
    // Should have star export (type 'named', name '*')
    expect(details.exports.some((e: any) => e.type === 'named' && e.name === '*')).toBe(true);
    // Should have default const export (type 'default', name 'defaultConst')
    expect(details.exports.some((e: any) => e.type === 'default' && e.name === 'defaultConst')).toBe(true);
    // Should have function symbol
    expect(details.symbols.some((s: any) => s.name === 'foo' && s.kind === 'function')).toBe(true);
  });
});
