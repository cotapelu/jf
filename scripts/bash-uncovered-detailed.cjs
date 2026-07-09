const cov = require('../coverage/coverage-final.json');
const target = '/home/quangtynu/Qcoder/jf/src/extensions/tools/bash-actions.ts';
const data = cov[target];
if (!data) { console.log('No coverage data for', target); process.exit(0); }
const branchMap = data.branchMap;
const b = data.b;
let totalLocs = 0, coveredLocs = 0;
const uncovered = [];
for (const key in branchMap) {
  const locs = branchMap[key].locations;
  const taken = b[key] || [];
  for (let i = 0; i < locs.length; i++) {
    totalLocs++;
    if (taken[i] && taken[i] > 0) {
      coveredLocs++;
    } else {
      uncovered.push({ line: locs[i].start.line, type: branchMap[key].type });
    }
  }
}
uncovered.sort((a,b) => a.line - b.line);
console.log(`bash-actions.ts locations: total=${totalLocs}, covered=${coveredLocs}, uncovered=${totalLocs - coveredLocs} (${((coveredLocs/totalLocs)*100).toFixed(2)}% coverage)`);
console.log('Uncovered by line:');
for (const u of uncovered) {
  console.log(`  Line ${u.line}: ${u.type}`);
}