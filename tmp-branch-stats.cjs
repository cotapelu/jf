const cov = require('./coverage/coverage-final.json');
const fileStats = [];
for (const file in cov) {
  const data = cov[file];
  if (data.b) {
    let totalArcs = 0;
    let hitArcs = 0;
    for (const key in data.b) {
      const arr = data.b[key];
      totalArcs += 2; // two arcs per branch point
      if (arr[0] > 0) hitArcs++;
      if (arr[1] > 0) hitArcs++;
    }
    if (totalArcs > 0) {
      fileStats.push({ file, total: totalArcs, hits: hitArcs, pct: (hitArcs*100/totalArcs).toFixed(2) });
    }
  }
}
// sort by total arcs descending
fileStats.sort((a,b) => b.total - a.total);
console.log('Top files by branch count:');
console.table(fileStats.slice(0,20));
// also sort by lowest pct
fileStats.sort((a,b) => parseFloat(a.pct) - parseFloat(b.pct));
console.log('\nLowest coverage files:');
console.table(fileStats.slice(0,20));
