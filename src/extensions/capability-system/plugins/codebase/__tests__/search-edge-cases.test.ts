import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { mkdtemp, rm } from 'fs/promises';
import os from 'os';
import * as path from 'path';

// Mock fs/promises to simulate errors
vi.mock('fs/promises', async () => {
  const actual = await vi.importActual<typeof import('fs/promises')>('fs/promises');
  return {
    ...actual,
    readdir: vi.fn(),
  };
});

import { readdir } from 'fs/promises';

// Import search capability after mocking
const searchModule = (await import('../capabilities/search.ts')).default;

describe('codebase.search edge cases', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(os.tmpdir(), 'search-edge-'));
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should skip files when maxResults already reached (early exit)', async () => {
    // Create two files, each containing a match
    const file1 = join(tempDir, 'a.ts');
    const file2 = join(tempDir, 'b.ts');
    await fs.writeFile(file1, 'const x = 1; // match', 'utf-8');
    await fs.writeFile(file2, 'const y = 2; // match', 'utf-8');
    const ctx = { cwd: tempDir };

    const result = await searchModule.execute({ query: 'match', maxResults: 1 }, ctx as any);
    expect(result.isError).toBe(false);
    expect(result.details.total).toBe(1);
    // Ensure only one file was processed (the early exit path taken for second file)
    // We can't directly observe, but total 1 indicates early exit worked.
  });

  it('should handle readdir error gracefully and return empty results', async () => {
    // Simulate readdir throwing
    vi.mocked(readdir).mockRejectedValueOnce(new Error('cannot read directory'));
    const ctx = { cwd: tempDir };

    const result = await searchModule.execute({ query: 'test' }, ctx as any);
    expect(result.isError).toBe(false);
    expect(result.details.total).toBe(0);
  });
});
