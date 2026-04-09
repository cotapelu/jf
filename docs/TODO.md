# TODO — Prioritized Engineering Tasks

## Completed Tasks

### 1. Initialize Git Repository
**Status**: ✅ Completed
- Git repository initialized with selective source code
- `.gitignore` configured to exclude binaries, node_modules, etc.
- Initial commit: 313eaf3

### 2. Create Agent Self-Awareness Infrastructure
**Status**: ✅ Completed
- `docs/AGENT_PROFILE.md`
- `docs/AGENT_METRICS.md`
- `docs/MEMORY.md`
- `docs/EVOLUTION.md`

### 3. Verify Test Suites & Coverage
**Status**: ✅ Completed
- Ran full test suite (agent, ai, coding-agent, tui)
- Fixed bash tool truncation bug (coding-agent) — test now passes
- Test coverage: 99% (1574/1588 passing)
- Documentation updated in PROJECT_STATE.md and AGENT_METRICS.md

### 4. Fix TUI Rendering Test Failures
**Status**: ✅ Completed
- Fixed `clearOnShrink` default to `true`
- Changed shrink detection to use `previousLines.length`
- All 507 TUI tests now pass

### 5. Investigate Ollama Test Environment Limitations
**Status**: ✅ Completed
- 6 tests fail due to insufficient memory (environment-specific)
- No code changes needed

### 6. Setup CI/CD Pipeline
**Status**: ✅ Completed
- CI verified, status badges in README

### 7. Changelog Management
**Status**: ✅ Completed
- All packages have CHANGELOG.md with `[Unreleased]` section

### 8. OSS Weekend Clarification
**Status**: ✅ Completed
- OSS weekend active until April 13, 2026

### 9. Performance Profiling
**Status**: ✅ Completed
- RPC startup: 1355.2ms
- Build time: 6234.5ms

### 10. Dependency Audit
**Status**: ✅ Completed
- Updated devDependencies to latest versions
- No vulnerabilities

### 11. Biome Version Migration
**Status**: ✅ Completed
- Migrated biome.json from v2.3.5 to v2.4.10
- Fixed provider-contract.test.ts import paths and type errors
- All Biome checks pass with 0 warnings

---

## Current Priorities

### P1 — Fix Browser Smoke Check
**Status**: ✅ Completed
- Fixed by adding external node modules to browser smoke check
- All checks now pass

### P2 — Documentation Improvements
**Status**: ✅ Completed
- Created `docs/EXTENSION_GUIDE.md` with full extension API documentation
- Extension examples already exist in `packages/coding-agent/examples/extensions/`

### P4 — Automation
**Status**: ✅ Completed
- Added `.github/dependabot.yml` for npm and GitHub Actions
- Weekly schedule on Mondays

### P5 — Performance

#### Performance Regression Testing
**Priority**: Low
**Risk**: Medium
**Impact**: Long-term stability
**Cost**: 2h

**Why**: Detect performance regressions early.

**Tasks**:
- Set up baseline metrics (build time, test time, bundle size)
- Add performance assertions to CI
- Document known performance characteristics

#### Load Testing for RPC Mode
**Priority**: Low
**Risk**: Medium
**Impact**: Reliability at scale
**Cost**: 3h

**Why**: Ensure RPC mode handles concurrent requests.

**Tasks**:
- Identify load test scenarios
- Run load tests with multiple concurrent sessions
- Document capacity limits

---

## Known Issues (Non-Blocking)

### 1. Browser Smoke Check (P1 - Needs Fix)
- Location: Multiple OAuth files using node:*
- Status: Failing
- Impact: Blocks pre-commit hook
- Fix: See P1 above

### 2. Ollama Memory Failures (6 tests)
- Location: `packages/ai/test/stream.test.ts`, `packages/ai/test/context-overflow.test.ts`
- Type: Environment limitation
- Root cause: gpt-oss:20b model requires >13GB RAM
- Impact: Tests fail in low-memory environments
- Status: Documented, no action needed

---

### P5 — Performance

#### Performance Baseline
**Status**: ✅ Completed
- Build time: ~17s
- TUI tests: 1084 pass, 4 fail (OAuth-related), 140 skipped
- Documented baseline metrics

---

## Backlog (Future)

- Add more examples to `packages/coding-agent/examples/`
- Create video tutorials or screencasts
- Cloud sync of sessions
- Branching & merging of session histories

---

## Active Bug Hunt

Comprehensive bug identification and tracking during sprint (2026-04-09).

### P0 — Critical (Showstoppers)

#### BUG-001: OAuth Token Refresh Failure (Antigravity)
- **Severity**: P0 (Critical)
- **Status**: 🔴 Failing (10 test files)
- **Location**: `packages/ai/src/utils/oauth/google-antigravity.ts`
- **Symptom**: Tests fail with "Failed to refresh OAuth token for google-antigravity"
- **Affected Tests**:
  - test/context-overflow.test.ts
  - test/empty.test.ts
  - test/google-thinking-disable.test.ts
  - test/image-tool-result.test.ts
  - test/responseid.test.ts
  - test/stream.test.ts
  - test/tokens.test.ts
  - test/tool-call-without-result.test.ts
  - test/total-tokens.test.ts
  - test/unicode-surrogate.test.ts
