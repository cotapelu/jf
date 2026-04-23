# SYSTEM.md - Workflow & Governance Reference

> **Note**: This file contains **workflow and governance guidance only**. For full agent rules, see `CLAUDE.md` (primary) and `AGENTS.md` (code generation mindset).

---

## 🚦 WORKFLOW LOOP (Per Turn)

```
READ → PLAN → IMPLEMENT → VERIFY → REFLECT → LEARN → DOCUMENT → COMMIT
```

**Step-by-step**:
1. **Read**: Load `docs/PROJECT_STATE.md`, `docs/TODO.md`, relevant code
2. **Plan**: Form internal plan; if complex, write to `docs/plan/`
3. **Implement**: Make coherent, complete changes (not tiny patches)
4. **Verify**: Run builds/tests, capture output, fix failures
5. **Reflect**: Perform SELF-REFLECTION CYCLE (assess quality, hunt bugs, simulate failures)
6. **Learn**: Log issues to `docs/MEMORY.md`; if COUNT ≥ 2 → trigger RULE EVOLUTION
7. **Document**: Update `docs/PROJECT_STATE.md`, `docs/TODO.md`, `docs/AGENT_METRICS.md`, `docs/MEMORY.md`
8. **Commit**: `git add <files> && git commit -m "descriptive message"`

---

## 📋 BOOTSTRAP PROTOCOL

**First-time repository encounter** (no `docs/PROJECT_STATE.md`):

**MUST** create (all required for self-awareness):
- `docs/PROJECT_STATE.md` — current state, what works, what's broken
- `docs/TODO.md` — prioritized engineering tasks
- `docs/AGENT_PROFILE.md` — frequent failure modes, stack-specific errors
- `docs/AGENT_METRICS.md` — iterations per task, test failure rate, rollback count
- `docs/MEMORY.md` — recurring issues (format: `[TYPE]: ISSUE | FIX | COUNT`)
- `docs/EVOLUTION.md` — 3–6 month technical roadmap

---

## 📊 PROJECT STATE MANAGEMENT

**Single Source of Truth**: `docs/PROJECT_STATE.md`

**Must contain**:
- What the project is & does
- Current capabilities & limitations
- Architectural decisions (with rationale)
- Known technical debt
- Change history (append-only)

**Update rule**: After every meaningful change, update this file to reflect:
- What changed, why, new capabilities, remaining issues

---

## ⚖️ CHANGE RISK MODEL

Every Feature/Refactor/Migration in `PROJECT_STATE.md` must include:

| Field | Values |
|-------|--------|
| **Cost** | Low / Medium / High (engineering hours) |
| **Risk** | Low / Medium / High (breakage likelihood) |
| **Rollback** | Time estimate (e.g., "2h") |

**Priority order**: Low-risk/high-impact → Medium-risk/medium-impact → High-risk only if blocking

---

## 🧠 SELF-REFLECTION & LEARNING SYSTEM

After every code generation/implementation, perform structured self-analysis:

1. **Requirements Check**: Task objectives → Code coverage (ĐỦ/THIẾU)
2. **Bug Hunt**: Find hidden bugs, missing validation, error handling, security issues
3. **Failure Simulation**: Assume production runtime → potential failure points & why
4. **Quality Dimensions** (self-score 0-10): Simplicity, Clarity, Robustness, Efficiency, Maintainability
5. **Self-Score**: If score < 8 → **mandatory** learning update & rule evolution

**Output**: Internal notes only (unless user asks for SELF_ANALYSIS mode).

---

## 🛡️ GOVERNANCE RULES

### Anti-Amnesia
- Never treat codebase as disposable
- Do not reintroduce deleted concepts without explicit reason
- Repository is a **living organism** — maintain coherence

### Blast Radius Limit
- Change **only one major subsystem** at a time
- Exceptions: emergency security fix (document why)

### Anti-Thrash
- Recently refactored systems **do not** get rewritten again unless broken
- Wait ≥7 days before reconsidering major refactor (unless urgent) — allows time for issues to surface naturally

### Prime Invariant
**System must always be more correct than before** — never degrade quality.

---

## 🔍 UI WORKFLOW

UI changes driven by **visual evidence**:

User provides: screenshot / design / vague command

You must:
1. Locate UI code
2. Make change
3. Rebuild
4. Show result to user (describe differences or attach updated screenshot)

---

## 🤔 ORACLE MODE (Deep Research)

When stuck:
1. Dump all known facts, files, questions into `docs/oracle/{timestamp}.md`
2. Perform deep research/brainstorming pass
3. Output: hypotheses, ideas, possible explanations **marked as unverified**
4. Verify via: code analysis, tests, runtime behavior

Oracle output **never** modifies codebase without verification.

---

## ⏹️ STOP CONDITION

Stop when:
- ✅ All tests pass
- ✅ No critical issues
- ✅ No obvious high-impact improvements
- ✅ System is buildable & runnable

**Never** stop for aesthetic reasons alone.

**Measurable stop criteria**: No TODOs with risk ≤ Medium remain, or all tests pass with zero critical issues.

---

## 📝 CHANGE CLASSIFICATION

Record every meaningful change in `PROJECT_STATE.md`:

```markdown
## [Date] — Type: Bugfix/Feature/Refactor/Debt/Migration

**What**: One-line summary
**Why**: Rationale
**Impact**: Areas affected
**Risk/Cost**: From risk model
**Verification**: Tests passed / manual confirmed
```

---

## 🔗 Related Files

- `CLAUDE.md` — Full system rules (PRIMARY)
- `AGENTS.md` — Code generation mindset
- `SKILL.md` — Development rules & commands
- `APPEND_SYSTEM.md` — AI-Native vision & paradigm

---

**Mantra**: *Read. Plan. Ship. Verify. Reflect. Learn. Document. Evolve.*