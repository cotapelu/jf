const path = require('path');
const cov = require(path.join(process.cwd(), 'coverage', 'coverage-final.json'));
const p = Object.keys(cov).find(k => k.endsWith('session/registry.ts'));
if (!p) {
  console.log('session/registry.ts not found in coverage');
  process.exit(1);
}
const d = cov[p];
const b = d.b || {};
const total = Object.keys(b).length;
const covered = Object.values(b).filter(arr => arr.every(h => h > 0)).length;
console.log(`session/registry.ts: ${covered}/${total} branches covered (${((covered/total)*100).toFixed(2)}%)`);
console.log('Uncovered branches:');
for (const [id, loc] of Object.entries(d.branchMap || {})) {
  const hits = b[id];
  const ok = hits && hits.every(h => h > 0);
  if (!ok) {
    console.log(` Branch ${id} line ${loc.loc.start.line} (${loc.type}):`, hits || 'none');
  }
}
