/**
 * AutoCompact Tool
 *
 * Automatically compacts/optimizes source code by:
 * - Removing console.log statements
 * - Minifying whitespace (basic)
 * - Removing trailing spaces
 * - Optionally: compact JSON, etc.
 *
 * Usage:
 *   import { autoCompact } from '@quangtynu/pi-tools/autocompact'
 *   const result = await autoCompact('/path/to/file.js')
 */

import * as fs from "fs";
import * as path from "path";

export interface AutoCompactOptions {
	/** Remove console.* statements (default: true) */
	removeConsole?: boolean;
	/** Remove empty lines (default: false) */
	removeEmptyLines?: boolean;
	/** Trim trailing whitespace (default: true) */
	trimTrailing?: boolean;
	/** Custom patterns to remove (regex strings) */
	removePatterns?: readonly string[];
}

export interface AutoCompactResult {
	/** Path to the file */
	path: string;
	/** Original content length */
	originalSize: number;
	/** New content length */
	newSize: number;
	/** Bytes saved */
	delta: number;
	/** Whether file was modified */
	changed: boolean;
	/** Error message if any */
	error?: string;
}

/**
 * Compacts a JavaScript/TypeScript file
 */
export async function autoCompactFile(filePath: string, options: AutoCompactOptions = {}): Promise<AutoCompactResult> {
	const defaults: AutoCompactOptions = {
		removeConsole: true,
		removeEmptyLines: false,
		trimTrailing: true,
		removePatterns: [],
	} as Required<Pick<AutoCompactOptions, "removePatterns">> & AutoCompactOptions;
	const opts = { ...defaults, ...options };

	try {
		const content = await fs.promises.readFile(filePath, "utf-8");
		let compacted = content;

		// Remove console statements
		if (opts.removeConsole) {
			compacted = compacted.replace(/console\.(log|debug|info|warn|error)\s*\([^;]*\);\s*/g, "");
		}

		// Remove custom patterns
		const patterns = opts.removePatterns || [];
		for (const pattern of patterns) {
			try {
				const regex = new RegExp(pattern, "g");
				compacted = compacted.replace(regex, "");
			} catch (_e) {
				// skip invalid regex
			}
		}

		// Trim trailing whitespace on each line
		if (opts.trimTrailing) {
			compacted = compacted
				.split("\n")
				.map((line) => line.replace(/\s+$/, ""))
				.join("\n");
		}

		// Remove empty lines if requested
		if (opts.removeEmptyLines) {
			compacted = compacted
				.split("\n")
				.filter((line) => line.trim() !== "")
				.join("\n");
		}

		// Ensure ends with newline
		if (!compacted.endsWith("\n")) {
			compacted += "\n";
		}

		const changed = compacted !== content;

		if (changed) {
			await fs.promises.writeFile(filePath, compacted, "utf-8");
		}

		return {
			path: filePath,
			originalSize: Buffer.byteLength(content, "utf-8"),
			newSize: Buffer.byteLength(compacted, "utf-8"),
			delta: Buffer.byteLength(content, "utf-8") - Buffer.byteLength(compacted, "utf-8"),
			changed,
		};
	} catch (error: any) {
		return {
			path: filePath,
			originalSize: 0,
			newSize: 0,
			delta: 0,
			changed: false,
			error: error.message,
		};
	}
}

/**
 * Compacts all files in a directory recursively
 */
export async function autoCompactDirectory(
	dirPath: string,
	options: AutoCompactOptions & {
		/** File extensions to process (default: ['.ts', '.js', '.tsx', '.jsx']) */
		extensions?: string[];
		/** Maximum file size in bytes (default: 1MB) */
		maxFileSize?: number;
	} = {},
): Promise<AutoCompactResult[]> {
	const defaults = {
		extensions: [".ts", ".js", ".tsx", ".jsx", ".mjs", ".cjs"],
		maxFileSize: 1024 * 1024, // 1MB
	};
	const opts = { ...defaults, ...options };
	const results: AutoCompactResult[] = [];

	async function walk(dir: string) {
		const entries = await fs.promises.readdir(dir, { withFileTypes: true });
		for (const entry of entries) {
			const fullPath = path.join(dir, entry.name);

			if (entry.isDirectory()) {
				await walk(fullPath);
			} else if (entry.isFile()) {
				const ext = path.extname(entry.name);
				if (opts.extensions!.includes(ext)) {
					// Check file size
					const stat = await fs.promises.stat(fullPath);
					if (stat.size > opts.maxFileSize!) {
						results.push({
							path: fullPath,
							originalSize: stat.size,
							newSize: stat.size,
							delta: 0,
							changed: false,
							error: "File too large",
						});
						continue;
					}

					const result = await autoCompactFile(fullPath, options);
					results.push(result);
				}
			}
		}
	}

	await walk(dirPath);
	return results;
}

/**
 * Main entry: autoCompact
 * Accepts either a file path or directory path
 */
export async function autoCompact(
	target: string,
	options: AutoCompactOptions & {
		extensions?: string[];
		maxFileSize?: number;
	} = {},
): Promise<AutoCompactResult[]> {
	const stat = await fs.promises.stat(target);

	if (stat.isDirectory()) {
		return await autoCompactDirectory(target, options);
	} else {
		return [await autoCompactFile(target, options)];
	}
}
