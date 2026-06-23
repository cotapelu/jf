import { promises as fs } from 'node:fs';
import { join } from 'node:path';

export async function getCoverageReport(cwd: string): Promise<{ statements: number; branches: number; functions: number; lines: number } | null> {
  const coveragePaths = [
    join(cwd, 'coverage', 'coverage-summary.json'),
    join(cwd, 'coverage', 'final.json'),
    join(cwd, 'coverage-json', 'summary.json'),
  ];

  for (const path of coveragePaths) {
    try {
      const content = await fs.readFile(path, 'utf-8');
      const data = JSON.parse(content);
      const total = data.total || data;
      return {
        statements: total.statements?.pct || total.statements?.percent || total.statements?.value || 0,
        branches: total.branches?.pct || total.branches?.percent || total.branches?.value || 0,
        functions: total.functions?.pct || total.functions?.percent || total.functions?.value || 0,
        lines: total.lines?.pct || total.lines?.percent || total.lines?.value || 0,
      };
    } catch {
      // Try next path
    }
  }
  return null;
}
