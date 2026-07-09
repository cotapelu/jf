const fs = require('fs');
const cov = require('../coverage/coverage-final.json');
const target = '/home/quangtynu/Qcoder/jf/src/extensions/tools/bash-actions.ts';
const data = cov[target];
const lines = fs.readFileSync(target, 'utf-8').split('\n');
const uncovered = [];
for (const key in data.branchMap) {
  const locs = data.branchMap[key].locations;
  const taken = data.b[key] || [];
  for (let i = 0; i < locs.length; i++) {
    if (!taken[i] || taken[i] === 0) {
      const lineNum = locs[i].start.line;
      const code = lines[lineNum-1] || '';
      uncovered.push({ line: lineNum, code: code.trim(), type: data.branchMap[key].type });
    }
  }
}
uncovered.sort((a,b) => a.line - b.line);
console.log(`Uncovered branches in bash-actions.ts (${uncovered.length}):\n`);
for (const u of uncovered) {
  console.log(`  ${String(u.line).padStart(4)}: ${u.code.substring(0, 90)}`);
}