const cov = require('../coverage/coverage-final.json');
const entries = Object.entries(cov)
  .filter(([path]) => path.endsWith('.ts') || path.endsWith('.js'))
  .map(([path, data]) => {
    const totalBranches = data.branchMap ? Object.keys(data.branchMap).length : 0;
    const coveredBranches = data.branchMap 
      ? Object.values(data.branchMap).filter(hits => hits >= 0).length 
      : 0;
    const percent = totalBranches > 0 ? ((coveredBranches / totalBranches) * 100).toFixed(2) : '0.00';
    return { path, total: totalBranches, covered: coveredBranches, percent: parseFloat(percent) };
  })
  .filter(f => f.total >= 10) // files with at least 10 branches
  .sort((a, b) => a.percent - b.percent); // ascending

console.log('Files with lowest branch coverage (≥10 branches):');
console.table(entries.slice(0, 15));
console.log(`\nOverall: ${entries.reduce((acc, f) => acc + f.total, 0)} total branches, ${entries.reduce((acc, f) => acc + f.covered, 0)} covered.`);
