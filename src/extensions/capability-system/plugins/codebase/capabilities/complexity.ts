#!/usr/bin/env node
/**
 * codebase.complexity capability
 *
 * Computes code complexity metrics: cyclomatic complexity, Halstead metrics,
 * maintainability index, and other quality indicators for a file.
 */

import { Type } from "typebox";
import { promises as fs } from "fs";
import path, { join } from "path";
import { Worker } from "worker_threads";
import { fileURLToPath } from "url";

// __filename unused

// Simple walker
function walk(node: any, visitor: (n: any, parent?: any) => void, parent?: any) {
  if (!node || typeof node !== 'object') return;
  visitor(node, parent);
  for (const key in node) {
    if (node[key] && typeof node[key] === 'object') {
      if (Array.isArray(node[key])) {
        node[key].forEach((child: any) => walk(child, visitor, node));
      } else {
        walk(node[key], visitor, node);
      }
    }
  }
}

// Count decision points for cyclomatic complexity
function handleFunctionDecision(node: any): number {
  if (node.body) {
    return countDecisions(node.body);
  }
  return 0;
}

const DECISION_HANDLERS: Record<string, (node: any) => number> = {
  IfStatement: () => 1,
  ConditionalExpression: () => 1,
  SwitchStatement: (n: any) => Math.max(0, n.cases.length - 1),
  ForStatement: () => 1,
  WhileStatement: () => 1,
  DoWhileStatement: () => 1,
  LogicalExpression: (n: any) => (n.operator === '&&' || n.operator === '||') ? 1 : 0,
  CatchClause: () => 1,
  FunctionExpression: handleFunctionDecision,
  ArrowFunctionExpression: handleFunctionDecision,
  FunctionDeclaration: handleFunctionDecision,
};

function countForNode(node: any): number {
  const handler = DECISION_HANDLERS[node.type];
  return handler ? handler(node) : 0;
}

function countDecisions(node: any): number {
  let count = 0;
  walk(node, (n: any) => {
    count += countForNode(n);
  });
  return count;
}

// Collect operators and operands for Halstead metrics
const HALSTEAD_OPERATORS = ['=', '==', '===', '!=', '!==', '<', '>', '<=', '>=', '+', '-', '*', '/', '%', '&', '|', '^', '&&', '||', '!', '??', '?:', '=>', '...', '++', '--', '<<', '>>', '>>>'];
const HALSTEAD_KEYWORDS = ['if', 'else', 'switch', 'case', 'default', 'for', 'while', 'do', 'break', 'continue', 'return', 'throw', 'try', 'catch', 'finally', 'function', 'class', 'var', 'let', 'const', 'new', 'this', 'super', 'typeof', 'instanceof', 'void', 'delete', 'in', 'of', 'as', 'from', 'export', 'import', 'default', 'extends', 'implements', 'interface', 'type', 'enum', 'public', 'private', 'protected', 'static', 'readonly', 'abstract', 'async', 'await'];

interface HalsteadCounts {
  operators: Map<string, number>;
  operands: Map<string, number>;
}

function addOperator(counts: HalsteadCounts, op: string) {
  if (HALSTEAD_OPERATORS.includes(op) || HALSTEAD_KEYWORDS.includes(op)) {
    counts.operators.set(op, (counts.operators.get(op) || 0) + 1);
  }
}

function addOperand(counts: HalsteadCounts, operand: string) {
  if (operand && !['true', 'false', 'null', 'undefined'].includes(operand)) {
    counts.operands.set(operand, (counts.operands.get(operand) || 0) + 1);
  }
}

function handleCallExpression(node: any, counts: HalsteadCounts) {
  if (node.callee.type === 'Identifier') {
    addOperand(counts, node.callee.name);
  } else if (node.callee.type === 'MemberExpression') {
    if (node.callee.property.type === 'Identifier') {
      addOperand(counts, node.callee.property.name);
    }
  }
  node.arguments?.forEach((arg: any) => {
    if (arg.type === 'Identifier') addOperand(counts, arg.name);
  });
}

