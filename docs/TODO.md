# 🔧 BUG SCAN TODO LIST

> Generated: 2026-04-20
> Scanned: packages/agent, packages/ai, packages/coding-agent, packages/memory, packages/mom, packages/pods, packages/tui, packages/web-ui

---

## 📊 Summary

| Category | Count | Priority |
|----------|-------|----------|
| Empty Catch Blocks | 17 | CRITICAL |
| Type Safety Issues | 12 | HIGH |
| Resource Leaks | 8 | HIGH |
| Error Handling | 15 | MEDIUM |
| Edge Cases | 10 | MEDIUM |
| Performance Issues | 5 | LOW |
| **TOTAL** | **67** | - |

---

## 🔴 CRITICAL BUGS - Empty Catch Blocks (Silent Failures)

These catch blocks silently swallow errors, making debugging impossible:

### 1. `packages/mom/src/slack.ts:448`
```typescript
} catch {}
```n**Issue**: Error silently swallowed during Slack operations  
**Fix**: Add error logging: `} catch (e) { log.error('Slack error:', e); }`

### 2. `packages/coding-agent/src/core/skills.ts:63, 276`
```typescript
} catch {}
```n**Issue**: Skill loading/parsing errors silently ignored  
**Fix**: Log errors and provide fallback behavior

### 3. `packages/memory/src/store/sqlite-store.ts:354, 395`
```typescript
} catch {}
```n**Issue**: Database operations may fail silently  
**Fix**: Add error logging and potentially re-throw critical errors

### 4. `packages/coding-agent/src/core/package-manager.ts:209`
```typescript
} catch {}
```n**Issue**: Package manager operations fail silently  
**Fix**: Add error logging

### 5. `packages/ai/src/providers/openai-codex-responses.ts:438, 447, 450, 512, 730, 847`
```typescript
} catch {}
```n**Issue**: Multiple silent failures in response handling  
**Fix**: Add comprehensive error logging

### 6. `packages/coding-agent/examples/extensions/custom-provider-anthropic/index.ts:505, 528`
```typescript
} catch {}
```n**Issue**: Extension example has silent failures  
**Fix**: Add proper error handling for extension developers

---

## 🟠 HIGH PRIORITY - Type Safety Issues

### 1. `any` Type Usage
**Files affected:**
- `packages/agent/src/types.ts:340-341` - Tool execution result/args typed as `any`
- `packages/mom/src/agent.ts:583, 585, 834` - Multiple `as any` assertions
- `packages/web-ui/src/components/*` - `any` types in dialog components
- `packages/memory/src/code-indexer.ts:198` - `any` in timer casting

**Fix:** Replace `any` with proper TypeScript types or `unknown` with type guards.

### 2. Non-null Assertions (`!`)
**Files affected:**
- `packages/tui/src/components/box.ts:100` - `this.cache!.lines`
- `packages/tui/src/terminal.ts:166` - `this.stdinBuffer!.process(data)`
- `packages/tui/src/components/editor.ts:54, 2029` - Unsafe array access
- `packages/web-ui/src/ChatPanel.ts:98` - `this.agent!.state.messages`

**Fix:** Add null checks before accessing properties.

### 3. `@ts-ignore` / `@ts-expect-error`
**Search pattern found:** Multiple files use these directives.  
**Fix:** Remove and fix underlying type issues or add proper explanations.

---

## 🟠 HIGH PRIORITY - Resource Leaks

### 1. Timer Leaks
**Files:**
- `packages/tui/src/tui.ts:450, 479` - `renderTimer` cleanup
- `packages/tui/src/stdin-buffer.ts:258, 356, 371` - `timeout` cleanup
- `packages/tui/src/components/editor.ts:2219` - `autocompleteDebounceTimer`
- `packages/memory/src/code-indexer.ts:352, 415` - `debounceTimers`
- `packages/mom/src/events.ts:93, 99, 116, 168` - Multiple timers
- `packages/ai/src/providers/openai-codex-responses.ts` - Multiple idleTimer leaks

**Issue:** Timers may not be cleared on component unmount/error paths.  
**Fix:** Ensure `clearTimeout`/`clearInterval` in `finally` blocks.

