const cov = require('../coverage/coverage-final.json');
const results = [];
for (const [file, data] of Object.entries(cov)) {
  if (!data.b) continue;
  let covered = 0, total = 0;
  // data.b is an object: branchId -> [covered, total]? Actually c8 format: data.b is array? Let's inspect one.
  // In c8 nyc format, data.b is an array where each element is [covered, total] for a branch region.
  // But here data.b appears to be an object with numeric keys. Actually from safe_edit, it was object.
  // We can sum over values regardless.
  for (const val of Object.values(data.b)) {
    if (Array.isArray(val) && val.length >= 2) {
      covered += val[0];
      total += val[1];
    }
  }
  if (total > 0) {
    results.push({ file: file.replace(/^.*jf\//, ''), covered, total, pct: (covered / total * 100).toFixed(2) });
  }
}
results.sort((a, b) => parseFloat(a.pct) - parseFloat(b.pct));
console.log('Branch coverage per file (lowest):');
results.filter(r => parseFloat(r.pct) < 85).forEach(r => {
  console.log(`${r.file}: ${r.pct}% (${r.covered}/${r.total})`);
});
