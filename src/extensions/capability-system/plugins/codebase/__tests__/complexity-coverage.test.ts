import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { mkdtemp, rm } from 'fs/promises';
import { execute } from '../capabilities/complexity';

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

describe('codebase.complexity coverage gaps', () => {
  let tmpdir: string;

  beforeEach(async () => {
    tmpdir = await mkdtemp('evo-test-complexity-cov-');
  });

  afterEach(async () => {
    await rm(tmpdir, { recursive: true, force: true });
  });

  it('should detect .js file language', async () => {
    const fileRel = 'test.js';
    const content = '\nfunction foo() { return 1; }\n';
    const fileAbs = join(tmpdir, fileRel);
    await fs.writeFile(fileAbs, content, 'utf8');

    const result = await execute({ file: fileRel }, { cwd: tmpdir });
    expect(result.isError).toBe(false);
    const details = result.details as ComplexityDetails;
    expect(details.language).toBe('js');
  });

  it('should detect .jsx file language', async () => {
    const fileRel = 'test.jsx';
    const content = '\nexport const x = <div>Hello</div>;\n';
    const fileAbs = join(tmpdir, fileRel);
    await fs.writeFile(fileAbs, content, 'utf8');

    const result = await execute({ file: fileRel }, { cwd: tmpdir });
    expect(result.isError).toBe(false);
    const details = result.details as ComplexityDetails;
    expect(details.language).toBe('jsx');
  });

  it('should return unknown for unrecognized extension (but valid TS code)', async () => {
    const fileRel = 'data.txt';
    // Use valid TypeScript code; extension unknown
    const content = 'export const x = 1;';
    const fileAbs = join(tmpdir, fileRel);
    await fs.writeFile(fileAbs, content, 'utf8');

    const result = await execute({ file: fileRel }, { cwd: tmpdir });
    const details = result.details as ComplexityDetails;
    expect(result.isError).toBe(false);
    expect(details.language).toBe('unknown');
  });

  // Note: Empty file test omitted because parser throws on empty content (parse error), which is already covered.
});
