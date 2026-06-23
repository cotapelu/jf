import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const cov = JSON.parse(await readFile(join(process.cwd(), 'coverage', 'coverage-final.json'), 'utf8'));

function findFile(target: string) {
  return Object.entries(cov).find(([path]) => path.endsWith(target));
}

if (!findFile('registry.ts')) {
  console.error('registry.ts not found in coverage');
  process.exit(1);
}

const [path, data] = findFile('registry.ts');
const bm = data.branchMap || {};
const b = data.b || {};

console.log(`Branches for ${path}:`);
for (const [id, loc] of Object.entries(bm)) {
  const hits = b[id];
  const covered = hits && hits.every(h => h > 0);
  console.log(`${covered ? '✅' : '❌'} Branch ${id.padStart(2)} line ${String(loc.loc.start.line).padStart(3)} (${loc.type}) hits:`, hits || 'none');
}
