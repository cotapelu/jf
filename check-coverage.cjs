const cov = require('./coverage/coverage-final.json');
let min = 100, max = 0;
for (const file in cov) {
  const b = cov[file].branchMap;
  const totalBranches = b ? Object.keys(b).length : 0;
  const coveredBranches = b ? Object.values(b).filter(locs => locs[0] > 0).length : 0;
  const pct = totalBranches ? (coveredBranches / totalBranches) * 100 : 0;
  if (pct < min && totalBranches > 0) {
    min = pct;
    console.log(`Low: ${file} -> ${pct.toFixed(2)}% (${coveredBranches}/${totalBranches})`);
  }
}
console.log('\n--- Lowest ---');