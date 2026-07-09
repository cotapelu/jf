const cov = require('../coverage/coverage-final.json');
const target = '/home/quangtynu/Qcoder/jf/src/extensions/capability-system/plugins/codebase/capabilities/analyze.ts';
const data = cov[target];
if (!data) {
  console.log('No data for', target);
  process.exit(0);
}
const b = data.b;
const branchMap = data.branchMap;
let uncovered = [];
for (const key in branchMap) {
  const takenCounts = b[key];
  if (takenCounts && takenCounts.every(t => t === 0)) {
    const loc = branchMap[key].loc;
    const type = branchMap[key].type;
    uncovered.push({ line: loc.start.line, type });
  }
}
uncovered.sort((a,b) => a.line - b.line);
console.log(`Uncovered branches in analyze.ts (${uncovered.length} remaining):`);
for (const u of uncovered) {
  console.log(`  Line ${u.line}: ${u.type}`);
}