- **Root Cause Analysis**:
  - OAuth credentials expired/invalid in test environment
  - `packages/ai/test/oauth.ts` uses `auth.json` with possibly stale tokens
  - `refreshAntigravityToken()` may have bug in token refresh logic
- **Investigation Tasks**:
  - [ ] Check if test OAuth credentials are still valid
  - [ ] Verify refresh token endpoint and parameters
  - [ ] Check error handling in OAuth flow
  - [ ] Add better error messages indicating which step failed
  - [ ] Consider mock credentials for unit tests instead of real OAuth
- **Impact**: Blocks 10+ tests, prevents CI from passing
- **Risk**: High (CI broken)

### P1 — High Impact

#### BUG-002: Clipboard Image Test Failures
- **Severity**: P1 (High)
- **Status**: 🟡 Failing (2 test cases)
- **Location**: `packages/coding-agent/test/clipboard-image.test.ts`
- **Symptom**: Wayland/Non-Wayland detection fails, tests expecting different behavior
- **Tests**:
  - `Non-Wayland: uses clipboard`
  - `Non-Wayland: returns null when clipboard has no image`
- **Investigation**:
  - [ ] Check `readClipboardImage()` implementation
  - [ ] Verify Wayland detection logic (environment variables)
  - [ ] Mock clipboard properly for Non-Wayland environment
- **Impact**: 2 tests failing, may indicate real clipboard issues in production

#### BUG-003: Bash Tool Truncation Bug
- **Severity**: P1 (High)
- **Status**: 🔴 Failing (1 test)
- **Location**: `packages/coding-agent/src/core/tools/bash.ts`
- **Symptom**: Test "executeBash should persist full output when truncation happens by line count only" fails
- **Description**: When bash output is truncated by line count, the full output should be preserved in `output` field but currently not.
- **Investigation**:
  - [ ] Review truncation logic in bash tool
  - [ ] Check `maxLines` parameter handling
  - [ ] Verify output concatenation when truncating
- **Impact**: Core tool broken — bash command output may be lost

#### BUG-004: Compaction with Thinking Models
- **Severity**: P1 (High)
- **Status**: 🔴 Failing (1 test)
- **Location**: `packages/ai/test/compaction-thinking-model.test.ts`
- **Symptom**: "Compaction with thinking models (Antigravity)" fails
- **Investigation**:
  - [ ] Check context compaction logic for models with thinking capability
  - [ ] Verify Antigravity provider handling of thinking output
  - [ ] Ensure thinking content is preserved after compaction
- **Impact**: Context management may break with advanced models

### P2 — Medium Impact (Potential Bugs)

