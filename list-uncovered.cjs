const cov = require('./coverage/coverage-final.json');
const cwd = process.cwd();
const targetFiles = [
  `${cwd}/src/extensions/tools/skill-reader.ts`,
  `${cwd}/src/extensions/capability-system/plugins/codebase/capabilities/safe_edit.ts`,
  `${cwd}/src/extensions/capability-system/plugins/codebase/capabilities/complexity.ts`,
  `${cwd}/src/extensions/capability-system/plugins/codebase/capabilities/dependency_tree.ts`,
  `${cwd}/src/extensions/team/team-manager.ts`,
  `${cwd}/src/tools/session/manager.ts`
];

for (const file of targetFiles) {
  const data = cov[file];
  if (!data) {
    console.log(`\n=== ${file} not in coverage ===`);
    continue;
  }
  console.log(`\n=== ${file} ===`);
  const totalBranches = Object.keys(data.b || {}).length;
  if (totalBranches === 0) {
    console.log('No branch data');
    continue;
  }
  const uncovered = [];
  for (const [branchId, locs] of Object.entries(data.b)) {
    if (locs[0] === 0) {
      const line = data.b[branchId].loc.start.line;
      uncovered.push(`branch ${branchId} line ${line}`);
    }
  }
  const covered = totalBranches - uncovered.length;
  console.log(`Branch coverage: ${covered}/${totalBranches} (${((covered/totalBranches)*100).toFixed(2)}%)`);
  console.log(`Uncovered branches (${uncovered.length}):`, uncovered.join(', '));
}
