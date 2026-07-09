const cov = require('../coverage/coverage-final.json');
const target = '/home/quangtynu/Qcoder/jf/src/extensions/tools/bash-actions.ts';
const data = cov[target];
if (!data) {
  console.log('No data for', target);
  process.exit(0);
}
const b = data.b;
const branchMap = data.branchMap;
console.log(`Uncovered branches in ${target.split('/').pop()}:`);
for (const key in branchMap) {
  const takenCounts = b[key];
  if (takenCounts && takenCounts.every(t => t === 0)) {
    const loc = branchMap[key].loc;
    const type = branchMap[key].type;
    console.log(`  Line ${loc.start.line}: ${type}`);
  }
}
console.log(`\nTotal branches: ${Object.keys(branchMap).length}, Covered: ${Object.keys(branchMap).length - Object.values(branchMap).filter((_, key) => b[key].every(t=>t===0)).length}, Uncovered: ${Object.values(branchMap).filter((_, key) => b[key].every(t=>t===0)).length}`);