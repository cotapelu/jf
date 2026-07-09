const cov = require('../coverage/coverage-final.json');
function analyze(file) {
  const data = cov[file];
  if (!data || !data.branchMap || !data.b) return null;
  const branchMap = data.branchMap;
  const b = data.b;
  const uncovered = [];
  for (const key in branchMap) {
    const locs = branchMap[key].locations;
    const taken = b[key] || [];
    for (let i = 0; i < locs.length; i++) {
      if (!taken[i] || taken[i] === 0) {
        uncovered.push({ line: locs[i].start.line, type: branchMap[key].type });
      }
    }
  }
  uncovered.sort((a,b) => a.line - b.line);
  return { file: file.split('/').pop(), uncovered };
}
const targets = [
  '/home/quangtynu/Qcoder/jf/src/extensions/tools/bash-actions.ts',
  '/home/quangtynu/Qcoder/jf/src/extensions/capability-system/plugins/codebase/capabilities/ast_query.ts',
  '/home/quangtynu/Qcoder/jf/src/extensions/capability-system/plugins/codebase/capabilities/analyze_ast.ts',
  '/home/quangtynu/Qcoder/jf/src/extensions/capability-system/plugins/codebase/capabilities/dependency_tree.ts',
  '/home/quangtynu/Qcoder/jf/src/extensions/team/team-manager.ts',
  '/home/quangtynu/Qcoder/jf/src/extensions/capability-system/plugins/codebase/capabilities/call_graph.ts',
  '/home/quangtynu/Qcoder/jf/src/extensions/capability-system/plugins/codebase/capabilities/analyze.ts',
  '/home/quangtynu/Qcoder/jf/src/extensions/capability-system/plugins/codebase/capabilities/command-executor.ts',
  '/home/quangtynu/Qcoder/jf/src/extensions/capability-system/plugins/codebase/capabilities/complexity.ts',
  '/home/quangtynu/Qcoder/jf/src/extensions/tools/tool-template.ts'
];
for (const t of targets) {
  const res = analyze(t);
  if (res) {
    console.log(`${res.file}: ${res.uncovered.length} uncovered locations`);
    if (res.uncovered.length > 0) {
      console.log('  Sample lines:', res.uncovered.slice(0,5).map(u => u.line).join(', '));
    }
  }
}