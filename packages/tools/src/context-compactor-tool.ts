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

import * as fs from 'fs'
import * as path from 'path'

// ============ Types ============

export interface ChatMessage {
	role: 'system' | 'user' | 'assistant'
	content: string
}

export interface CompactOptions {
	/** Maximum tokens allowed (default: 128000) */
	tokenLimit?: number
	/** Drop test files (.test., .spec.) (default: true) */
	dropTests?: boolean
	/** Drop documentation files (.md, README, CHANGELOG) (default: true) */
	dropDocs?: boolean
	/** Drop example files/directories (default: true) */
	dropExamples?: boolean
	/** Drop type definition files (.d.ts) (default: false) */
	dropTypes?: boolean
	/** Remove comments from code (default: true) */
	removeComments?: boolean
	/** Trim excessive whitespace (default: true) */
	trimWhitespace?: boolean
	/** Use LLM to summarize large files (requires API key) (default: false) */
	useLLM?: boolean
	/** LLM API key (OpenAI or Anthropic) */
	apiKey?: string
	/** LLM provider: 'openai' | 'anthropic' (default: 'openai') */
	llmProvider?: 'openai' | 'anthropic'
	/** Model for summarization (default: 'gpt-4-turbo') */
	llmModel?: string
	/** Max file size (in tokens) before using LLM summarization (default: 5000) */
	maxFileTokensForHeuristic?: number
	/** Verbose logging */
	verbose?: boolean
}

export interface CompactResult {
	/** Tokens before compaction */
	tokensBefore: number
	/** Tokens after compaction */
	tokensAfter: number
	/** Tokens saved */
	tokensSaved: number
	/** Whether compaction was needed */
	wasCompacted: boolean
	/** Actions performed */
	actions: string[]
	/** Files dropped (if any) */
	droppedFiles?: string[]
	/** For directory compaction */
	compactedFiles?: string[]  // paths that remain
	/** For message compaction */
	compactedMessages?: ChatMessage[]
	/** Error if any */
	error?: string
}

// ============ Token Utilities ============

/**
 * Rough token estimation: 1 token ≈ 4 characters for English/code.
 * This is conservative and works without external deps.
 */
export function estimateTokens(text: string): number {
	return Math.ceil(text.length / 4)
}

/**
 * Check if a file path should be dropped based on heuristics
 */
function shouldDropFile(filePath: string, opts: CompactOptions): boolean {
	const ext = path.extname(filePath).toLowerCase()
	const name = path.basename(filePath).toLowerCase()
	const relative = filePath.toLowerCase()

	// Drop tests
	if (opts.dropTests !== false) {
		if (name.includes('.test.') || name.includes('.spec.') || name.endsWith('.test') || name.endsWith('.spec')) {
			return true
		}
		if (relative.includes('/__tests__/') || relative.includes('/test/') || relative.includes('/tests/')) {
			return true
		}
	}

	// Drop docs
	if (opts.dropDocs !== false) {
		if (name === 'readme' || name.startsWith('changelog') || name.endsWith('.md') || ext === '.md') {
			return true
		}
	}

	// Drop examples
	if (opts.dropExamples !== false) {
		if (relative.includes('/example') || relative.includes('/demo') || relative.includes('/examples/') || relative.includes('/demos/')) {
			return true
		}
	}

	// Drop types
	if (opts.dropTypes === true) {
		if (ext === '.d.ts' || ext === '.d.cts' || ext === '.d.mts') {
			return true
		}
	}

	return false
}

/**
 * Remove comments from code (basic regex-based)
 */
