const cov = require('../coverage/coverage-final.json');
const fileStats = {};
let totalLocations = 0, coveredLocations = 0;
for (const file in cov) {
  const data = cov[file];
  if (!data.branchMap || !data.b) continue;
  const branchMap = data.branchMap;
  const takenMap = data.b;
  let fileTotal = 0, fileCovered = 0;
  for (const key in branchMap) {
    const locs = branchMap[key].locations;
    const taken = takenMap[key] || [];
    for (let i = 0; i < locs.length; i++) {
      fileTotal++;
      totalLocations++;
      if (taken[i] && taken[i] > 0) {
        fileCovered++;
        coveredLocations++;
      }
    }
  }
  if (fileTotal > fileCovered) {
    fileStats[file] = { covered: fileCovered, total: fileTotal, unc: fileTotal - fileCovered, pct: ((fileCovered/fileTotal)*100).toFixed(2) };
  }
}
const totalUnc = totalLocations - coveredLocations;
console.log(`Total branch locations: ${totalLocations}, Covered: ${coveredLocations}, Uncovered: ${totalUnc}, Global %: ${((coveredLocations/totalLocations)*100).toFixed(2)}%`);
console.log('\nTop files by uncovered locations:');
const sorted = Object.entries(fileStats).sort((a,b)=>b[1].unc - a[1].unc);
for (const [file, stats] of sorted.slice(0, 15)) {
  const name = file.split('/').pop();
  console.log(`${name.padEnd(30)} | ${String(stats.covered).padStart(4)} | ${String(stats.total).padStart(5)} | ${String(stats.unc).padStart(5)} | ${stats.pct}%`);
}