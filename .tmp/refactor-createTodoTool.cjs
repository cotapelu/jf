const fs = require('fs');
const path = 'src/extensions/tools/todos-tool.ts';
let content = fs.readFileSync(path, 'utf8');

// Preserve shebang if present
let shebang = '';
if (content.startsWith('#!')) {
  const newlineIdx = content.indexOf('\n');
  shebang = content.substring(0, newlineIdx + 1);
  content = content.substring(newlineIdx + 1);
}

// Parse AST
const parser = require('@typescript-eslint/parser');
const ast = parser.parseForESLint(content, { ecmaVersion: 2020, sourceType: 'module', ts: true });

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

const func = findFunction('createTodoTool');
if (!func) {
  console.error('createTodoTool not found');
  process.exit(1);
}
const { start, end } = func.range;

// New function code (without leading shebang)
const newCode = String.raw`
const BASE_TODO_TOOL: any = {
  name: 'todos',
  label: 'Todo',
  description: 'Complete todo management: add_phase, add_task, update, remove_task, delete, list. Auto-normalizes ONE in_progress task. Persists to ' + CONFIG_DIR_NAME + '/agent/todos.json. add_task accepts phase name or ID. update supports batch update via ids array.',
  promptSnippet: 'todos({ OPERATION: {...} }). All params are OBJECTS (not JSON strings). Ops: add_phase, add_task, update, remove_task, delete, list.',
  promptGuidelines: [
    "RULE: Operation is the KEY. todos({ OPERATION: params }), NOT { operation: name, params: {...} }",
    "",
    "TEMPLATES:",
    "• add_phase: todos({ add_phase: { name: 'Phase', tasks: [{ content: 'Task' }] } })",
    "• add_task:  todos({ add_task: { phase: 'phase-1', content: 'Task' } })",
    "  ⚠️ phase must be ID (phase-1), NOT name",
    "• update:    todos({ update: { id: 'task-5', status: 'in_progress' } })",
    "  Batch:    todos({ update: { ids: ['task-1','task-2'], status: 'completed' } })",
    "  status: pending|in_progress|completed|abandoned",
    "• remove_task: todos({ remove_task: { id: 'task-3' } })",
    "• delete: todos({ delete: {} })",
    "• list: todos({ list: {} })",
    "",
    "AUTO-RULES:",
    "• Only ONE task can be 'in_progress' (auto-normalizes others to 'pending')",
    "• Data persists to " + CONFIG_DIR_NAME + "/agent/todos.json",
    "• Use 'details' field only for in_progress context (multiline)",
    "• Task IDs are auto: task-1, task-2... Find them by running todos({ list: {} })"
  ],
  parameters: {}
};

async function initializeSessionStorage(ctx: ExtensionContext): Promise<void> {
  const session = getSessionState(ctx);
  const release = await session.mutex.lock();
  try {
    const found = session.state.reconstructFromEntries(ctx.sessionManager.getBranch());
    if (!found) {
      const loaded = await session.state.loadFromFile(ctx.cwd);
      if (!loaded) session.state.setStorageType('memory');
    } else {
      session.state.setStorageType('session');
    }
  } finally {
    release();
  }
}

async function validateAndParseParams(params: any): Promise<{ p: TodosParams; parseErrors: string[]; valErrors: string[]; op: string | null }> {
  const parseErrors: string[] = [];
  let p: any;
  try {
    if (typeof params === 'string') params = JSON.parse(params);
    if (typeof params !== 'object' || params === null) throw new Error('object required');
    p = params;
  } catch (e: any) {
    parseErrors.push(e instanceof Error ? e.message : String(e));
    return { p: {} as any, parseErrors, valErrors: [], op: null };
  }
  let normErrors: string[] = [];
  try { p = normalizeParams(p) as TodosParams; } catch (e: any) { normErrors.push(e.message); }
  const valErrors: string[] = [];
  const opCount = countOperations(p);
  if (opCount === 0) valErrors.push('No operation specified. Use: add_phase, add_task, update, remove_task, delete, or list');
  if (opCount > 1) valErrors.push('Multiple operations detected. Use only ONE operation per call.');
  const opName = getOperationName(p);
  const op = opName === 'unknown' ? null : opName;
  if (!op) valErrors.push('No operation. Use: add_phase, add_task, update, remove_task, list');
  return { p, parseErrors: [...parseErrors, ...normErrors], valErrors, op };
}

async function saveStateIfNeeded(ctx: ExtensionContext, session: TodoSessionState, errors: string[]): Promise<void> {
  try {
    const filePath = getProjectTodoFilePath(ctx.cwd);
    await withFileMutationQueue(filePath, async () => { await session.state.saveToFile(ctx.cwd); });
    session.state.setStorageType('file');
  } catch (e: any) {
    errors.push('Save failed: ' + e.message);
    session.state.setStorageType('memory');
  }
}

async function sendSystemMessage(api: ExtensionAPI, op: string, summary: string): Promise<void> {
  try {
    await api.sendMessage({ customType: 'todo_update', content: '[System: Todo ' + op + '] ' + summary.split('\n')[0], display: false }, { triggerTurn: false });
  } catch {}
}

function makeResult(session: TodoSessionState, errors: string[]): any {
  const phases = session.state.getPhases();
  const summary = formatSummary(phases, errors);
  return { content: [{ type: 'text', text: summary }], details: { phases, storage: session.state.storageType, error: errors.length ? errors.join('; ') : undefined }, isError: errors.length > 0 };
}

function createTodoTool(api: ExtensionAPI): ToolDefinition<any, TodoToolDetails> {
  api.on('session_start', initializeSessionStorage);
  api.on('session_tree', initializeSessionStorage);
  return {
    ...BASE_TODO_TOOL,
    execute: async (toolCallId, params, _signal, _onUpdate, ctx) => {
      const session = getSessionState(ctx);
      const release = await session.mutex.lock();
      try {
        const { p, parseErrors, valErrors, op } = await validateAndParseParams(params);
        if (parseErrors.length || valErrors.length || !op) return makeResult(session, [...parseErrors, ...valErrors]);
        const { phases: newPhases, nextTaskId: newTid, nextPhaseId: newPid, errors: opErrors } = applyOp(session.state.phases, session.state.nextTaskId, session.state.nextPhaseId, p);
        session.state.phases = newPhases;
        session.state.nextTaskId = newTid;
        session.state.nextPhaseId = newPid;
        if (opErrors.length === 0 && op !== 'list') await saveStateIfNeeded(ctx, session, opErrors);
        const summary = formatSummary(session.state.getPhases(), opErrors);
        if (op && op !== 'list' && opErrors.length === 0) await sendSystemMessage(api, op, summary);
        return makeResult(session, opErrors);
      } finally { release(); }
    },
    renderCall: renderTodosCall,
    renderResult: renderTodosResult
  };
}
`;

// Replace function
const newContent = shebang + content.substring(0, start) + newCode + content.substring(end);
fs.writeFileSync(path, newContent, 'utf8');
console.log('createTodoTool refactored successfully');
