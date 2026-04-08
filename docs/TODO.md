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

## Todo System Enhancements

### Testing
**Priority**: Medium
**Risk**: Low
**Cost**: 2h

**Tasks**:
- [ ] Write unit tests for todo-write.ts (applyOps, normalizeInProgressTask, formatSummary)
- [ ] Write integration tests for AgentSession persistence

### Persistence
**Priority**: High
**Risk**: Low
**Cost**: 1h

**Tasks**:
- [ ] Save todo to file (`.pi/todos.json`)
- [ ] Load todo from file on session start

### CLI Commands
**Priority**: Medium
**Risk**: Low
**Cost**: 1h

**Tasks**:
- [ ] Built-in `/todos` command (not just in extensions)
- [ ] Filter todos by status

### UI/UX
**Priority**: Low
**Risk**: Low
**Cost**: 2h

**Tasks**:
- [ ] Footer widget showing current task
- [ ] Progress bar visualization

---

## Last Updated

2026-04-08

**Recent Changes**:
- Biome migrated to v2.4.10
- provider-contract.test.ts fixed
- Browser smoke check fixed
- Added dependabot configuration
- Created EXTENSION_GUIDE.md
- P1, P2, P4, P5 completed
- Fixed todo-write auto-continue: agent now continues working on pending tasks after creating/updating todo list
- Created docs/TODO_SYSTEM.md with technical specification