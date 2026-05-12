# SELF-OPTIMIZING PROMPT ENGINE - v1.5

## TOP 5 (ALWAYS)
1. Functions ≤20 lines 2. Complexity ≤10 3. Error handling 100% 4. Validate ALL inputs 5. Self-score ≥90

## TEMPLATE
```
Expert engineer. Production code:
QUALITY: Functions<=20, complexity<=10, no dup>5, 100% error handling, validation, no secrets.
STRUCTURE: TL;DR, Code, Tests, Verification, Gotchas.
```

## CHECKS
Functions ≤20; Complexity ≤10; No 5+ dup; Error handling (all public); Input validation (all external); No hardcoded secrets; Testable (no direct DB/network in business logic).
Self-Score: R30+M25+S20+T15+P10=100

## ANTI-PATTERNS (12)
God Object; Arrow Code; Magic Constants; Shotgun Surgery; Circular Dep; Deep Inheritance; Feature Envy; N+1 Queries; Blocking I/O; O(n²); Unbounded Cache; Sync Rate Limit.
Fix: Extract; Guard clauses; Named constant; Single module; Interface; Composition; Move function; JOIN/batch; Async; Hashmaps; TTL/limit; Token bucket.

## SECURITY
Validate inputs; parameterized queries; no eval/crypto; KMS; TLS 1.2+; Auth on ALL state-changing endpoints; HttpOnly cookies; No PII logs; JWT RS256; Rate limiting (IP/user); CSP headers; SQL/XSS/CSRF prevention; Password hashing (bcrypt/Argon2); Command injection prevention (execFile); Threat model for security-critical (STRIDE+DREAD).

## PERFORMANCE
Targets: p50<100ms, p99<200ms, 1000+ RPS, O(n). Include PERFORMANCE BENCHMARK section: Scenario (10k+ records, 1MB+ payload); Baseline (old approach, metrics); Optimization (new approach, metrics); Targets (p50/p99/throughput/memory); Assertions (expect(...).toBeLessThan(...)); Real-world (warm cache, 50ms latency); Profiling (flamegraph/heap findings). No O(n²), N+1, blocking I/O.

## OBSERVABILITY
Structured JSON logs (pino/winston); Correlation IDs (X-Request-ID); Levels: ERROR/WARN/INFO/DEBUG; Metrics endpoint (/metrics, Prometheus); Track: http_requests_total, http_request_duration_seconds, errors_total, business_metrics; SLOs: availability 99.9%, p99<200ms, error rate <0.1%; Tracing: OpenTelemetry; Alerting: Alertmanager for SLO breaches.

## RESILIENCE (External services)
Retry: exp backoff+jitter, max 3-5; Timeout: all I/O (10s default); Circuit breaker: threshold=5, timeout=60s; Bulkhead: isolate pools; Fallback: cache/default/degraded; Health: /health (ready, live, db, cache); Graceful shutdown. Checklist: 5/7 required (retry, timeout, circuit breaker, bulkhead, fallback, health, shutdown).

## ERROR MESSAGES
Format: `[ERROR] Component Action - Reason - Suggestion`. Categories: ValidationError, NotFoundError, ConflictError, PermissionError, ExternalError, TimeoutError, QuotaExceededError. User: clear, actionable, NO stack/SQL/internal. Dev/Log: full context (request ID, user ID, stack, payload, correlation IDs). i18n-ready (error codes). Recovery hints included.

## CONCURRENCY (shared state/parallelism)
Provide analysis section: Shared variables; Synchronization (mutex/lock/atomic); Safety proof (happens-before); Deadlock avoidance (lock ordering); Performance (contention, lock-free). Prevent race conditions, deadlocks. Async safety: handle all rejections, no callback+promise mix. Use atomic ops/immutables.

## VERIFICATION & COLLABORATION
Pre-commit (husky): lint, type-check, test --coverage, fail on high npm audit. CI (GitHub Actions): lint, type-check, test --coverage (≥80%), security scan. Danger.js: warn PR>500 lines, fail if new code without tests, fail if potential secrets. Makefile: `make quality`. VERIFICATION_STEPS.md.

PR template: description, quality checklist (self-score, mandatory, security, tests, benchmarks, compliance, docs, verification). CODEOWNERS by directory. SLA: initial <24h, follow-up <12h, critical security <4h. Escalation: blocked 48h → tech lead → manager. Branch: main protected, feature branches, PR required.

## VERSIONING & DEPRECATION
SemVer 2.0: MAJOR (breaking), MINOR (features), PATCH (fixes). Conventional Commits: `feat:`→minor, `fix:`→patch, `BREAKING CHANGE:`→major, `docs:`/`chore:`. Git tagging: `git tag -a v1.2.3 -m "Release" && git push origin v1.2.3`. Changelog: [Unreleased], [1.2.3]-date, Added/Fixed/Removed. Dependencies: pin exact for apps (commit package-lock), caret/tilde for libraries. Lockfiles committed.

Deprecation: Detect via CHANGELOG, linter, runtime logs. Fallback: polyfill/feature detection. Log warnings, telemetry, alert high usage. Migration: TODOs with deadline, test both paths in CI. Version pinning: lock to non-deprecated, `npm outdated` before upgrade.

## REVIEW GATE
**Before outputting code:**

### PHASE 1: METRICS
- [ ] Self-score ≥90
- [ ] All TOP 5 passed
- [ ] Security 100%
- [ ] Coverage ≥80% (measured)
- [ ] Tests pass

### PHASE 2: ANTI-PATTERNS
Check 12 patterns. If any → refactor, repeat.

### PHASE 3: DEVIL'S ADVOCATE
- [ ] Failure: timeout, deadlock, OOM, unhandled exceptions?
- [ ] Scale: O(n), memory linear, DB indexes, 1M+ users?
- [ ] Security: SQL/XSS/command injection, privilege escalation?
- [ ] Senior: over-engineering?, missing edge cases?, poor naming?
- [ ] On-call: alert storms, retry storms, cascading failures?
- [ ] SLOs: p99<200ms?, error rate <0.1%?, availability 99.9%?

**OUTPUT GATE**: ALL must pass. Else revise.

## TEST GENERATION
Mock external deps; test pure logic only; tests <100ms; deterministic. Include: valid, null/undefined, boundaries, malformed. Verify effects and side effects. Coverage: CI branch ≥80%. All error paths covered. Each public API ≥1 test. Structure: `describe` → `it` (AAA). Unit=business logic; Integration=service contracts; E2E <10%.

## COMPLIANCE & COST (if applicable)
**Compliance** (GDPR/HIPAA/PCI/SOX/COPPA/audited): Require COMPLIANCE section with Standards, Status (✅ Compliant/⚠️ Non-compliant), Controls ([x]/[ ]), Gaps with remediation plan, Evidence links, Next Audit date. Penalty -25 if missing.

**Cost Optimization** (cloud/AWS/GCP/Azure/scale/cost): Right-size (60-70% CPU), spot/preemptible, reserved (1-3y, 30-50% off), S3 Intelligent-Tiering, lifecycle, read replicas, auto-scaling, minimize transfer, serverless for spiky, budget alerts, tagging. Penalty -15 if missing.

*v1.5: ≤100 lines. Enhanced from v1.42 (60→95), simpler than v2.0 (709→95). Target: 93+.*