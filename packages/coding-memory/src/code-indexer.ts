/**
 * Code Indexer - Automatically index codebase into memory
 * Watches file changes and extracts symbols (functions, classes, etc.)
 */

import { readdir, readFile } from "node:fs/promises";
import { extname, join as pathJoin } from "node:path";
import { watch } from "chokidar";
import type { MemoryInput } from "./types.js";

export interface CodeSymbol {
	type: "function" | "class" | "interface" | "type" | "enum" | "module" | "variable";
	name: string;
	file: string;
	start: number;
	end: number;
	signature: string;
	doc?: string;
	language: string;
}

export interface IndexerOptions {
	watchPaths: string[];
	extensions: string[];
	debounceMs?: number;
	onIndexed?: (file: string, symbols: CodeSymbol[]) => void;
}

const DEFAULT_EXTENSIONS = [".ts", ".js", ".jsx", ".tsx", ".py", ".go", ".rs"];

// Helper functions (not part of public API)
function languageFromExtension(ext: string): string | null {
	const map: Record<string, string> = {
		".ts": "typescript",
		".js": "javascript",
		".jsx": "javascript",
		".tsx": "typescript",
		".py": "python",
		".go": "go",
		".rs": "rust",
		".java": "java",
		".cpp": "cpp",
		".c": "c",
		".h": "c",
		".hpp": "cpp",
	};
	return map[ext] || null;
}

