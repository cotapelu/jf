const cov = require('../coverage/coverage-final.json');
const files = [];
for (const file in cov) {
  if (!file.endsWith('.ts')) continue;
  const data = cov[file];
  if (!data.branchMap || !data.b) continue;
  let total = 0, covered = 0;
  for (const key in data.branchMap) {
    total++;
    const taken = data.b[key];
    if (taken && taken.some(t => t > 0)) covered++;
  }
  if (covered < total) {
    files.push({ file: file.split('/').pop(), covered, total, unc: total - covered, pct: ((covered/total)*100).toFixed(2) });
  }
}
files.sort((a,b) => b.unc - a.unc);
console.log('Uncovered branches summary (top):\n');
console.log('File                          | Cover | Total | Uncov | %');
console.log('-'.repeat(60));
for (const f of files.slice(0, 15)) {
  console.log(`${f.file.padEnd(30)} | ${String(f.covered).padStart(4)} | ${String(f.total).padStart(5)} | ${String(f.unc).padStart(5)} | ${f.pct}%`);
}
const totalUnc = files.reduce((sum,f)=>sum+f.unc,0);
console.log(`\nTotal uncovered branches: ${totalUnc} across ${files.length} files`);