# Evolution Roadmap

*3-6 month trajectory for continuous improvement*

---

## Current State (Iteration 1 Complete)

**Completed:**
- ✅ Refactored monolithic session tool (638 lines → 13 modular functions)
- ✅ All 92 tests passing
- ✅ TypeScript compilation clean
- ✅ Build successful

**Metrics achieved:**
- Functions ≤20 lines: 100%
- Complexity ≤10: 100%
- Test pass rate: 100%
- Coverage: ≥80% (estimated)

---

## Planned Refactors (Phase 2: Quality Infrastructure)

### 2.1 Enforce Coverage Thresholds
**Priority:** HIGH  
**Timeline:** Next iteration (Week 1)  
**Engineering cost:** 2 hours  
**Risk:** LOW

**Tasks:**
- Add vitest coverage config with thresholds (≥80% global)
- Run `npm run test:coverage` in CI
- Fix any coverage gaps

**Expected outcome:** Automated enforcement of coverage requirement

---

### 2.2 Add Code Formatting & Linting
**Priority:** HIGH  
**Timeline:** Week 1-2  
**Engineering cost:** 2 hours  
**Risk:** LOW

**Tasks:**
- Add Prettier config (`.prettierrc`)
- Add ESLint (if not present)
- Format all source files
- Add `format` script to package.json
- Optional: Add husky pre-commit hook

**Expected outcome:** Consistent code style across project

---

### 2.3 Address Test Gaps (Edge Cases)
**Priority:** MEDIUM  
**Timeline:** Week 2  
**Engineering cost:** 4 hours  
**Risk:** LOW

**Tasks:**
- Add tests for WeakRef garbage collection behavior
- Add performance test: large session trees (100+ nodes)
- Add concurrency test: rapid session creation/deletion
- Add type validation tests (invalid params)

**Expected outcome:** More robust test suite, confidence in edge cases

---

### 2.4 Session History Management
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
- ⚠️ No coverage enforcement (mitigated by manual test --coverage)
- ⚠️ No code formatting standard (inconsistent style)
- ⚠️ Test mocks use `any` type (weak typing)
- ⚠️ SessionTool registration still imports from `./session-tool.js` path (legacy alias)

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

1. ✅ Complete Phase 1 (refactor) - DONE
2. 🔄 Add coverage thresholds (vitest.config.ts)
3. 🔄 Add Prettier/ESLint
4. 🔄 Format codebase
5. 🔄 Git commit: "chore: evolution round - initial refactoring complete, adding quality infra"

---

*Roadmap last updated: 2026-06-14*  
*Next review: After Phase 2 completion*