function handleVariableDeclarator(node: any, counts: HalsteadCounts) {
  if (node.id.type === 'Identifier') {
    addOperand(counts, node.id.name);
  }
}

function handleMemberExpression(node: any, counts: HalsteadCounts) {
  if (node.property.type === 'Identifier') {
    addOperand(counts, node.property.name);
  }
}

function handleLiteral(node: any, counts: HalsteadCounts) {
  const val = node.value !== undefined ? String(node.value) : '<template>';
  addOperand(counts, val);
}

const halsteadTypeHandlers: Record<string, (node: any, counts: HalsteadCounts) => void> = {
  CallExpression: handleCallExpression,
  VariableDeclarator: handleVariableDeclarator,
  MemberExpression: handleMemberExpression,
  Literal: handleLiteral,
  TemplateLiteral: handleLiteral,
};

function visitHalstead(node: any, counts: HalsteadCounts) {
  // Operators on current node
  if (node.operator) addOperator(counts, node.operator);
  // Operands in binary-like structures
  if (node.left?.type === 'Identifier') addOperand(counts, node.left.name);
  if (node.right?.type === 'Identifier') addOperand(counts, node.right.name);
  // Type-specific handling via map
  const handler = halsteadTypeHandlers[node.type];
  if (handler) handler(node, counts);
}

function collectHalstead(node: any, counts: HalsteadCounts) {
  walk(node, (n) => visitHalstead(n, counts));
}

// Halstead metrics calculations
function computeHalstead(counts: HalsteadCounts): any {
  const n1 = counts.operators.size;
  const n2 = counts.operands.size;
  let N1 = 0, N2 = 0;
  counts.operators.forEach(v => N1 += v);
  counts.operands.forEach(v => N2 += v);

  const vocabulary = n1 + n2;
  const length = N1 + N2;
  const volume = length * Math.log2(vocabulary) || 0;
  const difficulty = (n1 / 2) * (N2 / n2) || 0;
  const effort = difficulty * volume;
  const bugs = volume / 3000; // industry approximation

  return { n1, n2, N1, N2, vocabulary, length, volume, difficulty, effort, bugs };
}

// Maintainability Index (MI) calculation
// Original MI = 171 - 5.2 * ln(volume) - 0.23 * cyclomatic - 16.2 * ln(loc)
// We'll use simplified version per maintainability
function computeMaintainabilityIndex(volume: number, cyclomatic: number, lines: number): number {
  const lnVolume = Math.log(volume) || 0;
  const lnLoc = Math.log(lines) || 0;
  const raw = 171 - 5.2 * lnVolume - 0.23 * cyclomatic - 16.2 * lnLoc;
  // Clamp to 0-100 range
  return Math.max(0, Math.min(100, raw));
}

interface ComplexityResult {
  file: string;
  exists: boolean;
  language: "ts" | "tsx" | "js" | "jsx" | "unknown";
  lines: number;
  functions: number;
  cyclomatic: number;
  halstead: {
    volume: number;
    difficulty: number;
    effort: number;
    bugs: number;
  };
  maintainability: number;
  error?: string;
}

export const schema = Type.Object({
  file: Type.String({ description: "File path to analyze (relative to cwd)" })
});

function parseAST(content: string): any {
  // Run parser in a worker thread to avoid blocking the event loop on syntax errors
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const workerPath = path.join(__dirname, 'parserWorker.js');
  return new Promise((resolve, reject) => {
    const worker = new Worker(workerPath, { workerData: { content } });
    const timeout = setTimeout(() => {
      worker.terminate();
      reject(new Error('Parser timeout after 10000ms'));
    }, 10000);
    worker.on('message', (msg: any) => {
      clearTimeout(timeout);
      worker.terminate();
      if (msg.error) reject(new Error(msg.error));
      else resolve(msg.ast);
    });
    worker.on('error', (err) => {
      clearTimeout(timeout);
      worker.terminate();
      reject(new Error(String(err)));
    });
    worker.on('exit', (code) => {
      if (code !== 0 && !timeout) {
        reject(new Error(`Parser worker exited with code ${code}`));
      }
    });
  });
}

