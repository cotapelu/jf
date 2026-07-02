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

/** Summarize a batch of messages using extractive approach (simple for MVP) */
export function summarizeMessages(messages: { role: string; content: string }[]): string {
  if (messages.length === 0) return '(no messages to summarize)';
  // Simple extractive: take first and last few messages, and any tool calls
  const important: string[] = [];
  for (const msg of messages) {
    if (msg.role === 'tool' || msg.role === 'function') {
      important.push(`[TOOL] ${msg.content.slice(0, 200)}`);
    }
  }
  const firstUser = messages.find(m => m.role === 'user');
  const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
  if (firstUser) important.push(`[USER] ${firstUser.content.slice(0, 200)}`);
  if (lastAssistant) important.push(`[ASSISTANT] ${lastAssistant.content.slice(0, 200)}`);
  if (important.length === 0) {
    // fallback: just list counts
    return `Summarized ${messages.length} messages.`;
  }
  return important.join('\n...\n');
}

/** Main compaction function */
export async function compactSession(
  messages: { role: string; content: string }[],
  options: CompactionOptions
): Promise<CompactionResult> {
  const originalTokens = estimateTokens(JSON.stringify(messages));
  if (originalTokens <= options.maxTokens) {
    return {
      originalTokens,
      compactedTokens: originalTokens,
      summary: '',
      removedMessages: 0,
    };
  }

  // Strategy: if preserveRecent, keep the last N messages (approx 1/3 of budget)
  let cutoffIndex = 0;
  if (options.preserveRecent) {
    const recentTokensEstimate = Math.floor(options.maxTokens * 0.3);
    for (let i = messages.length - 1; i >= 0; i--) {
      const tokens = estimateTokens(JSON.stringify(messages[i]));
      if (recentTokensEstimate - tokens >= 0) {
        cutoffIndex = i;
      } else break;
    }
  }

  // Messages to compact: older ones before cutoff
  const toCompact = messages.slice(0, cutoffIndex);
  const preserved = messages.slice(cutoffIndex);
  const summary = summarizeMessages(toCompact);
  const summaryTokens = estimateTokens(summary);
  const preservedTokens = estimateTokens(JSON.stringify(preserved));

  // Ensure within budget
  let finalMessages = preserved;
  let finalSummary = summary;
  let totalTokens = preservedTokens + summaryTokens;
  if (totalTokens > options.maxTokens) {
    // If still over, shrink summary
    const allowedSummary = options.maxTokens - preservedTokens;
    if (allowedSummary < 100) {
      // Can't fit even minimal summary; remove some preserved
      // simplistic: drop one preserved message if possible
      finalMessages = preserved.slice(1);
      finalSummary = summary.slice(0, Math.max(10, allowedSummary));
    } else {
      finalSummary = summary.slice(0, Math.min(summary.length, allowedSummary * 4));
    }
    totalTokens = estimateTokens(JSON.stringify(finalMessages)) + estimateTokens(finalSummary);
  }

  return {
    originalTokens,
    compactedTokens: totalTokens,
    summary: finalSummary,
    removedMessages: toCompact.length,
  };
}
