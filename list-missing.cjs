const cov = require('./coverage/coverage-final.json');
const base = '/home/quangtynu/Qcoder/jf/';
const files = [
  base + 'src/extensions/tools/tool-template.ts',
  base + 'src/extensions/team/team-manager.ts',
  base + 'src/tools/indexer/ast-scanner.ts',
  base + 'src/extensions/tools/skill-reader.ts',
  base + 'src/extensions/capability-system/plugins/codebase/capabilities/complexity.ts',
];
for (const file of files) {
  const data = cov[file];
  if (!data || !data.b) {
    console.log(`${file} - no branch data`);
    continue;
  }
  console.log(`\n${file}`);
  for (const branchId in data.b) {
    const hits = data.b[branchId];
    if (!Array.isArray(hits) || hits.length < 2) continue;
    const [first, second] = hits;
    if ((first === 0 && second > 0) || (first > 0 && second === 0)) {
      const branchInfo = data.branchMap[branchId];
      const loc = branchInfo && branchInfo.loc ? branchInfo.loc : null;
      const line = loc ? loc.start.line : '?';
      const type = branchInfo ? branchInfo.type : '?';
      console.log(`  Line ${line} (${type}): hits=[${hits.join(',')}]`);
    }
  }
}
