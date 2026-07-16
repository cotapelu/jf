/**
 * Context Compaction Algorithm
 *
 * Provides functions to estimate token count and summarize session history.
 */

export interface CompactionOptions {
  maxTokens: number;
  preserveRecent: boolean;
  strategy: 'sliding-window' | 'hierarchical';
}

export interface CompactionResult {
  originalTokens: number;
  compactedTokens: number;
  summary: string;
  removedMessages: number;
}

/** Rough token estimation: characters / 4 (approx for English) */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function isImportantMessage(msg: { role: string; content: string }): boolean {
  return msg.role === 'tool' || msg.role === 'function';
}

function formatMessage(msg: { role: string; content: string }): string {
  const snippet = msg.content.slice(0, 200);
  return `[${msg.role.toUpperCase()}] ${snippet}`;
}

/** Summarize a batch of messages using extractive approach (simple for MVP) */
export function summarizeMessages(messages: { role: string; content: string }[]): string {
  if (messages.length === 0) return '(no messages to summarize)';
  const important: string[] = [];

  // Add tool/function messages
  for (const msg of messages) {
    if (isImportantMessage(msg)) {
      important.push(formatMessage(msg));
    }
  }

  // Add first user and last assistant
  const firstUser = messages.find(m => m.role === 'user');
  const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
  if (firstUser) important.push(formatMessage(firstUser));
  if (lastAssistant) important.push(formatMessage(lastAssistant));

  if (important.length === 0) {
    // fallback: just list counts
    return `Summarized ${messages.length} messages.`;
  }
  return important.join('\n...\n');
}

/** Main compaction function */

function computeCutoffIndex(messages: { role: string; content: string }[], options: CompactionOptions): number {
  if (!options.preserveRecent) return 0;
  const recentTokensEstimate = Math.floor(options.maxTokens * 0.3);
  let cutoffIndex = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    const tokens = estimateTokens(JSON.stringify(messages[i]));
    if (recentTokensEstimate - tokens >= 0) {
      cutoffIndex = i;
    } else break;
  }
  return cutoffIndex;
}

function adjustWithinBudget(
  preserved: { role: string; content: string }[],
  summary: string,
  preservedTokens: number,
  summaryTokens: number,
  maxTokens: number
): { finalMessages: { role: string; content: string }[]; finalSummary: string; totalTokens: number } {
  let totalTokens = preservedTokens + summaryTokens;
  let finalMessages = preserved;
  let finalSummary = summary;
  if (totalTokens > maxTokens) {
    const allowedSummary = maxTokens - preservedTokens;
    if (allowedSummary < 100) {
      finalMessages = preserved.slice(1);
      finalSummary = summary.slice(0, Math.max(10, allowedSummary));
    } else {
      finalSummary = summary.slice(0, Math.min(summary.length, allowedSummary * 4));
    }
    totalTokens = estimateTokens(JSON.stringify(finalMessages)) + estimateTokens(finalSummary);
  }
  return { finalMessages, finalSummary, totalTokens };
}

export async function compactSession(
  messages: { role: string; content: string }[],
  options: CompactionOptions
): Promise<CompactionResult> {
  const originalTokens = estimateTokens(JSON.stringify(messages));
  if (originalTokens <= options.maxTokens) {
    return { originalTokens, compactedTokens: originalTokens, summary: '', removedMessages: 0 };
  }
  const cutoffIndex = computeCutoffIndex(messages, options);
  const toCompact = messages.slice(0, cutoffIndex);
  const preserved = messages.slice(cutoffIndex);
  const summary = summarizeMessages(toCompact);
  const summaryTokens = estimateTokens(summary);
  const preservedTokens = estimateTokens(JSON.stringify(preserved));
  const { finalSummary, totalTokens } = adjustWithinBudget(preserved, summary, preservedTokens, summaryTokens, options.maxTokens);
  return {
    originalTokens,
    compactedTokens: totalTokens,
    summary: finalSummary,
    removedMessages: cutoffIndex,
  };
}
