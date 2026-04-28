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
export declare function autoCompactFile(filePath: string, options?: AutoCompactOptions): Promise<AutoCompactResult>;
/**
 * Compacts all files in a directory recursively
 */
export declare function autoCompactDirectory(
	dirPath: string,
	options?: AutoCompactOptions & {
		/** File extensions to process (default: ['.ts', '.js', '.tsx', '.jsx']) */
		extensions?: string[];
		/** Maximum file size in bytes (default: 1MB) */
		maxFileSize?: number;
	},
): Promise<AutoCompactResult[]>;
/**
 * Main entry: autoCompact
 * Accepts either a file path or directory path
 */
export declare function autoCompact(
	target: string,
	options?: AutoCompactOptions & {
		extensions?: string[];
		maxFileSize?: number;
	},
): Promise<AutoCompactResult[]>;
//# sourceMappingURL=autocompact-tool.d.ts.map
