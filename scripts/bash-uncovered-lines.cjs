const cov = require('../coverage/coverage-final.json');
const target = '/home/quangtynu/Qcoder/jf/src/extensions/tools/bash-actions.ts';
const data = cov[target];
if (!data) {
  console.log('No coverage for', target);
  process.exit(0);
}
const branchMap = data.branchMap;
const b = data.b;
const uncovered = [];
for (const key in branchMap) {
  const taken = b[key];
  if (taken && taken.some(t => t > 0)) continue;
  const loc = branchMap[key].loc;
  uncovered.push({ line: loc.start.line, type: branchMap[key].type });
}
uncovered.sort((a,b) => a.line - b.line);
console.log(`Uncovered branch locations in bash-actions.ts (${uncovered.length}):`);
for (const u of uncovered) {
  console.log(`  Line ${u.line}: ${u.type}`);
}