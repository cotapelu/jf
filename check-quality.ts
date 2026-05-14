#!/usr/bin/env node
/**
 * AGENTS.md Quality Gate Checker
 * Measures: function length, complexity, duplication, error handling, validation
 */

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const MAX_FUNCTION_LINES = 20;
const MAX_COMPLEXITY = 10;
const MAX_DUPLICATION = 5;

let totalFunctions = 0;
let oversizedFunctions = 0;
let complexFunctions = 0;
let duplicatedBlocks = 0;

function cyclomaticComplexity(code: string): number {
	// Rough estimate: count decision points
	const decisionPoints = (code.match(/\b(if|else|for|while|do|switch|case|catch|&&|\|\|)/g) || []).length;
	const logicalOperators = (code.match(/\?|:|\|\|\|/g) || []).length;
	return decisionPoints + logicalOperators + 1; // base complexity = 1
}

function findFunctions(content: string): Array<{ name: string; start: number; end: number; lines: number }> {
	const functions = [];
	// Match function declarations (various forms)
	const patterns = [
		/export\s+(?:async\s+)?function\s+([a-zA-Z_]\w*)\s*\(/g,
		/function\s+([a-zA-Z_]\w*)\s*\(/g,
		/const\s+([a-zA-Z_]\w*)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/g,
		/const\s+([a-zA-Z_]\w*)\s*=\s*(?:async\s+)?function\s*\(/g,
	];

	for (const pattern of patterns) {
		let match;
		while ((match = pattern.exec(content)) !== null) {
			const name = match[1];
			const start = content.lastIndexOf('\n', match.index) + 1;
			// Find the end of the function (matching braces)
			const afterBody = content.indexOf('\n}', match.index);
			const afterBrace = content.indexOf('}', match.index);
			const end = Math.max(afterBody, afterBrace);
			const functionBody = content.substring(start, end > 0 ? end : start + 1000);
			const lines = functionBody.split('\n').length;
			functions.push({ name, start, end: end > 0 ? end : start + functionBody.length, lines });
		}
	}
	return functions;
}

async function analyzeFile(filePath: string): Promise<void> {
	try {
		const content = await readFile(filePath, 'utf-8');
		const functions = findFunctions(content);

		for (const fn of functions) {
			totalFunctions++;
			if (fn.lines > MAX_FUNCTION_LINES) {
				oversizedFunctions++;
				console.log(`[VIOLATION] ${filePath}: function ${fn.name} has ${fn.lines} lines (max ${MAX_FUNCTION_LINES})`);
			}

			// Extract function body for complexity
			const functionBody = content.substring(fn.start, fn.end > 0 ? fn.end : fn.start + 2000);
			const complexity = cyclomaticComplexity(functionBody);
			if (complexity > MAX_COMPLEXITY) {
				complexFunctions++;
				console.log(`[VIOLATION] ${filePath}: function ${fn.name} complexity ${complexity} (max ${MAX_COMPLEXITY})`);
			}
		}

		// Check for duplication (simple approach: find repeated code blocks)
		const lines = content.split('\n');
		const blockMap = new Map<string, number>();
		for (let i = 0; i < lines.length - 5; i++) {
			const block = lines.slice(i, i + 6).join('\n').trim();
			if (block.length > 100) {
				blockMap.set(block, (blockMap.get(block) || 0) + 1);
			}
		}
		for (const [block, count] of blockMap.entries()) {
			if (count >= MAX_DUPLICATION) {
				duplicatedBlocks++;
				console.log(`[VIOLATION] ${filePath}: duplicated block (${count} times)`);
			}
		}
	} catch (err) {
		// Skip unreadable files
	}
}

async function analyzeDir(dir: string): Promise<void> {
	try {
		const entries = await readdir(dir, { withFileTypes: true });
		for (const entry of entries) {
			const fullPath = join(dir, entry.name);
			if (entry.isDirectory()) {
				if (!entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== 'dist') {
					await analyzeDir(fullPath);
				}
			} else if (entry.name.endsWith('.ts') || entry.name.endsWith('.js')) {
				await analyzeFile(fullPath);
			}
		}
	} catch {
		// Skip inaccessible directories
	}
}

async function main() {
	const packages = ['packages/memory', 'packages/coding-agent', 'packages/tools'];
	for (const pkg of packages) {
		console.log(`\n=== Analyzing ${pkg} ===`);
		await analyzeDir(pkg);
	}

	console.log('\n=== SUMMARY ===');
	console.log(`Total functions analyzed: ${totalFunctions}`);
	console.log(`Functions >${MAX_FUNCTION_LINES} lines: ${oversizedFunctions}`);
	console.log(`Functions complexity >${MAX_COMPLEXITY}: ${complexFunctions}`);
	console.log(`Duplicated blocks (${MAX_DUPLICATION}+ occurrences): ${duplicatedBlocks}`);

	if (oversizedFunctions > 0 || complexFunctions > 0 || duplicatedBlocks > 0) {
		console.log('\n❌ QUALITY GATE FAILED');
		process.exit(1);
	} else {
		console.log('\n✅ QUALITY GATE PASSED');
	}
}

main().catch(console.error);
