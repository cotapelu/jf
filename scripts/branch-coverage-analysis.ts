import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

interface CoverageData {
  [filepath: string]: {
    s: { [k: string]: number };
    b: { [k: string]: [number, number] };
    // maybe other fields
  };
}

async function main() {
  const data = await readFile('coverage/coverage-final.json', 'utf-8');
  const coverage: CoverageData = JSON.parse(data);

  const fileStats: Array<{ file: string; statements: { covered: number; total: number }; branches: { covered: number; total: number } }> = [];

  for (const [fullPath, cov] of Object.entries(coverage)) {
    const s = cov.s;
    const b = cov.b;
    const statementCovered = Object.values(s).reduce((sum, val) => sum + val[0], 0);
    const statementTotal = Object.values(s).reduce((sum, val) => sum + val[1], 0);
    const branchCovered = Object.values(b).reduce((sum, [c]) => sum + c, 0);
    const branchTotal = Object.values(b).reduce((sum, [, t]) => sum + t, 0);
    fileStats.push({
      file: fullPath.split('/').slice(-2).join('/') + '/' + fullPath.split('/').pop()?.split('.')[0] + '.ts', // simplified
      statements: { covered: statementCovered, total: statementTotal },
      branches: { covered: branchCovered, total: branchTotal },
    });
  }

  // Sort by branch coverage % ascending
  fileStats.sort((a, b) => {
    const percA = a.branches.total > 0 ? a.branches.covered / a.branches.total : 1;
    const percB = b.branches.total > 0 ? b.branches.covered / b.branches.total : 1;
    return percA - percB;
  });

  console.log('Top 20 files with lowest branch coverage:');
  console.table(
    fileStats.slice(0, 20).map(f => ({
      file: f.file,
      branchCovered: `${f.branches.covered}/${f.branches.total}`,
      branchPct: f.branches.total > 0 ? ((f.branches.covered / f.branches.total) * 100).toFixed(1) + '%' : 'N/A',
      stmtsCovered: `${f.statements.covered}/${f.statements.total}`,
    }))
  );
}

main().catch(console.error);
