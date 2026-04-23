# 🔧 Bug Fix Sprint - 67 Issues from Comprehensive Scan

> Created: 2026-04-23
> Source: docs/BUG_SCAN_TODO_LIST.md (generated 2026-04-20)
> Scope: All packages (agent, ai, coding-agent, tui, mom, pods, memory, web-ui)

---

## 📊 Summary

| Phase | Priority | Count | Status |
|-------|----------|-------|--------|
| Phase 1 | CRITICAL | 17 locations (empty catch) | Pending |
| Phase 2 | HIGH | 32 issues (type safety + leaks) | Pending |
| Phase 3 | MEDIUM | 15 issues (error handling + edge) | Pending |
| Phase 4 | LOW | 5 issues (performance) | Pending |
| **TOTAL** | - | **67 bugs** | **0% complete** |

---

## 🎯 Goal

Improve code quality, reliability, and maintainability by addressing:
- Silent failure risks (empty catch blocks)
- Type safety issues (`any`, non-null assertions)
- Resource leaks (timers, listeners, file handles)
- Error handling gaps
- Edge case vulnerabilities
- Performance inefficiencies

---

## Phase 1: Critical - Empty Catch Blocks (17 locations)

**Task 1**: Fix empty catch blocks across codebase (17 locations)

**Files/lines**:
1. `packages/mom/src/slack.ts:448`
2-3. `packages/coding-agent/src/core/skills.ts:63, 276`
4-5. `packages/memory/src/store/sqlite-store.ts:354, 395`
6. `packages/coding-agent/src/core/package-manager.ts:209`
7-12. `packages/ai/src/providers/openai-codex-responses.ts:438,447,450,512,730,847`
13-14. `packages/coding-agent/examples/extensions/custom-provider-anthropic/index.ts:505,528`

**Fix**: Change `catch {}` → `catch (e) { log.error('context', e); }`
**Decision**: Per-location whether to re-throw or handle gracefully.

---

## Phase 2: High Priority - Type Safety & Resource Leaks

### Task 2: Replace `any` types (4 locations)
- `packages/agent/src/types.ts:340-341` (tool result/args)
- `packages/mom/src/agent.ts:583,585,834` (as any assertions)
- `packages/web-ui/src/components/*` (dialogs)
- `packages/memory/src/code-indexer.ts:198` (timer casting)

**Action**: Use proper types or `unknown` with type guards.

### Task 3: Fix non-null assertions (!) (4 locations)
- `packages/tui/src/components/box.ts:100`
- `packages/tui/src/terminal.ts:166`
- `packages/tui/src/components/editor.ts:54,2029`
- `packages/web-ui/src/ChatPanel.ts:98`

**Action**: Add null checks before accessing.

### Task 4: Remove @ts-ignore/@ts-expect-error directives
Multiple files. Fix underlying type issues instead of suppressing.

### Task 5: Fix timer leaks (9 locations)
- `packages/tui/src/tui.ts:450,479`
- `packages/tui/src/stdin-buffer.ts:258,356,371`
- `packages/tui/src/components/editor.ts:2219`
- `packages/memory/src/code-indexer.ts:352,415`
- `packages/mom/src/events.ts:93,99,116,168`
- `packages/ai/src/providers/openai-codex-responses.ts`

**Action**: Ensure `clearTimeout/clearInterval` in `finally` or `dispose()`.

### Task 6: Fix event listener leaks (2 locations)
- `packages/tui/src/terminal.ts` (resize handlers)
- `packages/agent/src/proxy.ts` (abort signals)

**Action**: Use `AbortController` consistently, remove listeners on cleanup.

### Task 7: Fix file handle leaks (2 locations)
- `packages/memory/src/code-indexer.ts` (file watchers)
- `packages/tui/src/terminal.ts` (raw mode)

**Action**: Ensure cleanup in `finally`/exit handlers.

---

## Phase 3: Medium Priority

### Task 8: Implement graceful shutdown
**Files**: `packages/pods/src/cli.ts` (7 exits: lines 61,66,88,107,129,137,142) + `packages/coding-agent/src/main.ts`

**Action**: Replace `process.exit()` with cleanup hooks, ensure resources freed, then exit.

### Task 9: Improve error message context
**Files**: `packages/agent/src/agent-loop.ts:71,75,128,132` + `packages/memory/src/tools.ts`

**Action**: Include operation context, preserve error cause: `new Error(msg, {cause: err})`.

### Task 10: Handle unhandled promise rejections
**Files**: `packages/agent/src/agent-loop.ts:44-48,56-60` (void runAgentLoop)

**Action**: Add `.catch()` or wrap in `try-catch`, log properly.

### Task 11: Fix race conditions
**Files**: `packages/coding-agent/src/core/auth-storage.ts` (file locking) + `packages/agent/src/agent-loop.ts:550` (Promise.all)

**Action**: Add proper locking or ensure sequential execution.

### Task 12: Add array bounds checking
**Files**: `packages/memory/src/consolidation.ts` + `packages/tui/src/components/editor.ts`

**Action**: Validate indices before array access.

### Task 13: Wrap JSON.parse with try-catch
**Files**: `packages/mom/src/store.ts` + `packages/memory/src/schemas.ts`

**Action**: Add validation, fallback to defaults.

### Task 14: Add zero division checks
**Files**: `packages/memory/src/consolidation.ts` (TF-IDF) + `packages/memory/src/heat.ts` (scores)

**Action**: Check denominator != 0, handle edge case gracefully.

---

## Phase 4: Low Priority

### Task 15: Fix unnecessary computations
- `packages/memory/src/code-indexer.ts:198` (Math.min with -1)
- `packages/memory/src/consolidation.ts` (duplicate stats calls)

**Action**: Validate inputs, cache results.

### Task 16: Optimize regex performance
**File**: `packages/memory/src/code-indexer.ts`

**Action**: Pre-compile regex patterns instead of recompiling each time.

### Task 17: Add cache size limits (LRU eviction)
**Files**: `packages/mom/src/store.ts` (recentlyLogged Map) + `packages/ai/src/providers/openai-codex-responses.ts` (response cache)

**Action**: Implement size-limited cache with LRU eviction policy.

---

## 📋 Progress Tracking

Use `/todos` command in pi to view current status.

All tasks start as `pending`. Mark as `completed` when done, with notes in `docs/PROJECT_STATE.md`.

---

## 🔗 References

- Original bug scan: `docs/BUG_SCAN_TODO_LIST.md` (if exists)
- Agent Profile: `docs/AGENT_PROFILE.md`
- Memory: `docs/MEMORY.md`
- Evolution: `docs/EVOLUTION.md`
