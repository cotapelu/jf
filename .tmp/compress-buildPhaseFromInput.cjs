const fs = require('fs');
const path = 'src/extensions/tools/todos-tool.ts';
const code = fs.readFileSync(path, 'utf8');
const parser = require('@typescript-eslint/parser');
const ast = parser.parseForESLint(code, { ecmaVersion: 2020, sourceType: 'module', ts: true });

function findFunction(name, node = ast.ast) {
  if (!node) return null;
  if (node.type === 'FunctionDeclaration' && node.id && node.id.name === name) return node;
  for (const key of Object.keys(node)) {
    const child = node[key];
    if (Array.isArray(child)) {
      for (const item of child) {
        if (item && typeof item === 'object') {
          const found = findFunction(name, item);
          if (found) return found;
        }
      }
    } else if (child && typeof child === 'object') {
      const found = findFunction(name, child);
      if (found) return found;
    }
  }
  return null;
}

const funcNode = findFunction('buildPhaseFromInput');
if (!funcNode) { console.error('buildPhaseFromInput not found'); process.exit(1); }
const { start, end } = funcNode.range;

const newBody = `function buildPhaseFromInput(input: { name: string; tasks?: Array<{ content: string; status?: string; notes?: string; details?: string }> }, phaseId: string, nextTaskId: number): { phase: TodoPhase; nextTaskId: number } {
  const tasks: TodoItem[] = []; let tid = nextTaskId;
  for (const t of input.tasks ?? []) {
    let status: TodoStatus = 'pending';
    if (t.status && ['pending','in_progress','completed','abandoned'].includes(t.status)) status = t.status as TodoStatus;
    tasks.push({ id: \`task-\${tid++}\`, content: t.content, status, notes: t.notes, details: t.details });
  }
  return { phase: { id: phaseId, name: input.name, tasks }, nextTaskId: tid };
}`;

const newContent = code.substring(0, start) + newBody + code.substring(end);
fs.writeFileSync(path, newContent, 'utf8');
console.log('buildPhaseFromInput compressed');
