# Evolution Roadmap

*3-6 month trajectory for continuous improvement*

---

## Current State (Phases 1-12 Complete)

**All Core Phases 1-12 (Complete):**
- ✅ Refactored monolithic session tool (638 lines → 13 modular functions)
- ✅ Comprehensive test suite (191 tests, 100% pass)
- ✅ Coverage: Statements 91.26%, Branches 82.59%, Functions 90.83%, Lines 92.45%
- ✅ Quality infrastructure: ESLint, Prettier, CI/CD, coverage thresholds
- ✅ Concurrency safety (Mutex), session history limit, disk rotation
- ✅ Structured logging (pretty + JSON), diagnostics integration

**Phase 11: Skills Implementation (Complete)**
- ✅ Created Skill Orchestrator system (`src/tools/skills/`)
  - `SkillEngine` with YAML loading, parameter validation, LLM execution
  - `skillTool` ToolDefinition for LLM invocation
  - Built-in skill definitions: `refactor.extract-function`, `test.generate-unit-test`, `doc.generate-jsdoc`
- ✅ Skills testing framework (unit tests for skill engine and built-in skills): 5 tests added

**Phase 12: Extensions Framework (Complete)**
- ✅ ExtensionRegistry: modular plugin system with registration, initialization, disposal
- ✅ GitExtension: 5 git tools (status, diff, commit, push, pull) with error handling
- ✅ Unit tests: ExtensionRegistry (11), GitExtension (5) = +16 tests
- ✅ Integrated extensions into main runtime
- ✅ All tools use proper error handling and input validation

**Architecture Achievements:**
- Functions ≤20 lines: 100%
- Complexity ≤10: 100%
- Duplicate code: 0
- Error handling: 100% public
- Input validation: 100% external

**Next Phases (PI_SDK_CAPABILITIES Roadmap):**
- Phase 13: Codebase Indexer (AST scanning)
- Phase 14: Context Compaction (auto-summarize)


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

### ✅ 2.3 Test Gap Mitigation (COMPLETED)
**Priority:** MEDIUM  
**Progress:**
- ✅ Large session trees (>100 nodes) - done  
- ✅ Invalid parameter validation - done  
- ✅ Concurrent operations race conditions - fixed with Mutex  
- ✅ WeakRef GC simulation - covered by dispose test  

**Outcome:** All gaps addressed; test count increased from 92→105 (13 new tests total).

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

## Next Actions

All high-priority quality and reliability tasks are complete. The codebase is production-ready with:
- Comprehensive test coverage (170 tests, 100% pass)
- >91% statement coverage, >82% branch coverage
- Full coverage on all operations and utilities (export, list, tag, info, rename, delete, utils, logger, etc.)
- Concurrency safety (Mutex)
- Disk rotation (session.cleanup)
- Structured logging (pretty/JSON)
- Diagnostics integration (cleanup stats)
- CI/CD pipeline (GitHub Actions)

Optional future work:
- Extended diagnostics metrics
- Refine test mocks to reduce `any`

---

*Roadmap last updated: 2026-06-17*