### 2. Event Listener Leaks
**Files:**
- `packages/tui/src/terminal.ts` - Resize handlers
- `packages/agent/src/proxy.ts` - Abort signal listeners

**Issue:** Event listeners may not be removed.  
**Fix:** Use `AbortController` pattern consistently.

### 3. File Handle Leaks
**Files:**
- `packages/memory/src/code-indexer.ts` - File watchers not cleaned up on error
- `packages/tui/src/terminal.ts` - Raw mode not restored on crash

---

## 🟡 MEDIUM PRIORITY - Error Handling

### 1. `process.exit()` Without Cleanup
**Files:**
- `packages/pods/src/cli.ts:61, 66, 88, 107, 129, 137, 142`
- `packages/coding-agent/src/main.ts` - Multiple exit points

**Issue:** Abrupt exits may leave resources dangling.  
**Fix:** Implement graceful shutdown with cleanup hooks.

### 2. Incomplete Error Information
**Files:**
- `packages/agent/src/agent-loop.ts:71, 75, 128, 132` - Generic error messages
- `packages/memory/src/tools.ts` - Generic `e as Error` casting

**Fix:** Include context in error messages (e.g., which tool call failed).

### 3. Promise Rejections Not Handled
**Pattern found:** `void someAsyncFunction()` without try-catch

**Files:**
- `packages/agent/src/agent-loop.ts:44-48` - `void runAgentLoop`
- `packages/agent/src/agent-loop.ts:56-60` - `void runAgentLoopContinue`

**Fix:** Add `.catch()` handlers or use proper async/await with try-catch.

---

## 🟡 MEDIUM PRIORITY - Edge Cases

### 1. Race Conditions
**Files:**
- `packages/coding-agent/src/core/auth-storage.ts` - File locking mentioned but verify implementation
- `packages/agent/src/agent-loop.ts:550` - `Promise.all(updateEvents)` may have race

**Fix:** Review concurrent access patterns, especially for file/storage operations.

### 2. Array Bounds Checking
**Files:**
- `packages/memory/src/consolidation.ts` - Array access without bounds checks
- `packages/tui/src/components/editor.ts` - Cursor position validation

**Fix:** Add bounds checking before array access.

### 3. JSON Parsing Without Try-Catch
**Pattern found:** `JSON.parse()` without validation

**Files:**
- `packages/mom/src/store.ts` - Message parsing from log files
- `packages/memory/src/schemas.ts` - Schema validation

**Fix:** Wrap `JSON.parse` in try-catch with validation.

### 4. Division by Zero
**Files:**
- `packages/memory/src/consolidation.ts` - TF-IDF calculation
- `packages/memory/src/heat.ts` - Score calculations

**Fix:** Add zero checks before division.

---

## 🟢 LOW PRIORITY - Performance & Code Quality

### 1. Unnecessary Computations
**Files:**
- `packages/memory/src/code-indexer.ts:198` - `Math.min` with potentially -1 result
- `packages/memory/src/consolidation.ts` - Duplicate stats() calls

### 2. Regex Performance
**Files:**
- `packages/memory/src/code-indexer.ts` - Multiple regex executions without caching

**Fix:** Pre-compile regex patterns.

### 3. Memory Leaks in Caching
**Files:**
- `packages/mom/src/store.ts` - `recentlyLogged` Map grows unbounded (but has TTL)
- `packages/ai/src/providers/openai-codex-responses.ts` - Response cache

**Fix:** Add cache size limits and LRU eviction.

---

## 📋 Priority Action Plan

### Phase 1: Critical (Week 1)
- [ ] Fix all 17 empty catch blocks
- [ ] Add error logging infrastructure
- [ ] Write tests for error conditions

### Phase 2: High Priority (Week 2-3)
- [ ] Fix `any` types in core packages (agent, ai)
- [ ] Fix timer leaks in TUI
- [ ] Add AbortController patterns

### Phase 3: Medium Priority (Week 4)
- [ ] Implement graceful shutdown
- [ ] Add JSON parsing validation
- [ ] Fix race conditions in auth/storage

### Phase 4: Low Priority (Ongoing)
- [ ] Performance optimizations
- [ ] Code quality improvements
- [ ] Documentation updates

---

## 🛠️ Specific Fix Instructions

### Fix: Empty Catch Block Pattern
```typescript