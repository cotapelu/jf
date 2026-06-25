const cov = require('./coverage/coverage-final.json');
const results = [];
for (const file in cov) {
  const data = cov[file];
  const totalStatements = Object.keys(data.s || {}).length;
  const coveredStatements = Object.values(data.s).filter(v => v > 0).length;
  const totalBranches = data.b ? Object.keys(data.b).length : 0;
  const coveredBranches = data.b ? Object.values(data.b).filter(arr => arr[0] > 0).length : 0;
  const totalFunctions = data.f ? Object.keys(data.f).length : 0;
  const coveredFunctions = data.f ? Object.values(data.f).filter(v => v > 0).length : 0;
  const totalLines = Object.keys(data.l || {}).length;
  const coveredLines = data.l ? Object.values(data.l).filter(v => v > 0).length : 0;

  const stmtPct = ((coveredStatements / totalStatements) * 100).toFixed(2);
  const branchPct = totalBranches ? ((coveredBranches / totalBranches) * 100).toFixed(2) : '100.00';
  const funcPct = ((coveredFunctions / totalFunctions) * 100).toFixed(2);
  const linePct = ((coveredLines / totalLines) * 100).toFixed(2);

  results.push({
    file: file.replace(/^\.\/|^\/home[^/]+\/[^/]+\//, ''),
    stmt: parseFloat(stmtPct),
    branch: parseFloat(branchPct),
    func: parseFloat(funcPct),
    line: parseFloat(linePct),
    branches: { covered: coveredBranches, total: totalBranches }
  });
}

// Sort by branch % ascending (lowest first), then by total branches descending (more impactful)
results.sort((a, b) => {
  if (a.branch !== b.branch) return a.branch - b.branch;
  return b.branches.total - a.branches.total;
});

console.log('=== LOWEST BRANCH COVERAGE MODULES (need improvement) ===');
console.log('');
console.log('File'.padEnd(50), 'Branch%'.padEnd(10), 'Covered/Total'.padEnd(15), 'Priority (low branch% + many branches)');
console.log('-'.repeat(80));
results.filter(r => r.branch < 85 && r.branches.total >= 2).slice(0, 15).forEach(r => {
  const priority = (100 - r.branch) * r.branches.total / 10;
  console.log(
    r.file.substring(0, 49).padEnd(50),
    r.branch.toFixed(2).padEnd(10),
    `${r.branches.covered}/${r.branches.total}`.padEnd(15),
    priority.toFixed(1)
  );
});

console.log('\n=== CURRENT GLOBAL ===');
const globalStmts = results.reduce((sum, r) => sum + r.stmt * Object.keys(cov[r.file].s || {}).length, 0);
const globalStmtTotal = results.reduce((sum, r) => sum + Object.keys(cov[r.file].s || {}).length, 0);
const globalBranches = results.reduce((sum, r) => sum + r.branch * (r.branches.total || 0), 0);
const globalBranchTotal = results.reduce((sum, r) => sum + (r.branches.total || 0), 0);
const globalFuncs = results.reduce((sum, r) => sum + r.func * Object.keys(cov[r.file].f || {}).length, 0);
const globalFuncTotal = results.reduce((sum, r) => sum + Object.keys(cov[r.file].f || {}).length, 0);
const globalLines = results.reduce((sum, r) => sum + r.line * Object.keys(cov[r.file].l || {}).length, 0);
const globalLineTotal = results.reduce((sum, r) => sum + Object.keys(cov[r.file].l || {}).length, 0);

console.log(`Statements: ${(globalStmts/globalStmtTotal).toFixed(2)}% (${Math.round(globalStmts)}/${globalStmtTotal})`);
console.log(`Branches: ${(globalBranches/globalBranchTotal).toFixed(2)}% (${Math.round(globalBranches)}/${globalBranchTotal})`);
console.log(`Functions: ${(globalFuncs/globalFuncTotal).toFixed(2)}% (${Math.round(globalFuncs)}/${globalFuncTotal})`);
console.log(`Lines: ${(globalLines/globalLineTotal).toFixed(2)}% (${Math.round(globalLines)}/${globalLineTotal})`);