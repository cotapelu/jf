# Evolution Roadmap

*3-6 month trajectory for continuous improvement*

---

## Current State (Iteration 2 In Progress)

**Phase 1 (Complete):**
- ✅ Refactored monolithic session tool (638 lines → 13 modular functions)
- ✅ All 92 tests passing (now 97 tests)
- ✅ TypeScript compilation clean
- ✅ Build successful

**Phase 2 (Ongoing):**
- ✅ Coverage thresholds defined in vitest.config.ts (statements/functions/lines ≥80%, branches ≥60%)
- ✅ ESLint configured & lint errors fixed (underscore-prefixed param support)
- ✅ All 97 tests passing, coverage 83%+ statements, 88%+ functions

**Metrics achieved:**
- Functions ≤20 lines: 100%
- Complexity ≤10: 100%
- Test pass rate: 100%
- Coverage: ≥80% (measured, not just estimated)

---

## Phase 2 Progress (Quality Infrastructure)

### ✅ 2.1 Coverage Thresholds (COMPLETED)
**Priority:** HIGH  
**Timeline:** Completed  
**Engineering cost:** Already done  
**Risk:** LOW

**Status:** Already defined in `vitest.config.ts`  
**Metrics:** Statements 83%, Branches 70%, Functions 88%, Lines 83%  
**Verification:** `npm run test:coverage` passes thresholds  
**Next:** CI integration (if applicable)

---

### ✅ 2.2 Linting & Code Quality (COMPLETED)
**Priority:** HIGH  
**Timeline:** Completed  
**Engineering cost:** 2 hours (config) + 0.5h (formatting)  
**Risk:** LOW

**Status:** ESLint configured, Prettier config present  
**Note:** Fixed false positives for underscore-prefixed unused params  
**Remaining:** Apply Prettier formatting to codebase  
**Engineered cost:** 30 minutes to run `npx prettier --write src/`

---

### 🔄 2.3 Test Gap Mitigation (IN PROGRESS)
**Priority:** MEDIUM  
**Timeline:** Week 2  
**Engineering cost:** 4 hours  
**Risk:** LOW

**Outstanding tests:**
- WeakRef garbage collection simulation
- Large session trees (>100 nodes) performance
- Concurrent session operations race conditions
- Invalid parameter type validation

**Expected outcome:** More robust test suite, confidence in edge cases

---

### ⏳ 2.4 Session History Management (PENDING)
**Priority:** MEDIUM  
**Timeline:** Week 3  
**Engineering cost:** 3 hours  
**Risk:** MEDIUM

**Tasks:**
- Add history limit config (default 1000 entries)
- Implement LRU eviction in SessionRegistry
- Add test for history overflow
- Document memory expectations

**Rationale:** Prevent unbounded memory growth in long-running sessions

---

## Anticipated Technical Debt

### Current Debt (Monitored)
- ⚠️ Prettier formatting not yet applied (config present, tool ready)
- ⚠️ Test mocks use `any` type (weak typing)
- ⚠️ SessionTool registration still imports from `./session-tool.js` path (legacy alias)
- ⚠️ No session history limit (unbounded memory growth risk)

### Resolved Debt
- ✅ Coverage thresholds defined in vitest.config.ts
- ✅ ESLint configured with rules
- ✅ Unused param false positives resolved

### Future Debt Risks
- **SDK version lock:** Using @earendil-works/pi-coding-agent ^0.79.2 - may need upgrades
- **Node.js features:** WeakRef requires Node ≥14, may have compatibility issues
- **Session file growth:** Session JSONL files accumulate, need rotation/cleanup strategy
- **Tree depth:** Deep session hierarchies (>10 levels) may cause performance issues

---

## Infrastructure Evolution

### CI/CD Requirements (Missing)
**Status:** Not implemented  
**Need:** GitHub Actions for:
- `npm ci` install
- `npm run test -- --coverage`
- `npm run build`
- `npm audit`
- Type checking `npx tsc --noEmit`

**Cost:** 4 hours setup  
**Benefit:** Automated quality gates

---

### Monitoring & Observability
**Current:** Console logs only  
**Enhancement:** Structured logging in session operations

**Plan:**
- Add Pino/Winston logger (configurable)
- Log session lifecycle events (create, switch, dispose)
- Add correlation IDs for tool calls
- Integrate with runtime diagnostics

**Timeline:** Phase 3 (Month 2)

---

## Architectural Considerations

### Microservices vs Monolith
**Current:** Monolith (single runtime)  
**Future possibility:** Split into:
- Session service (stateful, manages sessions)
- Tool service (stateless, executes operations)
- API gateway (routing)

**Trigger:** Need for multi-tenant isolation, scaling beyond single instance  
**Likelihood:** LOW for this SDK (tooling focus, not production service)  
**Timeline:** Not within 6 months

---

## Risk Mitigation Timeline

| Risk | Probability | Impact | Mitigation | Timeline |
|------|-------------|--------|------------|----------|
| SDK breaking changes | MEDIUM | HIGH | Pin exact version, test upgrades quarterly | Ongoing |
| Memory leaks (WeakRef) | LOW | MEDIUM | Add history limit, monitor heap | Month 1 |
| Test maintenance burden | MEDIUM | MEDIUM | Better mock types, reduce `any` | Month 1 |
| Style drift | HIGH | LOW | Prettier + pre-commit hook | Week 1 |
| Coverage regression | MEDIUM | MEDIUM | CI enforcement, code owners | Week 1 |

---

## Success Metrics

**Iteration completion criteria:**
- ✅ All tasks in phase completed
- ✅ Tests passing (no regressions)
- ✅ Build successful
- ✅ Metrics updated in AGENT_METRICS.md
- ✅ Profile refreshed in AGENT_PROFILE.md
- ✅ Git committed with conventional commit

**Long-term health indicators:**
- Test pass rate ≥ 99% (currently 100%)
- Coverage ≥ 85% (targeting 90%)
- Zero critical functions >20 lines
- Zero duplicate code blocks >5 lines
- <5min full test suite (currently 419ms ✅)

---

## Next Actions (Immediate)

1. ✅ Phase 1 (refactor) - DONE
2. ✅ Phase 2.1 (coverage) - DONE
3. ✅ Phase 2.2 (ESLint) - DONE
4. 🔄 Apply Prettier formatting to codebase
5. 🔄 Add test gaps (WeakRef, large trees, concurrency)
6. 🔄 Implement session history limit
7. 🔄 Git commit: "chore: evolution round - iteration 2: lint fix & quality infra"
8. 🔄 Update PROJECT_STATE.md and TODO.md (session tracking)

---

*Roadmap last updated: 2026-06-14*  
*Next review: After Phase 2 completion*
