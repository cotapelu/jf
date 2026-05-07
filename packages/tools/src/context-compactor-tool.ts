/**
 * Context Compactor Tool for LLM
 *
 * Automatically compacts context (code, chat messages) to fit within token limits.
 * Features:
 * - Token counting (rough estimate: 1 token ≈ 4 chars)
 * - Heuristic removal: comments, whitespace, tests, docs, examples
 * - File dropping based on importance heuristics
 * - Optional LLM-based summarization for large files
 *
 * Usage:
 *   import { contextCompact } from '@quangtynu/pi-tools/context-compactor'
 *   const result = await contextCompact({ type: 'directory', path: './src', tokenLimit: 128000 })
 */

import * as fs from "fs";
import * as path from "path";

// ============ Types ============

export interface ChatMessage {
	role: "system" | "user" | "assistant";
	content: string;
}

export interface CompactOptions {
	/** Maximum tokens allowed (default: 128000) */
	tokenLimit?: number;
	/** Drop test files (.test., .spec.) (default: true) */
	dropTests?: boolean;
	/** Drop documentation files (.md, README, CHANGELOG) (default: true) */
	dropDocs?: boolean;
	/** Drop example files/directories (default: true) */
	dropExamples?: boolean;
	/** Drop type definition files (.d.ts) (default: false) */
	dropTypes?: boolean;
	/** Remove comments from code (default: true) */
	removeComments?: boolean;
	/** Trim excessive whitespace (default: true) */
	trimWhitespace?: boolean;
	/** Use LLM to summarize large files (requires API key) (default: false) */
	useLLM?: boolean;
	/** LLM API key (OpenAI or Anthropic) */
	apiKey?: string;
	/** LLM provider: 'openai' | 'anthropic' (default: 'openai') */
	llmProvider?: "openai" | "anthropic";
	/** Model for summarization (default: 'gpt-4-turbo') */
	llmModel?: string;
	/** Max file size (in tokens) before using LLM summarization (default: 5000) */
	maxFileTokensForHeuristic?: number;
	/** Verbose logging */
	verbose?: boolean;
	/** Number of recent messages to always keep (default: 8) */
	keepRecent?: number;
	/** Token target per message when LLM summarizing (default: auto) */
	maxTokensPerMessage?: number;
}

export interface CompactResult {
	/** Tokens before compaction */
	tokensBefore: number;
	/** Tokens after compaction */
	tokensAfter: number;
	/** Tokens saved */
	tokensSaved: number;
	/** Whether compaction was needed */
	wasCompacted: boolean;
	/** Actions performed */
	actions: string[];
	/** Files dropped (if any) */
	droppedFiles?: string[];
	/** For directory compaction */
	compactedFiles?: string[]; // paths that remain
	/** For message compaction */
	compactedMessages?: ChatMessage[];
	/** Error if any */
	error?: string;
}

// ============ Token Utilities ============

/**
 * Rough token estimation: 1 token ≈ 4 characters for English/code.
 * This is conservative and works without external deps.
 */
export function estimateTokens(text: string): number {
	return Math.ceil(text.length / 4);
}

/**
 * Check if a file path should be dropped based on heuristics
 */
function shouldDropFile(filePath: string, opts: CompactOptions): boolean {
	const ext = path.extname(filePath).toLowerCase();
	const name = path.basename(filePath).toLowerCase();
	const relative = filePath.toLowerCase();

	// Drop tests
	if (opts.dropTests !== false) {
		if (name.includes(".test.") || name.includes(".spec.") || name.endsWith(".test") || name.endsWith(".spec")) {
			return true;
		}
		if (relative.includes("/__tests__/") || relative.includes("/test/") || relative.includes("/tests/")) {
			return true;
		}
	}

	// Drop docs
	if (opts.dropDocs !== false) {
		if (name === "readme" || name.startsWith("changelog") || name.endsWith(".md") || ext === ".md") {
			return true;
		}
	}

	// Drop examples
	if (opts.dropExamples !== false) {
		if (
			relative.includes("/example") ||
			relative.includes("/demo") ||
			relative.includes("/examples/") ||
			relative.includes("/demos/")
		) {
			return true;
		}
	}

	// Drop types
	if (opts.dropTypes === true) {
		if (ext === ".d.ts" || ext === ".d.cts" || ext === ".d.mts") {
			return true;
		}
	}

	return false;
}

