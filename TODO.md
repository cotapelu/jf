# Project TODO - Tracked Tasks

*Last updated: 2026-06-14T10:00:00Z*

---

## Phase 1: Critical Refactoring (COMPLETED ✅)

- [x] Refactor session tool execute() from 638 lines to modular operations
- [x] Extract 12 operation functions (<20 lines each)
- [x] Ensure all functions ≤20 lines
- [x] Maintain all tests passing (92)
- [x] Verify TypeScript compilation clean
- [x] Build successfully

---

## Phase 2: Quality Infrastructure (IN PROGRESS 🔄)

### 2.1 Coverage Thresholds ✅ COMPLETED
- [x] Add coverage config to vitest.config.ts
- [x] Verify coverage ≥80% on statements/functions/lines
- [ ] Integrate coverage check into CI (if CI exists)

### 2.2 Linting & Code Quality ✅ COMPLETED
- [x] Configure ESLint (typescript-eslint)
- [x] Fix unused variable false positives (underscore-prefixed params)
- [x] Run lint - no errors
- [x] Apply Prettier formatting to codebase
- [x] Add `format` script to package.json

### 2.3 Test Gap Mitigation ✅ COMPLETED
- [x] Add large session trees (>100 nodes) performance test
- [x] Add concurrent session operations test (now passing with mutex fix)
- [x] Add invalid parameter type validation tests (missing sessionId)
- [x] Add WeakRef garbage collection simulation test (covered by existing dispose test)

**Note:** Fixed race condition by adding `Mutex` in `MultiSessionManager` to serialize `createChild` and `switchTo`.
All tests now pass (101).

### 2.4 Session History Management ✅ COMPLETED
- [x] Add history limit config (default 1000)
- [x] Implement LRU eviction in SessionRegistry
- [x] Add test for history overflow behavior
- [x] Document memory expectations

---

## Phase 3: Future Enhancements (PENDING ⏳)

- [ ] Review and reduce `any` usage in test mocks
- [ ] Reorganize tool registration under src/tools/ subdirectories
- [ ] Add session file rotation/cleanup strategy
- [ ] Consider Pino/Winston logger for structured logging
- [ ] Integrate with runtime diagnostics

---

## Immediate Next Tasks (Priority Order)

1. [x] Reduce `any` usage in test mocks (completed)
2. [ ] Reorganize tool registration (optional, 2 hours)
3. [ ] Add session file rotation (optional, 3 hours)
4. [ ] Consider structured logging (optional, 2 hours)

Total estimated: ~7 hours (if all done)

---

## Completed Tasks Log

| Date | Task | Iteration |
|------|------|-----------|
| 2026-06-14 | Refactored session tool 638→modular | 1 |
| 2026-06-14 | Fixed ESLint unused param false positives | 2 |
| 2026-06-14 | Updated evolution docs (metrics, profile, roadmap) | 2 |
| 2026-06-14 | Created PROJECT_STATE.md & TODO.md | 2 |

---

*TODO last updated: 2026-06-14*