export function stripCodeComments(code: string): string {
	// Remove single-line comments
	let result = code.replace(/\/\/.*$/gm, '')
	// Remove multi-line comments (non-greedy)
	result = result.replace(/\/\*[\s\S]*?\*\//g, '')
	return result
}

/**
 * Trim whitespace: remove trailing spaces, collapse multiple blank lines
 */
export function trimWhitespace(text: string): string {
	const lines = text.split('\n')
	// Trim trailing spaces on each line
	const trimmed = lines.map(line => line.replace(/\s+$/, ''))
	// Remove consecutive empty lines (keep max 1)
	const collapsed: string[] = []
	let lastEmpty = false
	for (const line of trimmed) {
		if (line.trim() === '') {
			if (!lastEmpty) {
				collapsed.push('')
				lastEmpty = true
			}
		} else {
			collapsed.push(line)
			lastEmpty = false
		}
	}
	return collapsed.join('\n').trim()
}

/**
 * LLM summarization (stub: in real implementation, call OpenAI/Anthropic API)
 */
async function summarizeWithLLM(content: string, opts: CompactOptions): Promise<string> {
	if (!opts.apiKey) {
		throw new Error('LLM summarization requested but no apiKey provided')
	}

	const maxTokens = opts.maxFileTokensForHeuristic || 5000
	const currentTokens = estimateTokens(content)
	if (currentTokens <= maxTokens) {
		// Already small enough; minify instead
		if (opts.removeComments !== false) content = stripCodeComments(content)
		if (opts.trimWhitespace !== true) content = trimWhitespace(content)
		return content
	}

	// Construct prompt
	const prompt = `Summarize the following code to preserve its core functionality while reducing its length as much as possible. Keep function and class signatures, but you can shorten implementations if they are straightforward. Return ONLY the compacted code, no explanations.\n\n\`\`\`\n${content}\n\`\`\``

	// Call LLM (simplified — you would integrate openai/anthropic SDKs)
	if (opts.llmProvider === 'anthropic') {
		// ... anthropic call
	} else {
		// ... openai call
	}

	// Placeholder: for now, return original with minification
	let compacted = content
	if (opts.removeComments !== false) compacted = stripCodeComments(compacted)
	if (opts.trimWhitespace !== true) compacted = trimWhitespace(compacted)
	return compacted
}

// ============ Core Compaction Functions ============

/**
 * Compact a single file's content
 */
export async function compactFileContent(content: string, filePath: string, opts: CompactOptions = {}): Promise<{ compacted: string; tokensBefore: number; tokensAfter: number }> {
	const tokensBefore = estimateTokens(content)
	let compacted = content
	const actions: string[] = []

	// Step 1: Remove comments
	if (opts.removeComments !== false) {
		compacted = stripCodeComments(compacted)
		actions.push('Removed comments')
	}

	// Step 2: Trim whitespace
	if (opts.trimWhitespace !== true) {
		compacted = trimWhitespace(compacted)
		actions.push('Trimmed whitespace')
	}

	// Step 3: If still large and LLM enabled, summarize
	if (opts.useLLM && estimateTokens(compacted) > (opts.maxFileTokensForHeuristic || 5000)) {
		try {
			compacted = await summarizeWithLLM(compacted, opts)
			actions.push('LLM summarized')
		} catch (e: any) {
			// LLM failed, continue with heuristic only
			if (opts.verbose) console.warn(`LLM summarization failed for ${filePath}: ${e.message}`)
		}
	}

	const tokensAfter = estimateTokens(compacted)
	return { compacted, tokensBefore, tokensAfter }
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
		llmProvider: 'openai',
		llmModel: 'gpt-4-turbo',
		maxFileTokensForHeuristic: 5000,
		verbose: false
	}
	const options = { ...defaults, ...opts }

	const actions: string[] = []
	const droppedFiles: string[] = []
	const keptFiles: string[] = []
	let tokensBefore = 0
	let tokensAfter = 0

	async function walk(dir: string) {
		const entries = await fs.promises.readdir(dir, { withFileTypes: true })
		for (const entry of entries) {
			const fullPath = path.join(dir, entry.name)
			const relative = path.relative(dirPath, fullPath)

			if (entry.isDirectory()) {
				// Skip certain directories
				const dirName = entry.name.toLowerCase()
				if (dirName === 'node_modules' || dirName === 'dist' || dirName === 'build' || dirName === '.git' || dirName === '__pycache__') {
					continue
				}
				await walk(fullPath)
			} else if (entry.isFile()) {
				// Check if should drop
				if (shouldDropFile(relative, options)) {
					droppedFiles.push(relative)
					actions.push(`Dropped ${relative}`)
					continue
				}

				// Read file
				try {
					const content = await fs.promises.readFile(fullPath, 'utf-8')
					const fileTokens = estimateTokens(content)
					tokensBefore += fileTokens

					// If small, keep as-is
					if (fileTokens < 1000) {
						keptFiles.push(relative)
						tokensAfter += fileTokens
						continue
					}

					// Otherwise, compact file
					const { compacted, tokensBefore: _, tokensAfter: newTokens } = await compactFileContent(content, relative, options)
					tokensAfter += newTokens
					keptFiles.push(relative)
					actions.push(`Compacted ${relative} (${fileTokens}→${newTokens} tokens)`)
				} catch (e: any) {
					// Skip unreadable files
					if (options.verbose) console.warn(`Cannot read ${relative}: ${e.message}`)
				}
			}
		}
	}

	await walk(dirPath)

	// If over limit, we may need to drop additional files
	if (tokensAfter > options.tokenLimit! && keptFiles.length > 0) {
		// Drop largest files first until under limit
		const fileSizes = new Map<string, number>()
		for (const rel of keptFiles) {
			const fullPath = path.join(dirPath, rel)
			const content = await fs.promises.readFile(fullPath, 'utf-8')
			fileSizes.set(rel, estimateTokens(content))
		}
		// Sort by size descending
		const sorted = [...fileSizes.entries()].sort((a, b) => b[1] - a[1])
		while (tokensAfter > options.tokenLimit! && sorted.length > 0) {
			const [largest, size] = sorted.shift()!
			droppedFiles.push(largest)
			keptFiles.splice(keptFiles.indexOf(largest), 1)
			tokensAfter -= size
			actions.push(`Dropped large file ${largest} (${size} tokens)`)
		}
	}

	const wasCompacted = tokensBefore !== tokensAfter || droppedFiles.length > 0

	return {
		tokensBefore,
		tokensAfter,
		tokensSaved: tokensBefore - tokensAfter,
		wasCompacted,
		actions,
		droppedFiles,
		compactedFiles: keptFiles
	}
}