function extractTSFunctions(content: string, filePath: string): CodeSymbol[] {
	const symbols: CodeSymbol[] = [];
	const funcRegex = /(?:function\s+(\w+)\s*\(|([a-zA-Z_$][\w$]*)\s*[:=]\s*(?:function\s*\(|\([^)]*\)\s*=>))/g;
	let match: RegExpExecArray | null;

	while ((match = funcRegex.exec(content)) !== null) {
		const name = match[1] || match[2];
		if (!name) continue;

		const signature = captureSignature(content, match.index);

		symbols.push({
			type: "function",
			name,
			file: filePath,
			start: match.index,
			end: match.index + (match[0]?.length || 0),
			signature,
			language: "typescript",
		});
	}

	return symbols;
}

function extractTSClasses(content: string, filePath: string): CodeSymbol[] {
	const symbols: CodeSymbol[] = [];
	const classRegex = /(?:class|interface|type|enum)\s+(\w+)(?:\s+extends\s+\w+)?/g;
	let match: RegExpExecArray | null;

	while ((match = classRegex.exec(content)) !== null) {
		const name = match[1];
		if (!name) continue;

		const fullMatch = match[0];
		const signature = fullMatch.trim();

		const type: "class" | "interface" | "type" | "enum" = fullMatch.startsWith("class")
			? "class"
			: fullMatch.startsWith("interface")
				? "interface"
				: fullMatch.startsWith("type")
					? "type"
					: "enum";

		symbols.push({
			type,
			name,
			file: filePath,
			start: match.index,
			end: match.index + fullMatch.length,
			signature,
			language: "typescript",
		});
	}

	return symbols;
}

function extractPythonFunctions(content: string, filePath: string): CodeSymbol[] {
	const symbols: CodeSymbol[] = [];
	const funcRegex = /^(\s*)(?:async\s+)?def\s+(\w+)\s*\(/gm;
	let match: RegExpExecArray | null;

	while ((match = funcRegex.exec(content)) !== null) {
		const name = match[2];
		if (!name) continue;

		const signature = match[0].trim();

		symbols.push({
			type: "function",
			name,
			file: filePath,
			start: match.index,
			end: match.index + match[0].length,
			signature,
			language: "python",
		});
	}

	return symbols;
}

function extractPythonClasses(content: string, filePath: string): CodeSymbol[] {
	const symbols: CodeSymbol[] = [];
	const classRegex = /^(\s*)class\s+(\w+)(?:\s*\([^)]*\))?\s*:/gm;
	let match: RegExpExecArray | null;

	while ((match = classRegex.exec(content)) !== null) {
		const name = match[2];
		if (!name) continue;

		const signature = match[0].trim();

		symbols.push({
			type: "class",
			name,
			file: filePath,
			start: match.index,
			end: match.index + match[0].length,
			signature,
			language: "python",
		});
	}

	return symbols;
}

function extractGeneric(content: string, filePath: string): CodeSymbol[] {
	const symbols: CodeSymbol[] = [];
	const lines = content.split("\n");

	lines.forEach((line, lineIndex) => {
		const trimmed = line.trim();
		if (
			trimmed.startsWith("func ") ||
			trimmed.startsWith("function ") ||
			trimmed.startsWith("class ") ||
			trimmed.startsWith("struct ") ||
			trimmed.startsWith("interface ")
		) {
			const words = trimmed.split(/\s+/);
			const name = words[1]?.replace(/[({].*/, "");
			if (name) {
				const offset = content.indexOf(trimmed);
				symbols.push({
					type: "function",
					name,
					file: filePath,
					start: offset,
					end: offset + trimmed.length,
					signature: trimmed,
					language: "unknown",
				});
			}
		}
	});

	return symbols;
}

function captureSignature(content: string, startIdx: number): string {
	const slice = content.substring(startIdx, startIdx + 200);
	const bracePos = Math.min(slice.indexOf("{"), slice.indexOf("=>"));
	const endPos = bracePos > 0 ? startIdx + bracePos : startIdx + slice.length;
	return content.substring(startIdx, endPos).trim();
}

async function getFilesRecursive(dir: string, extensions: string[]): Promise<string[]> {
	const files: string[] = [];

	async function walk(currentDir: string) {
		try {
			const items = await readdir(currentDir, { withFileTypes: true });
			for (const item of items) {
				const fullPath = pathJoin(currentDir, item.name);
				if (item.isDirectory()) {
					await walk(fullPath);
				} else if (item.isFile()) {
					const ext = extname(item.name).toLowerCase();
					if (extensions.includes(ext)) {
						files.push(fullPath);
					}
				}
			}
		} catch (e) {
			// Silently skip directories we can't read
		}
	}

	await walk(dir);
	return files;
}

export interface CodeIndexer {
	start(): void;
	stop(): void;
	indexDirectory(dir: string): Promise<void>;
	indexFile(filePath: string): Promise<CodeSymbol[]>;
	getStats(): { indexedFiles: number; pending: number };
}

export function createCodeIndexer(
	engine: { save: (input: MemoryInput) => any }, // Minimal interface
	options: Partial<IndexerOptions> = {},
): CodeIndexer {
	const opts: IndexerOptions = {
		watchPaths: options.watchPaths ?? [process.cwd()],
		extensions: options.extensions ?? DEFAULT_EXTENSIONS,
		debounceMs: options.debounceMs ?? 500,
		onIndexed: options.onIndexed,
	};

	const watchers: any[] = [];
	const debounceTimers = new Map<string, NodeJS.Timeout>();

	function shouldIndexFile(filePath: string): boolean {
		const ext = extname(filePath).toLowerCase();
		return opts.extensions.includes(ext) && !filePath.includes("node_modules") && !filePath.includes(".git");
	}

	async function indexDirectory(dir: string): Promise<void> {
		const files = await getFilesRecursive(dir, opts.extensions);
		for (const file of files) {
			if (shouldIndexFile(file)) {
				await indexFile(file);
			}
		}
	}

	async function indexFile(filePath: string): Promise<CodeSymbol[]> {
		try {
			const ext = extname(filePath).toLowerCase();
			const language = languageFromExtension(ext);

			if (!language) return [];

			const content = await readFile(filePath, "utf-8");
			const symbols: CodeSymbol[] = [];

			// Extract based on language
			if (language === "typescript" || language === "javascript") {
				symbols.push(...extractTSFunctions(content, filePath));
				symbols.push(...extractTSClasses(content, filePath));
			} else if (language === "python") {
				symbols.push(...extractPythonFunctions(content, filePath));
				symbols.push(...extractPythonClasses(content, filePath));
			} else {
				symbols.push(...extractGeneric(content, filePath));
			}

			// Save each symbol to memory
			for (const sym of symbols) {
				const memoryInput: MemoryInput = {
					content: formatSymbol(sym),
					type: "code_symbol",
					tags: [sym.type, language, sym.name.toLowerCase()],
					weight: 0.5,
					metadata: {
						symbol_type: sym.type,
						file_path: sym.file,
						line_start: sym.start,
						line_end: sym.end,
						language: sym.language,
						signature: sym.signature,
					},
				};

				engine.save(memoryInput);
			}

			opts.onIndexed?.(filePath, symbols);
			return symbols;
		} catch (e) {
			console.error(`Error indexing ${filePath}:`, e);
			return [];
		}
	}

	function formatSymbol(sym: CodeSymbol): string {
		const doc = sym.doc ? `\n${sym.doc}` : "";
		return `[${sym.type}] ${sym.signature}${doc}\nFile: ${sym.file}:${sym.start}`;
	}

	async function handleFileEvent(event: string, filePath: string) {
		if (!shouldIndexFile(filePath)) return;

		// Debounce
		if (debounceTimers.has(filePath)) {
			clearTimeout(debounceTimers.get(filePath));
		}

		debounceTimers.set(
			filePath,
			setTimeout(async () => {
				debounceTimers.delete(filePath);
				if (event === "unlink") {
					await removeFileIndex(filePath);
				} else {
					await indexFile(filePath);
				}
			}, opts.debounceMs),
		);
	}

	async function removeFileIndex(_filePath: string) {
		// TODO: implement efficient delete by file_path
		// For now, skip - consolidation will prune old unused memories
		console.log(`File removed: ${_filePath} (index cleanup not fully implemented)`);
	}

	function getStats() {
		return { indexedFiles: 0, pending: debounceTimers.size };
	}

	// Start watching immediately
	// Note: We don't automatically start to allow caller to set up first
	// Caller must call start()

	return {
		start() {
			// Initial indexing
			for (const watchPath of opts.watchPaths) {
				indexDirectory(watchPath).catch(console.error);
			}

			// Start watchers
			for (const watchPath of opts.watchPaths) {
				const watcher = watch(watchPath, {
					recursive: true,
					ignored: /node_modules|.git|dist|build/,
					persist: true,
				} as any);

				watcher.on("change", (filePath) => handleFileEvent("change", filePath));
				watcher.on("add", (filePath) => handleFileEvent("add", filePath));
				watcher.on("unlink", (filePath) => handleFileEvent("unlink", filePath));

				watchers.push(watcher);
			}
		},

		stop() {
			for (const watcher of watchers) {
				watcher.close();
			}
			watchers.length = 0;
			debounceTimers.forEach((timer) => clearTimeout(timer));
			debounceTimers.clear();
		},

		indexDirectory,
		indexFile,
		getStats,
	};
}
