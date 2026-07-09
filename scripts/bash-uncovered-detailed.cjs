const cov = require('../coverage/coverage-final.json');
const target = '/home/quangtynu/Qcoder/jf/src/extensions/tools/bash-actions.ts';
const data = cov[target];
if (!data) { console.log('No coverage data for', target); process.exit(0); }
let totalLocs = 0, coveredLocs = 0;
for (const key in data.branchMap) {
  const locs = data.branchMap[key].locations;
  const taken = data.b[key] || [];
  for (let i = 0; i < locs.length; i++) {
    totalLocs++;
    if (taken[i] && taken[i] > 0) coveredLocs++;
  }
}
console.log(`bash-actions.ts: total=${totalLocs}, covered=${coveredLocs}, uncovered=${totalLocs-coveredLocs} (${((coveredLocs/totalLocs)*100).toFixed(2)}% coverage)`);