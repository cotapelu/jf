const cov = require('./coverage/coverage-final.json');
const results = [];

for (const file in cov) {
  // Only consider source files under src/
  if (!file.includes('/src/')) continue;
  const data = cov[file];
  if (!data.b) continue;
  for (const branchId in data.b) {
    const hits = data.b[branchId];
    if (!Array.isArray(hits) || hits.length < 2) continue;
    const [first, second] = hits;
    // If one is zero and the other >0, incomplete
    if ((first === 0 && second > 0) || (first > 0 && second === 0)) {
      const branchInfo = data.branchMap[branchId];
      const loc = branchInfo && branchInfo.loc ? branchInfo.loc : null;
      const line = loc ? loc.start.line : '?';
      results.push({
        file,
        line,
        type: branchInfo ? branchInfo.type : '?',
        hits: hits,
        id: branchId
      });
    }
  }
}

// Sort by file, line
results.sort((a,b) => a.file.localeCompare(b.file) || a.line - b.line);

// Print top missing branches per file (maybe first few)
const byFile = new Map();
for (const r of results) {
  if (!byFile.has(r.file)) byFile.set(r.file, []);
  byFile.get(r.file).push(r);
}

console.log(`\nFiles with incomplete branches (total ${results.length} branch points):\n`);
for (const [file, branches] of byFile) {
  // Count total missing arcs (where hit=0)
  const totalMissing = branches.reduce((sum, b) => sum + (b.hits[0]===0?1:0) + (b.hits[1]===0?1:0) - (b.hits[0]===0 && b.hits[1]===0 ? 2 : 0), 0);
  console.log(`${file} (${branches.length} branch points, ~${totalMissing} missing arcs)`);
  // Show first few
  for (const b of branches.slice(0, 3)) {
    console.log(`  Line ${b.line}: type=${b.type} hits=[${b.hits.join(',')}]`);
  }
  if (branches.length > 3) console.log(`  ... and ${branches.length-3} more`);
}
console.log(`\nTotal files: ${byFile.size}`);
