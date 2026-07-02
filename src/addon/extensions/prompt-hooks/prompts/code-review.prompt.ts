import type { PromptTemplate } from '@earendil-works/pi-coding-agent';

/**
 * Code Review Prompt
 *
 * Usage examples:
 *   /review              → Review focused on security (default)
 *   /review performance  → Review focused on performance
 *   /review security performance
 *
 * Arguments:
 *   $1, $2, ... - positional focus areas
 *   $@ - all focus areas as string
 *   ${1:-security} - default to "security" if no arg
 */

export const codeReviewPrompt: PromptTemplate = {
  name: 'review',
  description: 'Review code for issues (optional: specify focus areas like "security", "performance")',
  filePath: '<inline:code-review>',
  sourceInfo: {
    path: 'src/buildin/extensions/prompts/code-review.prompt.ts',
    source: 'builtin',
    scope: 'project',
    origin: 'top-level',
  },
  content: '# Code Review\n\nFocus areas: ${1:-security, performance, maintainability}\n\nPlease review the provided code with attention to:\n- Security vulnerabilities (SQL injection, XSS, auth flaws)\n- Performance issues (O(n²), N+1 queries, memory leaks)\n- Code quality (complexity, readability, duplication)\n- Error handling (edge cases, proper exceptions)\n- Testing coverage (missing tests, edge cases)\n\nProvide specific findings with line numbers and suggested fixes.',
};
