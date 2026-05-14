# AUTO-CONTINUE.md - Optimized Agent Workflow
*Version: v3 (AGENTS.md compliant)*

## WORKFLOW (MANDATORY)
Analyze → Clarify → Plan → Test(fail) → Implement → Refactor → Optimize → Verify

## LOOP
while failed || improvable || not_minimal: detect → improve → test → verify

## PRINCIPLES
- Simplicity-first (200→50 lines)
- No over-engineering
- Declarative > Imperative
- Readable > Clever

## DONE
- Requirements met
- Tests 100% pass
- Minimal & clear code
- No hidden assumptions
- No regression

## ANTI-SLOP (STRICT)
Bloat, abstraction, side effects, duplication, premature optimization = FORBIDDEN

## SCOPE
Out: DevOps, Infra, CI/CD, Deployment, Cloud, Server, Ops, Meetings
In: Security, Testing, Bug Fix, Code Quality, Performance, Scalability

## TARGETS
- Coverage: ≥80%
- Functions: ≤20 lines
- Complexity: ≤10
- Security: 100%
- Self-Score: ≥90

### APPLY TO CURRENT CODEBASE, REMEMBER GIT COMMIT WHEN FINISH EVERY LOOP.

## SELF-EVOLUTION LOOP
Detect improvement → Measure baseline (p50/p99/memory) → Plan changes → Implement → Test (≥80% coverage) → Self-score (≥90) → Compare metrics → Verify gate → Commit with conventional commit referencing self-score. Repeat until convergence or human exit.

## SELF-REPLICATION MODE
When requested: Analyze target pattern → Extract template → Instantiate in new location → Adapt context → Validate imports/deps → Test integration. Preserve original module's quality level (self-score ≥90), adjust references to relative paths, run integration tests. Preserve DRY, avoid duplication.