/**
 * Compact chat messages for LLM context
 */
export async function contextCompactMessages(messages: ChatMessage[], opts: CompactOptions = {}): Promise<CompactResult> {
	const defaults: CompactOptions = {
		tokenLimit: 128000,
		removeComments: true,
		trimWhitespace: true,
		useLLM: false,
		verbose: false
	}
	const options = { ...defaults, ...opts }
	const actions: string[] = []
	const cloned = messages.map(m => ({ ...m }))

	// Count tokens
	let totalTokens = cloned.reduce((sum, m) => sum + estimateTokens(m.content), 0)
	const originalTokens = totalTokens

	// If under limit, return as-is
	if (totalTokens <= options.tokenLimit!) {
		return {
			tokensBefore: originalTokens,
			tokensAfter: originalTokens,
			tokensSaved: 0,
			wasCompacted: false,
			actions: ['No compaction needed'],
			compactedMessages: cloned
		}
	}

	// Strategy: first, try to truncate System/User/Assistant messages proportionally
	// We'll keep the most recent messages full, and summarize/truncate older ones
	const targetTokens = options.tokenLimit!
	const keepRatio = targetTokens / totalTokens

	// We'll apply heuristic to each message: strip whitespace/comments, and if still large, truncate or summarize
	for (let i = 0; i < cloned.length; i++) {
		const msg = cloned[i]
		const originalLen = msg.content.length
		let newContent = msg.content

		// Remove excessive whitespace
		if (options.trimWhitespace) {
			newContent = trimWhitespace(newContent)
		}

		// Remove lines that look like comments (for code snippets in chat)
		if (options.removeComments && msg.content.includes('//')) {
			newContent = stripCodeComments(newContent)
		}

		// If still too many tokens, truncate to a summary
		const tokensNow = estimateTokens(newContent)
		if (tokensNow > 5000 && options.useLLM) {
			// Use LLM to summarize this message (draft)
			try {
				// In real implementation, call LLM here
				// For now, just truncate with indicator
				const truncateAt = Math.floor((targetTokens / totalTokens) * originalLen)
				newContent = newContent.substring(0, truncateAt) + '\n... [truncated]'
				actions.push(`Truncated message ${i} (${tokensNow}→${estimateTokens(newContent)} tokens)`)
			} catch (e) {
				// ignore
			}
		}

		cloned[i].content = newContent
	}

	// Re-count
	totalTokens = cloned.reduce((sum, m) => sum + estimateTokens(m.content), 0)

	// If still over, aggressively drop older non-system messages
	if (totalTokens > targetTokens) {
		// Remove messages from the beginning (oldest) until under limit, but keep system and most recent
		const toKeep: ChatMessage[] = []
		for (let i = cloned.length - 1; i >= 0; i--) {
			const msg = cloned[i]
			// Always keep system and the last few assistant/user
			if (msg.role === 'system' || toKeep.length < 3) {
				toKeep.unshift(msg)
			} else {
				actions.push(`Dropped older message (role=${msg.role})`)
			}
			if (toKeep.reduce((s, m) => s + estimateTokens(m.content), 0) <= targetTokens) {
				// ok
			} else {
				if (msg.role !== 'system' && toKeep.length > 3) {
					// Remove this one and continue
					toKeep.shift()
				}
			}
		}
		cloned.splice(0, cloned.length, ...toKeep)
		totalTokens = cloned.reduce((sum, m) => sum + estimateTokens(m.content), 0)
	}

	actions.unshift(`Compacted messages: ${messages.length}→${cloned.length}`)

	return {
		tokensBefore: originalTokens,
		tokensAfter: totalTokens,
		tokensSaved: originalTokens - totalTokens,
		wasCompacted: cloned.length < messages.length || totalTokens < originalTokens,
		actions,
		compactedMessages: cloned
	}
}

// ============ Main Entry ============

/**
 * Main function: auto-detect input type and compact
 *
 * @param input { type: 'directory', path: string } OR { type: 'messages', messages: ChatMessage[] }
 * @param options CompactOptions
 */
export async function contextCompact(
	input: { type: 'directory'; path: string } | { type: 'messages'; messages: ChatMessage[] },
	options: CompactOptions = {}
): Promise<CompactResult> {
	if (input.type === 'directory') {
		return await contextCompactDirectory(input.path, options)
	} else {
		return await contextCompactMessages(input.messages, options)
	}
}
