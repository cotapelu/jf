const cov = require('../coverage/coverage-final.json');
const target = '/home/quangtynu/Qcoder/jf/src/extensions/capability-system/plugins/codebase/capabilities/ast_query.ts';
const data = cov[target];
if (!data) { console.log('No coverage data for', target); process.exit(0); }
const branchMap = data.branchMap;
const b = data.b;
const uncovered = [];
for (const key in branchMap) {
  const locs = branchMap[key].locations;
  const taken = b[key] || [];
  for (let i = 0; i < locs.length; i++) {
    if (!taken[i] || taken[i] === 0) {
      uncovered.push({ line: locs[i].start.line, type: branchMap[key].type });
    }
  }
}
uncovered.sort((a,b) => a.line - b.line);
const totalLocs = Object.values(branchMap).reduce((sum, v) => sum + v.locations.length, 0);
console.log(`ast_query.ts total locations: ${totalLocs}`);
console.log(`Uncovered locations (${uncovered.length}):`);
for (const u of uncovered) {
  console.log(`  Line ${u.line}: ${u.type}`);
}