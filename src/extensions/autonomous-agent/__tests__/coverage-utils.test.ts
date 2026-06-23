import { describe, it, expect, beforeEach } from 'vitest';
import { getCoverageReport } from '../utils/coverage.js';
import { mkdtemp, rmdir, writeFile, readdir, unlink, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import os from 'node:os';

describe('getCoverageReport (integration with temp files)', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(os.tmpdir(), 'cov-test-'));
  });

  afterEach(async () => {
    try {
      const files = await readdir(tempDir);
      await Promise.all(files.map(f => unlink(join(tempDir, f))));
    } catch { /* ignore */ }
    try { await rmdir(tempDir); } catch { /* ignore */ }
  });

  it('should read coverage-summary.json with pct fields', async () => {
    const coverageDir = join(tempDir, 'coverage');
    await mkdir(coverageDir, { recursive: true });
    await writeFile(
      join(coverageDir, 'coverage-summary.json'),
      JSON.stringify({
        total: {
          statements: { pct: 80 },
          branches: { pct: 70 },
          functions: { pct: 85 },
          lines: { pct: 82 }
        }
      })
    );

    const result = await getCoverageReport(tempDir);

    expect(result).toEqual({
      statements: 80,
      branches: 70,
      functions: 85,
      lines: 82
    });
  });

  it('should read final.json with percent fields', async () => {
    const coverageDir = join(tempDir, 'coverage');
    await mkdir(coverageDir, { recursive: true });
    await writeFile(
      join(coverageDir, 'final.json'),
      JSON.stringify({
        total: {
          statements: { percent: 81 },
          branches: { percent: 71 },
          functions: { percent: 83 },
          lines: { percent: 82 }
        }
      })
    );

    const result = await getCoverageReport(tempDir);

    expect(result?.statements).toBe(81);
    expect(result?.branches).toBe(71);
  });

  it('should return null when no coverage files exist', async () => {
    // tempDir empty
    const result = await getCoverageReport(tempDir);
    expect(result).toBeNull();
  });

  it('should handle legacy .value fields', async () => {
    const coverageDir = join(tempDir, 'coverage');
    await mkdir(coverageDir, { recursive: true });
    await writeFile(
      join(coverageDir, 'coverage-summary.json'),
      JSON.stringify({
        total: {
          statements: { value: 75 },
          branches: { value: 65 },
          functions: { value: 80 },
          lines: { value: 78 }
        }
      })
    );

    const result = await getCoverageReport(tempDir);

    expect(result?.statements).toBe(75);
    expect(result?.branches).toBe(65);
  });

  it('should default missing metrics to 0', async () => {
    const coverageDir = join(tempDir, 'coverage');
    await mkdir(coverageDir, { recursive: true });
    await writeFile(
      join(coverageDir, 'coverage-summary.json'),
      JSON.stringify({ total: {} })
    );

    const result = await getCoverageReport(tempDir);

    expect(result).toEqual({
      statements: 0,
      branches: 0,
      functions: 0,
      lines: 0
    });
  });

  it('should try next path if first file is unreadable', async () => {
    // Write only the second file (coverage-json/summary.json)
    const covJsonDir = join(tempDir, 'coverage-json');
    await mkdir(covJsonDir, { recursive: true });
    await writeFile(
      join(covJsonDir, 'summary.json'),
      JSON.stringify({
        total: {
          statements: { pct: 2 }
        }
      })
    );

    const result = await getCoverageReport(tempDir);

    expect(result?.statements).toBe(2);
  });
});