/**
 * Remove comments from code (basic regex-based)
 */
export function stripCodeComments(code: string): string {
	// Remove single-line comments
	let result = code.replace(/\/\/.*$/gm, "");
	// Remove multi-line comments (non-greedy)
	result = result.replace(/\/\*[\s\S]*?\*\//g, "");
	return result;
}

/**
 * Trim whitespace: remove trailing spaces, collapse multiple blank lines
 */
export function trimWhitespace(text: string): string {
	const lines = text.split("\n");
	// Trim trailing spaces on each line
	const trimmed = lines.map((line) => line.replace(/\s+$/, ""));
	// Remove consecutive empty lines (keep max 1)
	const collapsed: string[] = [];
	let lastEmpty = false;
	for (const line of trimmed) {
		if (line.trim() === "") {
			if (!lastEmpty) {
				collapsed.push("");
				lastEmpty = true;
			}
		} else {
			collapsed.push(line);
			lastEmpty = false;
		}
	}
	return collapsed.join("\n").trim();
}

/**
 * LLM summarization (stub: in real implementation, call OpenAI/Anthropic API)
 */
async function summarizeWithLLM(content: string, opts: CompactOptions): Promise<string> {
	if (!opts.apiKey) {
		throw new Error("LLM summarization requested but no apiKey provided");
	}

	const maxTokens = opts.maxFileTokensForHeuristic || 5000;
	const currentTokens = estimateTokens(content);
	if (currentTokens <= maxTokens) {
		// Already small enough; minify instead
		if (opts.removeComments !== false) content = stripCodeComments(content);
		if (opts.trimWhitespace !== true) content = trimWhitespace(content);
		return content;
	}

	// Construct prompt
	const _prompt = `Summarize the following code to preserve its core functionality while reducing its length as much as possible. Keep function and class signatures, but you can shorten implementations if they are straightforward. Return ONLY the compacted code, no explanations.\n\n\`\`\`\n${content}\n\`\`\``;

	// Call LLM (simplified — you would integrate openai/anthropic SDKs)
	if (opts.llmProvider === "anthropic") {
		// ... anthropic call
	} else {
		// ... openai call
	}

	// Placeholder: for now, return original with minification
	let compacted = content;
	if (opts.removeComments !== false) compacted = stripCodeComments(compacted);
	if (opts.trimWhitespace !== true) compacted = trimWhitespace(compacted);
	return compacted;
}

// ============ Core Compaction Functions ============

/**
 * Compact a single file's content
 */
export async function compactFileContent(
	content: string,
	filePath: string,
	opts: CompactOptions = {},
): Promise<{ compacted: string; tokensBefore: number; tokensAfter: number }> {
	const tokensBefore = estimateTokens(content);
	let compacted = content;
	const actions: string[] = [];

	// Step 1: Remove comments
	if (opts.removeComments !== false) {
		compacted = stripCodeComments(compacted);
		actions.push("Removed comments");
	}

	// Step 2: Trim whitespace
	if (opts.trimWhitespace !== true) {
		compacted = trimWhitespace(compacted);
		actions.push("Trimmed whitespace");
	}

	// Step 3: If still large and LLM enabled, summarize
	if (opts.useLLM && estimateTokens(compacted) > (opts.maxFileTokensForHeuristic || 5000)) {
		try {
			compacted = await summarizeWithLLM(compacted, opts);
			actions.push("LLM summarized");
		} catch (e: any) {
			// LLM failed, continue with heuristic only
			if (opts.verbose) console.warn(`LLM summarization failed for ${filePath}: ${e.message}`);
		}
	}

	const tokensAfter = estimateTokens(compacted);
	return { compacted, tokensBefore, tokensAfter };
}

/**
 * Compact a directory recursively
 */
export async function contextCompactDirectory(dirPath: string, opts: CompactOptions = {}): Promise<CompactResult> {
	const defaults: CompactOptions = {
		tokenLimit: 128000,
		dropTests: true,
		dropDocs: true,
		dropExamples: true,
		dropTypes: false,
		removeComments: true,
		trimWhitespace: true,
		useLLM: false,
		llmProvider: "openai",
		llmModel: "gpt-4-turbo",
		maxFileTokensForHeuristic: 5000,
		verbose: false,
	};
	const options = { ...defaults, ...opts };

	const actions: string[] = [];
	const droppedFiles: string[] = [];
	const keptFiles: string[] = [];
	let tokensBefore = 0;
	let tokensAfter = 0;

	async function walk(dir: string) {
		const entries = await fs.promises.readdir(dir, { withFileTypes: true });
		for (const entry of entries) {
			const fullPath = path.join(dir, entry.name);
			const relative = path.relative(dirPath, fullPath);

			if (entry.isDirectory()) {
				// Skip certain directories
				const dirName = entry.name.toLowerCase();
				if (
					dirName === "node_modules" ||
					dirName === "dist" ||
					dirName === "build" ||
					dirName === ".git" ||
					dirName === "__pycache__"
				) {
					continue;
				}
				await walk(fullPath);
			} else if (entry.isFile()) {
				// Check if should drop
				if (shouldDropFile(relative, options)) {
					droppedFiles.push(relative);
					actions.push(`Dropped ${relative}`);
					continue;
				}

				// Read file
				try {
					const content = await fs.promises.readFile(fullPath, "utf-8");
					const fileTokens = estimateTokens(content);
					tokensBefore += fileTokens;

					// If small, keep as-is
					if (fileTokens < 1000) {
						keptFiles.push(relative);
						tokensAfter += fileTokens;
						continue;
					}

					// Otherwise, compact file
					const {
						compacted: _compacted,
						tokensBefore: _,
						tokensAfter: newTokens,
					} = await compactFileContent(content, relative, options);
					tokensAfter += newTokens;
					keptFiles.push(relative);
					actions.push(`Compacted ${relative} (${fileTokens}→${newTokens} tokens)`);
				} catch (e: any) {
					// Skip unreadable files
					if (options.verbose) console.warn(`Cannot read ${relative}: ${e.message}`);
				}
			}
		}
	}

	await walk(dirPath);

	// If over limit, we may need to drop additional files
	if (tokensAfter > options.tokenLimit! && keptFiles.length > 0) {
		// Drop largest files first until under limit
		const fileSizes = new Map<string, number>();
		for (const rel of keptFiles) {
			const fullPath = path.join(dirPath, rel);
			const content = await fs.promises.readFile(fullPath, "utf-8");
			fileSizes.set(rel, estimateTokens(content));
		}
		// Sort by size descending
		const sorted = [...fileSizes.entries()].sort((a, b) => b[1] - a[1]);
		while (tokensAfter > options.tokenLimit! && sorted.length > 0) {
			const [largest, size] = sorted.shift()!;
			droppedFiles.push(largest);
			keptFiles.splice(keptFiles.indexOf(largest), 1);
			tokensAfter -= size;
			actions.push(`Dropped large file ${largest} (${size} tokens)`);
		}
	}

	const wasCompacted = tokensBefore !== tokensAfter || droppedFiles.length > 0;

	return {
		tokensBefore,
		tokensAfter,
		tokensSaved: tokensBefore - tokensAfter,
		wasCompacted,
		actions,
		droppedFiles,
		compactedFiles: keptFiles,
	};
}

/**
 * Compact chat messages for LLM context
 */
export async function contextCompactMessages(
	messages: ChatMessage[],
	opts: CompactOptions = {},
): Promise<CompactResult> {
	// Advanced智能 compaction with Q&A preservation and LLM summarization

	// Helper: score message importance
	function scoreMessage(msg: ChatMessage, idx: number, total: number, _options: any): number {
		// Recency score (newer = higher)
		const recency = (idx / total) * 100;

		// Role base
		let roleScore = 0;
		if (msg.role === "system") roleScore = 100;
		else if (msg.role === "assistant") roleScore = 50;
		else if (msg.role === "user") roleScore = 30;

		// Content heuristics
		let contentScore = 0;
		const content = msg.content;

		// Questions
		if (msg.role === "user" && /\?$/.test(content.trim())) contentScore += 25;

		// Code blocks
		const codeBlocks = (content.match(/```/g) || []).length;
		contentScore += codeBlocks * 15;

		// File paths
		if (/\.(ts|js|py|java|cpp|h|json|yaml|yml|md|txt|csv)\b/.test(content)) contentScore += 10;

		// Commands in assistant
		if (msg.role === "assistant" && content.includes("$ ") && content.length > 2000) contentScore += 20;

		// Very short (likely trivial)
		if (content.length < 50) contentScore -= 10;

		return recency + roleScore + contentScore;
	}

	// LLM summarization
	async function summarizeWithLLM(content: string, targetTokens: number, options: any): Promise<string | null> {
		if (!options.apiKey) return null;

		const prompt = `Summarize concisely preserving key information, questions, and technical details. Target: ~${targetTokens} tokens.\n\n${content}`;

		try {
			if (options.llmProvider === "anthropic") {
				const res = await fetch("https://api.anthropic.com/v1/messages", {
					method: "POST",
					headers: {
						"x-api-key": options.apiKey,
						"anthropic-version": "2023-06-01",
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						model: options.llmModel || "claude-3-5-sonnet-20241022",
						max_tokens: Math.min(targetTokens, 4000),
						messages: [{ role: "user", content: prompt }],
					}),
				});
				const data = (await res.json()) as any;
				return data.content?.[0]?.text || null;
			} else {
				const res = await fetch("https://api.openai.com/v1/chat/completions", {
					method: "POST",
					headers: {
						Authorization: `Bearer ${options.apiKey}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						model: options.llmModel || "gpt-4-turbo-preview",
						max_tokens: Math.min(targetTokens, 4000),
						messages: [{ role: "user", content: prompt }],
					}),
				});
				const data = (await res.json()) as any;
				return data.choices?.[0]?.message?.content || null;
			}
		} catch (e) {
			if (options.verbose) console.warn("LLM summarize failed:", e);
			return null;
		}
	}

	// Check Q-A pair
	function isPair(a: ChatMessage, b: ChatMessage): boolean {
		return (a.role === "user" && b.role === "assistant") || (a.role === "assistant" && b.role === "user");
	}

	const defaults: CompactOptions = {
		tokenLimit: 128000,
		trimWhitespace: true,
		removeComments: true,
		useLLM: false,
		keepRecent: 8,
		maxTokensPerMessage: 0, // auto
		verbose: false,
	};
	const options = { ...defaults, ...opts };
	const actions: string[] = [];
	const cloned = messages.map((m) => ({ ...m }));

	// Initial token count
	const estimate = (txt: string) => Math.ceil(txt.length / 4);
	let totalTokens = cloned.reduce((sum, m) => sum + estimate(m.content), 0);
	const originalTokens = totalTokens;

	// Under limit? return as-is
	if (totalTokens <= options.tokenLimit!) {
		return {
			tokensBefore: originalTokens,
			tokensAfter: originalTokens,
			tokensSaved: 0,
			wasCompacted: false,
			actions: ["No compaction needed"],
			compactedMessages: cloned,
		};
	}

	// PHASE 1: Clean each message (whitespace, comments, LLM summarize if large)
	const targetPerMsg = options.maxTokensPerMessage || Math.floor((options.tokenLimit! / messages.length) * 1.2);

	for (let i = 0; i < cloned.length; i++) {
		let content = cloned[i].content;

		if (options.trimWhitespace) content = trimWhitespace(content);
		if (options.removeComments && content.includes("//")) content = stripCodeComments(content);

		const tokensNow = estimate(content);
		if (tokensNow > 5000 && options.useLLM && options.apiKey) {
			const summarized = await summarizeWithLLM(content, Math.min(targetPerMsg, 3000), options);
			if (summarized && estimate(summarized) < tokensNow) {
				content = summarized;
				if (options.verbose) actions.push(`LLM-summarized message ${i} (${tokensNow}→${estimate(content)} tokens)`);
			}
		}

		cloned[i].content = content;
	}

	// Re-count after cleaning
	totalTokens = cloned.reduce((sum, m) => sum + estimate(m.content), 0);
	if (totalTokens <= options.tokenLimit!) {
		return {
			tokensBefore: originalTokens,
			tokensAfter: totalTokens,
			tokensSaved: originalTokens - totalTokens,
			wasCompacted: true,
			actions: [...actions, "Cleaning only, no dropping"],
			compactedMessages: cloned,
		};
	}

	// PHASE 2: Smart dropping with scoring and pair preservation
	const scores = cloned.map((msg, i) => scoreMessage(msg, i, cloned.length, options));
	const keepRecent = options.keepRecent!;
	const keepIndices = new Set<number>();

	// Always keep system messages
	for (let i = 0; i < cloned.length; i++) {
		if (cloned[i].role === "system") keepIndices.add(i);
	}

	// Keep recent messages
	for (let i = cloned.length - keepRecent; i < cloned.length; i++) {
		if (i >= 0) keepIndices.add(i);
	}

	// Preserve Q-A pairs: if assistant kept, ensure preceding user is kept
	for (let i = cloned.length - 1; i >= 0; i--) {
		if (cloned[i].role === "assistant" && keepIndices.has(i)) {
			if (i > 0 && cloned[i - 1].role === "user") keepIndices.add(i - 1);
		}
	}

	// Current kept tokens
	let keptTokens = Array.from(keepIndices).reduce((sum, i) => sum + estimate(cloned[i].content), 0);

	// If still over, drop lowest scored non-system messages
	if (keptTokens > options.tokenLimit!) {
		const sortedByScore = Array.from(keepIndices)
			.filter((i) => cloned[i].role !== "system")
			.sort((a, b) => scores[a] - scores[b]); // low score first

		for (const idx of sortedByScore) {
			if (keptTokens <= options.tokenLimit!) break;

			// Don't break pairs
			let canDrop = true;
			if (idx > 0 && keepIndices.has(idx - 1) && isPair(cloned[idx - 1], cloned[idx])) canDrop = false;
			if (idx < cloned.length - 1 && keepIndices.has(idx + 1) && isPair(cloned[idx], cloned[idx + 1]))
				canDrop = false;

			if (canDrop) {
				keepIndices.delete(idx);
				keptTokens -= estimate(cloned[idx].content);
				actions.push(`Dropped low-score message ${idx} (role=${cloned[idx].role})`);
			}
		}
	}

	// Build result array ordered
	const compacted = Array.from(keepIndices)
		.sort((a, b) => a - b)
		.map((i) => cloned[i]);
	const finalTokens = compacted.reduce((sum, m) => sum + estimate(m.content), 0);

	return {
		tokensBefore: originalTokens,
		tokensAfter: finalTokens,
		tokensSaved: originalTokens - finalTokens,
		wasCompacted: compacted.length < messages.length || finalTokens < originalTokens,
		actions: [
			`Enhanced compaction: ${messages.length}→${compacted.length} msgs`,
			`Tokens: ${originalTokens}→${finalTokens} (saved ${originalTokens - finalTokens})`,
			...actions,
		],
		compactedMessages: compacted,
	};
}

// ============ Main Entry ============

// ============ Main Entry ============

/**
 * Main function: auto-detect input type and compact
 *
 * @param input { type: 'directory', path: string } OR { type: 'messages', messages: ChatMessage[] }
 * @param options CompactOptions
 */
export async function contextCompact(
	input: { type: "directory"; path: string } | { type: "messages"; messages: ChatMessage[] },
	options: CompactOptions = {},
): Promise<CompactResult> {
	if (input.type === "directory") {
		return await contextCompactDirectory(input.path, options);
	} else {
		return await contextCompactMessages(input.messages, options);
	}
}