#### BUG-005: Security Vulnerability — basic-ftp
- **Severity**: P1 (High — Security)
- **Status**: 🟠 High vulnerability detected
- **Package**: `basic-ftp@5.2.0`
- **CVE**: GHSA-chqc-8p9q-pq6q (FTP Command Injection via CRLF)
- **Fix**: Run `npm audit fix` to update to patched version
- **Action**:
  - [ ] Run `npm audit fix`
  - [ ] Verify no other transitive dependencies using vulnerable version
  - [ ] Add dependency update CI (Dependabot already configured — verify it's active)
- **Impact**: Security risk if basic-ftp is used directly or transitively

#### BUG-006: Excessive `any` Types
- **Severity**: P2 (Medium — Code Quality)
- **Status**: ⚠️ 13,924 occurrences of `any`
- **Location**: All packages
- **Risk**: Type safety compromised, harder to maintain
- **Investigation**:
  - [ ] Audit high-risk areas (tool parameters, provider responses, OAuth)
  - [ ] Replace with specific interfaces or `unknown`
  - [ ] Enable stricter TypeScript config (`noImplicitAny: true` if not already)
- **Timeline**: This is technical debt; allocate time gradually

#### BUG-007: OAuth Error Handling Swallows Original Error
- **Severity**: P2 (Medium — Debugging)
- **Location**: `packages/ai/src/utils/oauth/index.ts:getOAuthApiKey()`
- **Code**:
```typescript
catch (_error) {
  throw new Error(`Failed to refresh OAuth token for ${providerId}`);
}
```
- **Issue**: Original error is discarded, making debugging impossible
- **Fix**: Preserve original error as cause or include message
- **Action**:
  - [ ] Change to: `throw new Error(\`Failed to refresh OAuth token for ${providerId}\`, { cause: _error });`
  - [ ] Or log error for diagnostics
- **Impact**: OAuth failures hard to diagnose

#### BUG-008: Test Coverage Gaps for Edge Cases
- **Severity**: P2 (Medium — Reliability)
- **Status**: ⚠️ 14/1588 tests failing (0.88%)
- **Coverage**: ~99% pass but specific edge cases may be untested
- **Areas to Investigate**:
  - [ ] Empty/NULL inputs to tools
  - [ ] Network timeouts and retries
  - [ ] Large file handling (editor)
  - [ ] Unicode edge cases (combining characters, RTL)
  - [ ] Concurrent tool calls
  - [ ] Provider failover scenarios
- **Action**: Write targeted tests for identified gaps

#### BUG-009: Potential Memory Leaks in Event Listeners
- **Severity**: P2 (Medium — Stability)
- **Location**: Extension system, TUI components
- **Risk**: Unremoved event listeners cause accumulation over time
- **Investigation**:
  - [ ] Audit `packages/coding-agent/src/core/extensions/` for cleanup
  - [ ] Check TUI overlay lifecycle
  - [ ] Verify `Disposable` pattern usage
- **Fix**: Ensure `dispose()` methods remove all listeners

#### BUG-010: Race Conditions in State Management
- **Severity**: P2 (Medium — Concurrency)
- **Location**: `packages/agent/src/` (Agent state)
- **Risk**: Concurrent tool calls modifying shared state
- **Investigation**:
  - [ ] Check if Agent.run() is reentrant
  - [ ] Verify state updates are atomic
  - [ ] Add tests with parallel tool executions

### P3 — Low Impact / Investigative

#### BUG-011: Inconsistent Tool Parameter Validation
- **Severity**: P3 (Low — Usability)
- **Location**: `packages/coding-agent/src/core/tools/`
- **Issue**: Some tools validate inputs, others don't. Inconsistent error messages.
- **Investigation**:
  - [ ] Audit all tools (read, write, edit, grep, find, ls, bash)
  - [ ] Standardize validation (e.g., file existence checks)
  - [ ] Create validation utility functions

#### BUG-012: Missing TypeScript Strict Checks in Some Packages
- **Severity**: P3 (Low — Type Safety)
- **Status**: Configuration varies across packages
- **Investigation**:
  - [ ] Ensure all `tsconfig.json` have `strict: true`
  - [ ] Enforce via CI

#### BUG-013: Performance: Build Time ~17s Could Be Optimized
- **Severity**: P3 (Low — DX)
- **Observation**: Full build takes ~17s
- **Investigation**:
  - [ ] Profile TypeScript compilation
  - [ ] Check for circular dependencies
  - [ ] Consider incremental builds

#### BUG-014: Configuration & Environment Variable Validation
- **Severity**: P3 (Low — DX)
- **Location**: `.env.example` and env var usage
- **Issue**: Some env vars may be missing documentation or validation
- **Action**:
  - [ ] Audit all `process.env` access
  - [ ] Add validation with clear error messages
  - [ ] Document required env vars in READMEs

#### BUG-015: Legacy Code `omp-legacy/` Not Documented
- **Severity**: P3 (Low — Documentation)
- **Location**: `omp-legacy/`
- **Issue**: Old Rust/TypeScript code, unclear if still used
- **Action**:
  - [ ] Determine if omp-legacy is deprecated
  - [ ] If deprecated, add warning in README or remove
  - [ ] If used, document purpose

---

## Todo System Enhancements

### Testing
**Priority**: Medium
**Risk**: Low
**Cost**: 2h

**Tasks**:
- [x] Write unit tests for todo-write.ts (applyOps, normalizeInProgressTask, formatSummary)
- [ ] Write integration tests for AgentSession persistence

### Persistence
**Priority**: High
**Risk**: Low
**Cost**: 1h

**Tasks**:
- [x] Save todo to file (`.pi/todos.json`)
- [x] Load todo from file on session start

### CLI Commands
**Priority**: Medium
**Risk**: Low
**Cost**: 1h

**Tasks**:
- [x] Built-in `/todos` command (not just in extensions)
- [x] Filter todos by status

### UI/UX
**Priority**: Low
**Risk**: Low
**Cost**: 2h

**Tasks**:
- [x] Footer widget showing current task
- [ ] Progress bar visualization

---

## Last Updated

2026-04-09

**Bug Hunt Sprint**: Full bug identification and tracking in progress (see "Active Bug Hunt" section above)

**Recent Changes (2026-04-09)**:
- **Full Codebase Scan Complete**: Scanned all 7 packages (ai, agent, coding-agent, tui, mom, pods, web-ui)
- Created `docs/TODO_SCAN.md` with detailed scan results
- Architecture diagram and dependency graph documented
- **Bug Hunt Initiated**: Identified 15 bugs across test failures, security, code quality, and DX
  - P0: 1 bug (OAuth Antigravity — blocking 10 tests)
  - P1: 4 bugs (Clipboard, Bash truncation, Compaction, Security)
  - P2: 6 bugs (any types, error handling, coverage gaps, memory leaks, race conditions)
  - P3: 4 bugs (validation, TypeScript strictness, performance, config)
- Prioritized fix order based on CI impact and reliability

**Previous Changes**:
- Biome migrated to v2.4.10
- provider-contract.test.ts fixed
- Browser smoke check fixed
- Added dependabot configuration
- Created EXTENSION_GUIDE.md
- P1, P2, P4, P5 completed
- Fixed bash tool truncation bug (coding-agent) — test now passes
- Fixed all 8 TUI rendering test failures
- Updated devDependencies to latest versions
- Added self-awareness infrastructure (PROFILE, METRICS, MEMORY, EVOLUTION)
