/**
 * Code Indexer - Automatically index codebase into memory
 * Watches file changes and extracts symbols (functions, classes, etc.)
 */

import { existsSync, readFileSync, watch as fsWatch } from "node:fs";
import { dirname, extname, relative } from "node:path";
import type { IMemoryEngine, MemoryInput } from "./index.js";

interface CodeSymbol {
	type: "function" | "class" | "interface" | "type" | "enum" | "module" | "variable";
	name: string;
	file: string;
	start: number;
	end: number;
	signature: string;
	doc?: string;
	language: string;
}

interface IndexerOptions {
	/** Paths to watch (array of directories) */
	watchPaths: string[];
	/** File extensions to index */
	extensions: string[];
	/** Debounce time (ms) */
	debounceMs?: number;
	/** Callback when file indexed */
	onIndexed?: (file: string, symbols: CodeSymbol[]) => void;
}

const DEFAULT_EXTENSIONS = [".ts", ".js", ".jsx", ".tsx", ".py", ".go", ".rs"];

export function createCodeIndexer(engine: IMemoryEngine, options: Partial<IndexerOptions> = {}): CodeIndexer {
	const opts: IndexerOptions = {
		watchPaths: options.watchPaths ?? [process.cwd()],
		extensions: options.extensions ?? DEFAULT_EXTENSIONS,
		debounceMs: options.debounceMs ?? 500,
		onIndexed: options.onIndexed,
	};

	const watchers: any[] = [];
	const debounceTimers = new Map<string, NodeJS.Timeout>();

	return {
		start() {
			// Initial indexing of all files
			for (const watchPath of opts.watchPaths) {
				this.indexDirectory(watchPath);
			}

			// Start watching
			for (const watchPath of opts.watchPaths) {
				const watcher = fsWatch(watchPath, { recursive: true, ignored: /node_modules|\.git|dist|build/ }, (event, filePath) => {
					if (!filePath) return;
					this.handleFileEvent(event, filePath);
				});
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

		indexDirectory(dir: string) {
			// Simple recursive directory walk
			const files = getFilesRecursive(dir);
			for (const file of files) {
				if (this.shouldIndexFile(file)) {
					this.indexFile(file).catch(console.error);
				}
			}
		},

		async indexFile(filePath: string): Promise<CodeSymbol[]> {
			try {
				const ext = extname(filePath).toLowerCase();
				const language = this.languageFromExtension(ext);

				if (!language) return [];

				const content = readFileSync(filePath, "utf-8");
				const symbols = this.extractSymbols(content, filePath, language);

				// Save each symbol to memory
				for (const sym of symbols) {
					const memoryInput: MemoryInput = {
						content: this.formatSymbol(sym),
						type: "code_symbol",
						tags: [sym.type, language, sym.name.toLowerCase()],
						weight: 0.5, // new symbol, neutral weight
						metadata: {
							symbol_type: sym.type,
							file_path: sym.file,
							line_start: sym.start,
							line_end: sym.end,
							language: sym.language,
							signature: sym.signature,
						},
					};

					// Don't create new memory if identical symbol already exists with high weight
					// Instead, boost existing weight
					const existing = engine.find(sym.name, { limit: 5 });
					if (existing.ok && existing.value.total > 0) {
						const match = existing.value.memories.find(
							(m) => m.metadata?.file_path === sym.file && m.metadata?.signature === sym.signature
						);
						if (match) {
							// Boost weight of existing symbol (it's still relevant)
							engine.update(match.id, { weight: Math.min(1.0, match.weight + 0.1) });
							continue;
						}
					}

					engine.save(memoryInput);
				}

				opts.onIndexed?.(filePath, symbols);
				return symbols;
			} catch (e) {
				console.error(`Error indexing ${filePath}:`, e);
				return [];
			}
		},

		extractSymbols(content: string, filePath: string, language: string): CodeSymbol[] {
			const symbols: CodeSymbol[] = [];

			// Simple regex-based extraction for now
			// Could use proper AST parsing per language (ts-morph for TS, rope for Python, etc.)
			if (language === "typescript" || language === "javascript") {
				symbols.push(...this.extractTSFunctions(content, filePath));
				symbols.push(...this.extractTSClasses(content, filePath));
				symbols.push(...this.extractTSInterfaces(content, filePath));
			} else if (language === "python") {
				symbols.push(...this.extractPythonFunctions(content, filePath));
				symbols.push(...this.extractPythonClasses(content, filePath));
			} else {
				// Generic: try to find any function/class-like patterns
				symbols.push(...this.extractGeneric(content, filePath));
			}

			return symbols;
		},

		extractTSFunctions(content: string, filePath: string): CodeSymbol[] {
			const symbols: CodeSymbol[] = [];
			// Match: function name(...) {  OR const name = (...)
			const funcRegex = /(?:function\s+(\w+)\s*\(|([a-zA-Z_$][\w$]*)\s*[:=]\s*(?:function\s*\(|\([^)]*\)\s*=>))/g;
			let match;

			while ((match = funcRegex.exec(content)) !== null) {
				const name = match[1] || match[2];
				if (!name) continue;

				// Find line number
				const line = content.substring(0, match.index).split("\n").length;

				// Extract signature (simplified)
				const signature = this.captureSignature(content, match.index);

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
		},

		extractTSClasses(content: string, filePath: string): CodeSymbol[] {
			const symbols: CodeSymbol[] =';
			const classRegex = /(?:class|interface|type|enum)\s+(\w+)(?:\s+extends\s+\w+)?/g;
			let match;

			while ((match = classRegex.exec(content)) !== null) {
				const name = match[1];
				if (!name) continue;

				const line = content.substring(0, match.index).split("\n").length;
				const signature = match[0];

				const type = match[0].startsWith("class") ? "class" :
				             match[0].startsWith("interface") ? "interface" :
				             match[0].startsWith("type") ? "type" : "enum";

				symbols.push({
					type: type as any,
					name,
					file: filePath,
					start: match.index,
					end: match.index + match[0].length,
					signature,
					language: "typescript",
				});
			}

			return symbols;
		},

		extractTSInterfaces(content: string, filePath: string): CodeSymbol[] {
			// Already covered in extractTSClasses with type='interface'
			return [];
		},

		extractPythonFunctions(content: string, filePath: string): CodeSymbol[] {
			const symbols: CodeSymbol[] = [];
			const funcRegex = /^(\s*)(?:async\s+)?def\s+(\w+)\s*\(/gm;
			let match;

			while ((match = funcRegex.exec(content)) !== null) {
				const name = match[2];
				if (!name) continue;

				const line = content.substring(0, match.index).split("\n").length;
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
		},

		extractPythonClasses(content: string, filePath: string): CodeSymbol[] {
			const symbols: CodeSymbol[] = [];
			const classRegex = /^(\s*)class\s+(\w+)(?:\s*\([^)]*\))?\s*:/gm;
			let match;

			while ((match = classRegex.exec(content)) !== null) {
				const name = match[2];
				if (!name) continue;

				const line = content.substring(0, match.index).split("\n").length;
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
		},

		extractGeneric(content: string, filePath: string): CodeSymbol[] {
			// Fallback: look for any word that looks like a declaration
			const symbols: CodeSymbol[] = [];
			// Simple: find lines starting with common keywords
			const lines = content.split("\n");
			lines.forEach((line, index) => {
				const trimmed = line.trim();
				if (trimmed.startsWith("func ") || trimmed.startsWith("function ") ||
				    trimmed.startsWith("class ") || trimmed.startsWith("struct ") ||
				    trimmed.startsWith("interface ")) {
					const words = trimmed.split(/\s+/);
					const name = words[1]?.replace(/[({].*/, "");
					if (name) {
						symbols.push({
							type: "function",
							name,
							file: filePath,
							start: content.indexOf(trimmed),
							end: content.indexOf(trimmed) + trimmed.length,
							signature: trimmed,
							language: "unknown",
						});
					}
				}
			});
			return symbols;
		},

		formatSymbol(sym: CodeSymbol): string {
			const doc = sym.doc ? `\n${sym.doc}` : "";
			return `[${sym.type}] ${sym.signature}${doc}\nFile: ${sym.file}:${this.lineNumberFromOffset(sym.start)}`;
		},

		captureSignature(content: string, startIdx: number): string {
			// Capture from start to the opening brace/paren or 100 chars
			const slice = content.substring(startIdx, startIdx + 200);
			const bracePos = slice.indexOf("{") || slice.indexOf("=>");
			const endPos = bracePos > 0 ? startIdx + bracePos : startIdx + slice.length;
			return content.substring(startIdx, endPos).trim();
		},

		languageFromExtension(ext: string): string | null {
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
		},

		lineNumberFromOffset(offset: number): number {
			// Approximate: count newlines before offset
			// In full impl, you'd track per-file content
			return 1; // placeholder
		},

		shouldIndexFile(filePath: string): boolean {
			const ext = extname(filePath).toLowerCase();
			return opts.extensions.includes(ext) && !filePath.includes("node_modules") && !filePath.includes(".git");
		},

		handleFileEvent(event: string, filePath: string) {
			if (!this.shouldIndexFile(filePath)) return;

			// Debounce
			if (debounceTimers.has(filePath)) {
				clearTimeout(debounceTimers.get(filePath));
			}

			debounceTimers.set(
				filePath,
				setTimeout(async () => {
					debounceTimers.delete(filePath);
					if (event === "unlink") {
						// Remove all memories for this file
						await this.removeFileIndex(filePath);
					} else {
						await this.indexFile(filePath);
					}
				}, opts.debounceMs)
			);
		},

		async removeFileIndex(filePath: string) {
			// Find all memories with this file_path and delete them
			// Simple approach: query and delete
			// Optimized: direct SQL: DELETE FROM memories WHERE file_path = ?
			// For now, assume engine has a way to query by metadata
			// We'll add a helper method later
			console.log(`Removing index for ${filePath}`);
			// TODO: implement efficient delete by file_path
		},

		getStats() {
			// Return indexing stats
			return { indexedFiles: 0, pending: debounceTimers.size };
		},
	};
}

function getFilesRecursive(dir: string): string[] {
	const files: string[] = [];

	function walk(currentDir: string) {
		const items = existsSync(currentDir) ? readFileSync(currentDir, { withFileTypes: true }) : [];
		for (const item of items) {
			const fullPath = join(currentDir, item.name);
			if (item.isDirectory()) {
				walk(fullPath);
			} else if (item.isFile()) {
				files.push(fullPath);
			}
		}
	}

	walk(dir);
	return files;
}
