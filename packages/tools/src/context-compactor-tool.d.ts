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
    compactedFiles?: string[];
    /** For message compaction */
    compactedMessages?: ChatMessage[];
    /** Error if any */
    error?: string;
}
/**
 * Rough token estimation: 1 token ≈ 4 characters for English/code.
 * This is conservative and works without external deps.
 */
export declare function estimateTokens(text: string): number;
/**
 * Remove comments from code (basic regex-based)
 */
export declare function stripCodeComments(code: string): string;
/**
 * Trim whitespace: remove trailing spaces, collapse multiple blank lines
 */
export declare function trimWhitespace(text: string): string;
/**
 * Compact a single file's content
 */
export declare function compactFileContent(content: string, filePath: string, opts?: CompactOptions): Promise<{
    compacted: string;
    tokensBefore: number;
    tokensAfter: number;
}>;
/**
 * Compact a directory recursively
 */
export declare function contextCompactDirectory(dirPath: string, opts?: CompactOptions): Promise<CompactResult>;
/**
 * Compact chat messages for LLM context
 */
export declare function contextCompactMessages(messages: ChatMessage[], opts?: CompactOptions): Promise<CompactResult>;
/**
 * Main function: auto-detect input type and compact
 *
 * @param input { type: 'directory', path: string } OR { type: 'messages', messages: ChatMessage[] }
 * @param options CompactOptions
 */
export declare function contextCompact(input: {
    type: "directory";
    path: string;
} | {
    type: "messages";
    messages: ChatMessage[];
}, options?: CompactOptions): Promise<CompactResult>;
//# sourceMappingURL=context-compactor-tool.d.ts.map