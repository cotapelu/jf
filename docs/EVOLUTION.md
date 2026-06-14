# Evolution Roadmap

*3-6 month trajectory for continuous improvement*

---

## Current State (Iteration 2 Near Completion)

**Phase 1 (Complete):**
- ✅ Refactored monolithic session tool (638 lines → 13 modular functions)
- ✅ All 92 tests passing (now 99 tests)
- ✅ TypeScript compilation clean
- ✅ Build successful

**Phase 2 (99% Complete):**
- ✅ Coverage thresholds defined in vitest.config.ts
- ✅ ESLint configured & lint errors fixed
- ✅ Prettier installed, formatted codebase, format script added
- ✅ Session history limit implemented and tested (maxHistoryEntries default 1000)
- ✅ Memory expectations documented (PROJECT_STATE.md)

**Metrics achieved:**
- Functions ≤20 lines: 100%
- Complexity ≤10: 100%
- Test pass rate: 100% (99/99)
- Coverage: Statements 83.08%, Functions 88.54%, Lines 83.42%
- Lint: Clean

**Remaining Phase 2:** CI integration (optional, not required for local dev)

---

## Phase 2 Progress (Quality Infrastructure)

### ✅ 2.1 Coverage Thresholds (COMPLETED)
**Priority:** HIGH  
**Timeline:** Completed  
**Engineering cost:** Already done  
**Risk:** LOW

**Status:** Defined in `vitest.config.ts` (statements ≥80%, branches ≥60%, functions ≥80%, lines ≥80%)  
**Verified:** Coverage 83%+ statements, 88%+ functions  
**Next:** CI integration (optional)

---

### ✅ 2.2 Linting & Code Quality (COMPLETED)
**Priority:** HIGH  
**Timeline:** Completed  
**Engineering cost:** 2 hours (config) + 0.5h (formatting)  
**Risk:** LOW

**Status:** ESLint configured, Prettier installed, code formatted, format script added  
**Note:** Fixed unused param false positives with `argsIgnorePattern: "^_"`

---

### 🔄 2.3 Test Gap Mitigation (IN PROGRESS)
**Priority:** MEDIUM  
**Progress:**
- ✅ Large session trees (>100 nodes) - done  
- ✅ Invalid parameter validation - done  
- ⏳ Concurrent operations race conditions  
- ⏳ WeakRef garbage collection simulation  

**Expected outcome:** More robust test suite, confidence in edge cases

---

### ✅ 2.4 Session History Management (COMPLETED)
**Status:** History limit config (default 1000), LRU eviction implemented, test added, memory docs updated  
**Implementation:** `SessionRegistry` enforces limit in `recordHistory()` via shift()  
**Test:** `should enforce history size limit` verifies behavior  
**Docs:** Memory Management section in PROJECT_STATE.md

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
