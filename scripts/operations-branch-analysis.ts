import { readFile } from 'node:fs/promises';

interface CoverageData {
  [filepath: string]: any;
}

async function main() {
  const data = await readFile('coverage/coverage-final.json', 'utf-8');
  const coverage: CoverageData = JSON.parse(data);

  const opsStats: Array<{ file: string; covered: number; total: number; percent: number }> = [];

  for (const [fullPath, cov] of Object.entries(coverage)) {
    if (fullPath.includes('/src/tools/session/operations/') && fullPath.endsWith('.ts')) {
      const b = cov.b || {};
      const covered = Object.values(b).reduce((sum: number, [c]: [number, number]) => sum + c, 0);
      const total = Object.values(b).reduce((sum: number, [, t]: [number, number]) => sum + t, 0);
      const filename = fullPath.split('/').pop()?.replace('.ts', '') || fullPath;
      opsStats.push({ file: filename, covered, total, percent: total > 0 ? (covered / total) * 100 : 0 });
    }
  }

  opsStats.sort((a, b) => a.percent - b.percent);

  console.table(opsStats.map(o => ({ ...o, percent: o.percent.toFixed(1) + '%' })));
}

main().catch(console.error);
