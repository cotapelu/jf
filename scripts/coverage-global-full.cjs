const cov = require('../coverage/coverage-final.json');
let totalBranches = 0, coveredBranches = 0;
let fileCount = 0;
for (const file in cov) {
  const data = cov[file];
  if (!data.branchMap || !data.b) continue;
  fileCount++;
  const branchMap = data.branchMap;
  const takenMap = data.b;
  for (const key in branchMap) {
    totalBranches++;
    const taken = takenMap[key];
    if (taken && taken.some(t => t > 0)) coveredBranches++;
  }
}
console.log(`Files with branchMap: ${fileCount}`);
console.log(`Total branches: ${totalBranches}, Covered: ${coveredBranches}, Uncovered: ${totalBranches - coveredBranches}, %: ${((coveredBranches/totalBranches)*100).toFixed(2)}%`);