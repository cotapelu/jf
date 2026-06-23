const cov = require('../coverage/coverage-final.json');

function isBranchCovered(hits) {
  // hits is an array of numbers; branch is covered if all hits > 0
  return Array.isArray(hits) && hits.every(h => h > 0);
}

const entries = Object.entries(cov)
  .filter(([path]) => path.endsWith('.ts') && !path.includes('node_modules'))
  .map(([path, data]) => {
    const branchHits = data.b || {};
    const totalBranches = Object.keys(branchHits).length;
    const coveredBranches = Object.values(branchHits).filter(isBranchCovered).length;
    const percent = totalBranches > 0 ? (coveredBranches / totalBranches) * 100 : 0;
    return { 
      path, 
      total: totalBranches, 
      covered: coveredBranches, 
      percent,
      uncovered: totalBranches - coveredBranches
    };
  })
  .filter(f => f.total >= 5) // at least 5 branches to matter
  .sort((a, b) => a.percent - b.percent); // ascending by coverage

console.log('Files with lowest branch coverage:');
console.table(entries.slice(0, 20));
console.log(`\nTotal files with >=5 branches: ${entries.length}`);
const totalBranchesAll = entries.reduce((sum, f) => sum + f.total, 0);
const totalCoveredAll = entries.reduce((sum, f) => sum + f.covered, 0);
console.log(`Overall branches: ${totalCoveredAll}/${totalBranchesAll} = ${(totalCoveredAll/totalBranchesAll*100).toFixed(2)}%`);