function countFunctionsAndCyclomatic(ast: any): { functions: number; cyclomatic: number } {
  let functions = 0;
  let cyclomatic = 0;
  walk(ast, (node: any) => {
    if (node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression') {
      functions++;
      cyclomatic++;
      if (node.body) {
        cyclomatic += countDecisions(node.body);
      }
    }
  });
  return { functions, cyclomatic };
}

function analyzeComplexity(file: string, language: "ts" | "tsx" | "js" | "jsx" | "unknown", lines: number, ast: any): ComplexityResult {
  const { functions, cyclomatic } = countFunctionsAndCyclomatic(ast);
  const halsteadCounts: HalsteadCounts = { operators: new Map(), operands: new Map() };
  collectHalstead(ast, halsteadCounts);
  const halstead = computeHalstead(halsteadCounts);
  const maintainability = computeMaintainabilityIndex(halstead.volume, cyclomatic, lines);
  return { file, exists: true, language, lines, functions, cyclomatic, halstead: { volume: halstead.volume, difficulty: halstead.difficulty, effort: halstead.effort, bugs: halstead.bugs }, maintainability: Math.round(maintainability * 10) / 10 };
}

/**
 * Computes code complexity metrics for a file.
 * @param params - Object with file path (relative to cwd).
 * @param ctx - Context with cwd.
 * @returns Promise with complexity metrics (Cyclomatic, Halstead, etc.).
 */
export async function execute(params: { file: string }, ctx: any): Promise<any> {
  const cwd = ctx.cwd || process.cwd();
  const filePath = join(cwd, params.file);
  try { await fs.access(filePath); } catch { return { content: [{ type: "text" as const, text: `File not found: ${params.file}` }], isError: true, details: { file: params.file, exists: false } }; }
  const content = await fs.readFile(filePath, "utf-8");
  const lines = content.split('\n').length;
  const language = detectLanguage(params.file);
  let ast;
  try { ast = await parseAST(content); } catch (err: any) { return { content: [{ type: "text" as const, text: `Parse error: ${err.message}` }], isError: true, details: { file: params.file, error: err.message } }; }
  const result = analyzeComplexity(params.file, language, lines, ast);
  const output = formatOutput(result);
  return { content: [{ type: "text" as const, text: output }], isError: false, details: result };
}

function detectLanguage(filename: string): "ts" | "tsx" | "js" | "jsx" | "unknown" {
  if (filename.endsWith('.tsx')) return 'tsx';
  if (filename.endsWith('.ts')) return 'ts';
  if (filename.endsWith('.jsx')) return 'jsx';
  if (filename.endsWith('.js')) return 'js';
  return 'unknown';
}

function formatOutput(r: ComplexityResult): string {
  return `
📄 File: ${r.file}
📏 Lines: ${r.lines}
🔤 Language: ${r.language}
📦 Functions: ${r.functions}

🌀 Cyclomatic Complexity: ${r.cyclomatic} (${complexityRating(r.cyclomatic)})

📊 Halstead Metrics:
   Volume: ${r.halstead.volume.toFixed(0)}
   Difficulty: ${r.halstead.difficulty.toFixed(0)}
   Effort: ${r.halstead.effort.toFixed(0)}
   Estimated Bugs: ${r.halstead.bugs.toFixed(3)}

🛠️ Maintainability Index: ${r.maintainability} (${miRating(r.maintainability)})
`.trim();
}

export function complexityRating(cc: number): string {
  if (cc <= 10) return 'Low (simple)';
  if (cc <= 20) return 'Moderate';
  if (cc <= 50) return 'High (complex)';
  return 'Very High (risky)';
}

export function miRating(mi: number): string {
  if (mi >= 85) return 'Excellent';
  if (mi >= 65) return 'Good';
  if (mi >= 40) return 'Fair';
  return 'Poor';
}
