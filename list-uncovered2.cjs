const cov = require('./coverage/coverage-final.json');
// Find skill-reader path
let skillReaderPath = null;
for (const p in cov) {
  if (p.endsWith('skill-reader.ts')) {
    skillReaderPath = p;
    break;
  }
}
if (!skillReaderPath) {
  console.log('skill-reader.ts not found in coverage');
  process.exit(0);
}
const data = cov[skillReaderPath];
console.log(`\n=== ${skillReaderPath} ===`);
const totalBranches = Object.keys(data.b || {}).length;
console.log(`Total branches: ${totalBranches}`);
const uncovered = [];
for (const [branchId, entry] of Object.entries(data.b)) {
  const locs = entry.s; // Actually in coverage JSON, branch entry has s (source) and f? Let's check structure. In sample earlier: "b":{"0":[18,8]}, where [covered_hits, total_hits?]. I think it's [hitCount, null?]. Actually v8 coverage format: branch is array [covered, total]? In earlier parsing, for branch 4 we had [9,1] meaning covered=9, total=10? Actually the array length can be 2 or more? I recall v8 coverage: branch is [covered_count, total_count]? But it's an array where first element is hit count? Actually in the sample: "b":{"4":[9,1]}, I think that means 9 out of 1? That seems odd. Let's look at actual I saw earlier: "b":{"0":[18,8]} - that might mean 18 hits out of 8? Hmm. Let's just use entry[0] to see if covered.
  // In v8 coverage format: branch is an array; first element is number of times the first location (true) was hit, second is second location (false), sometimes third for switch.
  // But easier: if entry[0] > 0 then first branch covered; for overall branch coverage, the tool sums. For our purpose, we want to know if any location in this branch has zero hits. Typically if entry[0]===0 then the first path (true) wasn't hit; if entry[1]===0 then false not hit. So a branch is considered covered if all its locations are hit at least once.
  // In the coverage summary, a branch is counted as covered if all locations are hit? Actually vitest/istanbul counts a branch as covered if at least one path was taken? That's ambiguous. But the line numbers given in the summary are where branches exist that have at least one missing path.
  // So we need to identify which branches have any zero count.
  const hasZero = entry.some((count: number) => count === 0);
  if (hasZero) {
    const line = data.b[branchId].loc.start.line;
    uncovered.push(`branch ${branchId} line ${line} (counts: ${entry.join(',')})`);
  }
}
const covered = totalBranches - uncovered.length;
console.log(`Branch coverage: ${covered}/${totalBranches} (${((covered/totalBranches)*100).toFixed(2)}%)`);
console.log(`Uncovered branches (${uncovered.length}):`, uncovered.join('; '));