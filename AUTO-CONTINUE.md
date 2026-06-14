# AUTO-CONTINUE.md - Optimized Agent Workflow
*Version: v2.1 Compact (AGENTS.md compliant)*

---

## WORKFLOW (MANDATORY)

```
Analyze → Clarify → Plan → Test(fail) → Implement → Refactor → Optimize → Verify

LOOP: while failed || improvable || not_minimal:
  detect → improve → test → verify
```

---

## SESSION START (BẮT BUỘC)

Mỗi session mới hoặc sau khi đọc codebase mới:

1. Đọc toàn bộ repository
2. Đọc `docs/PROJECT_STATE.md` (nếu có)
3. Hiểu capabilities và failures hiện tại
4. Xác định next highest-impact task
5. Implement improvements
6. Run tests/builds với tools
7. Update `PROJECT_STATE.md`
8. Update `TODO.md` với completed và follow-ups

---

## CONTINUOUS LOOP MODE

Default: continuous evolution. Sau khi complete iteration, phải identify next highest-impact TODO và tiếp tục work, ngay cả khi không có user prompt mới, UNLESS:
- User explicitly tells you to stop/pause
- Tests/builds fail và cần clarification
- Không còn actionable TODO items

---

## EVOLUTION & SELF-IMPROVEMENT (CORE)

**Mỗi vòng loop phải update evolution files:**

- `docs/AGENT_METRICS.md`: Iterations/task, test failure rate, rollback count, regressions, MTTR
- `docs/AGENT_PROFILE.md`: Tasks thường fail, weak languages/stacks, fragile modules, weaknesses
- `docs/EVOLUTION.md`: Trajectory changes, planned refactors, anticipated debt updates

**Meta-Goal:** System breaks less, fixes faster, plans further ahead, ít repeated mistakes.

---

## GIT COMMIT (MANDATORY)

**SAU KHI HOÀN THÀNH MỘT VÒNG LOOP:**

```bash
git add -A
git commit -m "chore: evolution round - <brief description>"
```

Chỉ sau git commit xong thì mới bắt đầu vòng mới.

---

## MENTAL TESTING (KHÔNG VIẾT CODE)

- Tưởng tượng valid/invalid/null/edge cases
- Từng nhánh logic được cover?
- Error paths được handle?
- Data flow cả 2 chiều (UI→DB và DB→UI)
- Nếu thiếu → VIẾT THÊM code (không skip)

---

## CODE PRESERVATION (KHÔNG XÓA)

**Debug bắt buộc:**
1. Đọc toàn bộ file (không chỉ đoạn suspected)
2. Hiểu context: dependencies, structure, related logic
3. Tìm root cause: check braces, imports, async/sync, lifetimes
4. Incremental: add debug prints, isolate sections, test hypotheses từng bước
5. Systematic: Read → Understand → Isolate → Test → Verify

**Nếu vẫn fail:** Consult team, review git history, pair programming, disable feature tạm thời thay vì xóa code, luôn có plan restore.

**Cấm tuyệt đối:** Xóa code để pass test, "vá áo" fix tạm thời, chấp nhận degradation.

---

## CHANGE COST & RISK

**Mỗi Feature/Refactor/Migration phải assess:**
- Engineering cost (hours/days)
- Risk: **Low** / **Medium** / **High**
- Estimated rollback time

**Prefer:** Low-risk, high-impact > high-risk, aesthetic/speculative.

---

## MISSING CODE = WRITE MORE

- Nếu thiếu feature, API, logic, edge case → **VIẾT THÊM**
- KHÔNG skip vì "không yêu cầu"
- KHÔNG remove code để simplify
- KHÔNG pass nhanh bằng cách giảm scope
- **App phải ngày càng hoàn thiện**, không less complete

---

## SKILL INTEGRATION (6+ REQUIRED)

Đọc skill file trước khi modify:

| Skill | Use Case |
|-------|----------|
| `angular-modular-architect` | Angular SPA |
| `backend-db-pattern` | Database (4 steps) |
| `code-review` | Cleanup |
| `dotnet-modular-architect` | .NET monolith |
| `erp-architect` | Fullstack ERP |
| `iam-platform-layer` | Auth/Security |
| `go-architect` | Go services |
| `python-architect` | Python apps |
| `react-architect` | React apps |
| `rust-architect` | Rust systems |

---

## DEBUGGING CHECKLIST

**Systematic Process:**
1. Read entire file (mọi dòng, imports)
2. Understand context (structure, related logic)
3. Isolate problem (reproduction case)
4. Test hypotheses (debug prints, unit tests)
5. Verify fix (no regression)

**Per-file:**
- [ ] Đọc toàn bộ file trước khi modify
- [ ] Identify root cause (không skip)
- [ ] Check braces, parentheses, indentation
- [ ] Verify async/await, promises
- [ ] Check lifetimes (memory, connections)
- [ ] Review error logs full context
- [ ] Add debug output nếu cần
- [ ] Isolate section bằng comments
- [ ] Test hypotheses từng bước
- [ ] Verify happy & error paths

**Nếu vẫn fail:** Consult team, review git history, disable feature tạm thời (không xóa), plan restore.

**Cấm:** Xóa code để pass, vá áo, chấp nhận degradation.

---

## QUICK REFERENCE

**Mental Test Prompt:**
`Inputs/Outputs/Branches/Errors/DataFlow(UI↔DB)/Security/Performance/Concurrency/State/Observability`

**Quality Gate Checklist:**
```
[✔] Funcs≤20 | Comp≤10 | No dup5 | 100% ErrHnd | 100% Val | No secrets | Testable
[✔] Cov≥80% | Tests pass | No 12 anti-patterns | Devil's advocate | Mental test done
[✔] Flow coverage (UI→DB & DB→UI) | Missing code written | Code preserved
[✔] Risk assessed (Low/Med/High) | Git committed
```

**Risk Levels:**
- **Low**: Docs, refactor same module, add tests, fix typos
- **Medium**: Add feature, modify API, change DB schema
- **High**: Rewrite core, change architecture, security fix

**Git Commit Format:**
```
feat: <description>
fix: <description>
refactor: <description>
chore: evolution round - <description>
```

---

## PRINCIPLES & SCOPE & TARGETS

**Principles:**
- Simplicity-first (200→50 lines)
- No over-engineering
- Declarative > Imperative
- Readable > Clever

**Scope:**
- **Out:** DevOps, Infra, CI/CD, Deployment, Cloud, Ops, Meetings
- **In:** Security, Testing, Bug Fix, Code Quality, Performance, Scalability

**Targets:**
- Coverage ≥80%
- Functions ≤20 lines
- Complexity ≤10
- Security 100%
- Self-Score ≥90

---

## DONE & ANTI-SLOP

**DONE:**
- Requirements met
- Tests 100% pass
- Minimal & clear code
- No hidden assumptions
- No regression

**ANTI-SLOP (STRICT):**
Bloat, abstraction, side effects, duplication, premature optimization = FORBIDDEN

---

*v2.1 Compact: ~135 lines. Evolution-focused workflow with all critical features.*
