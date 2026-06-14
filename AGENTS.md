# SELF-OPTIMIZING PROMPT ENGINE - v2.0 (Unified)
**Production-ready code generator với self-evolution**

---

## CORE QUALITY GATE (BẮT BUỘC)

Trước khi output code, phải pass:

**Metrics (≥90 points):**
- [ ] Functions ≤20 lines
- [ ] Complexity ≤10
- [ ] No 5+ duplicates
- [ ] Error handling 100% (all public)
- [ ] Input validation 100% (all external)
- [ ] No hardcoded secrets
- [ ] Testable (no direct DB/network in business logic)
- [ ] Coverage ≥80% (measured)
- [ ] All tests pass

**Anti-Patterns (12):**
God Object; Arrow Code; Magic Constants; Shotgun Surgery; Circular Dep; Deep Inheritance; Feature Envy; N+1 Queries; Blocking I/O; O(n²); Unbounded Cache; Sync Rate Limit.
→ Fix: Extract; Guard clauses; Named constant; Single module; Interface; Composition; Move function; JOIN/batch; Async; Hashmaps; TTL/limit; Token bucket.

**Devil's Advocate:**
- [ ] Failure modes: timeout, deadlock, OOM, unhandled exceptions?
- [ ] Scale: O(n), memory linear, DB indexes, 1M+ users?
- [ ] Security: SQL/XSS/command injection, privilege escalation?
- [ ] Senior: over-engineering, missing edge cases, poor naming?
- [ ] On-call: alert storms, retry storms, cascading failures?
- [ ] SLOs: p99<200ms, error rate <0.1%, availability 99.9%

---

## PRODUCTION STANDARDS (COMPACT)

**Security:** Input validation, parameterized queries, no eval/crypto, KMS, TLS 1.2+, Auth ALL state-changing, HttpOnly cookies, No PII logs, JWT RS256, Rate limiting, CSP, SQL/XSS/CSRF prevention, Password hashing (bcrypt/Argon2), Command injection prevention, Threat model (STRIDE+DREAD).

**Performance:** p50<100ms, p99<200ms, 1000+ RPS, O(n). PERFORMANCE BENCHMARK: Scenario (10k+ records, 1MB+ payload), Baseline/Optimization metrics, Assertions, Real-world (warm cache, 50ms), Profiling. No O(n²), N+1, blocking I/O.

**Observability:** Structured JSON logs, Correlation IDs (X-Request-ID), Levels ERROR/WARN/INFO/DEBUG, Metrics (/metrics, Prometheus), Track: http_requests_total, http_request_duration_seconds, errors_total, business_metrics, SLOs (99.9% availability, p99<200ms, error rate<0.1%), Tracing (OpenTelemetry), Alerting (Alertmanager).

**Resilience:** Retry (exp backoff+jitter, max 3-5), Timeout (all I/O, 10s default), Circuit breaker (threshold=5, timeout=60s), Bulkhead (isolate pools), Fallback (cache/default/degraded), Health (/health: ready, live, db, cache), Graceful shutdown. Checklist: 5/7 required.

**Error Messages:** Format: `[ERROR] Component Action - Reason - Suggestion`. Categories: ValidationError, NotFoundError, ConflictError, PermissionError, ExternalError, TimeoutError, QuotaExceededError. User: clear, actionable, NO stack/SQL/internal. Dev/Log: full context (request ID, user ID, stack, payload, correlation IDs). i18n-ready, recovery hints.

**Concurrency:** Analysis: Shared variables, Synchronization (mutex/lock/atomic), Safety proof (happens-before), Deadlock avoidance (lock ordering), Performance (contention, lock-free). Prevent: race conditions, deadlocks. Async safety: handle all rejections, no callback+promise mix. Use atomic ops/immutables.

**Verification & Collaboration:** Pre-commit (husky): lint, type-check, test --coverage. CI (GitHub Actions): lint, type-check, test --coverage (≥80%), security scan. Danger.js: warn PR>500 lines, fail if new code without tests, fail if potential secrets. Makefile: `make quality`. PR template: description, quality checklist, CODEOWNERS. SLA: initial<24h, follow-up<12h, critical<4h. Protected branches, PR required.

**Versioning & Deprecation:** SemVer 2.0: MAJOR (breaking), MINOR (features), PATCH (fixes). Conventional Commits. Git tagging. Changelog. Pin exact for apps, caret/tilde for libraries. Deprecation: detect via logs, fallback, migration TODOs, version pinning.

---

## SELF-EVOLUTION & PRODUCTION READINESS

**Evolution Files (maintain automatically):**
- `docs/AGENT_METRICS.md`: Iterations/task, test failure rate, rollback count, regressions, MTTR
- `docs/AGENT_PROFILE.md`: Weaknesses, fragile modules, error-prone stacks
- `docs/EVOLUTION.md`: 3-6 month roadmap, planned refactors, debt, infrastructure evolution

**After every meaningful change, update:**
1. Metrics with actual numbers
2. Profile weaknesses (new exposures?)
3. Evolution trajectory (changed?)

**Meta-Goal:** System that breaks less, fixes faster, plans further ahead, makes fewer repeated mistakes.

---

## MANDATORY PRINCIPLES

**Code Preservation:**
- KHÔNG XÓA CODE (last resort)
- Debug: Read → Understand → Isolate → Test → Verify (systematic)
- Nếu lỗi: preserve, tìm root cause, fix logic
- Luôn có plan restore từ git
- Disable feature tạm thời thay vì xóa

**Change Cost & Risk:**
- Estimate engineering cost (hours/days)
- Risk level: Low / Medium / High
- Estimated rollback time
- Prefer Low-risk, high-impact over High-risk, aesthetic

**Missing Code = Write More:**
- Nếu phát hiện thiếu → VIẾT THÊM
- KHÔNG skip "không yêu cầu"
- KHÔNG remove code để simplify
- KHÔNG giảm scope để pass nhanh
- App ngày càng hoàn thiện

**Production Readiness Checklist:**
- [ ] All functions mental-tested (valid/invalid/edge/error)
- [ ] All APIs contract verified
- [ ] All flows UI→DB và DB→UI
- [ ] All edge cases covered
- [ ] All error paths handled
- [ ] Security vulnerabilities none
- [ ] Performance acceptable
- [ ] Industry standards met
- [ ] Documentation updated
- [ ] Missing code = written (not skipped)

**Mental Testing Mode:**
- KHÔNG viết test code (sẽ verify trong đầu)
- KHÔNG check bằng tool (tưởng tượng scenarios)
- Tưởng tượng ALL inputs: valid, invalid, null, empty, boundary
- Từng nhánh logic phải cover
- Tất cả error paths phải handle
- Data flow cả 2 chiều (UI→DB, DB→UI)

---

## CONCURRENCY (shared state/parallelism)

### Analysis Template (BẮT BUỘC)
Khi code có shared state/parallelism, cung cấp:

1. **Shared Variables**: List tất cả shared state (global, static, caches)
2. **Synchronization**: Mutex/lock/atomic/queue used?
3. **Safety Proof**: Happens-before relation, memory barriers
4. **Deadlock Avoidance**: Lock ordering, timeout, lock-free design
5. **Performance**: Contention points, lock-free alternatives
6. **Async Safety**: Handle all rejections, no callback+promise mix

**Prevent:** Race conditions, deadlocks, memory consistency errors.

---

## DEBUGGING & ISSUE RESOLUTION (from code-review skill)

### Systematic Debugging Process
**Bắt buộc thực hiện theo thứ tự:**
1. **Read entire file** - Không chỉ đoạn suspected, đọc mọi dòng, imports, dependencies
2. **Understand context** - Structure, related logic, external calls
3. **Isolate problem** - Reproduction case, minimal code
4. **Test hypotheses** - Add debug prints, unit tests
5. **Verify fix** - Ensure no regression

### Debugging Checklist
- [ ] Đọc toàn bộ file trước khi modify
- [ ] Identify root cause (không skip)
- [ ] Check braces, parentheses, indentation
- [ ] Verify async/await, promises
- [ ] Check lifetimes (memory, connections)
- [ ] Review error logs full context (stack trace, request ID)
- [ ] Add debug output nếu cần
- [ ] Isolate section bằng comments/disable
- [ ] Test hypotheses từng bước
- [ ] Verify both happy path & error paths

### If Still Failing
- Consult team hoặc pair programming
- Review git history để xem previous working state
- Disable feature tạm thời (feature flag) thay vì xóa code
- Always có plan restore từ git

**Cấm tuyệt đối:**
- ❌ Xóa code để pass test
- ❌ "Vá áo" - fix tạm thời gây bug khác
- ❌ Chấp nhận degradation
- ❌ Bỏ qua root cause

---

## FRONTEND ARCHITECTURE (Atomic Design)

### Component Hierarchy
**Atoms**: Basic UI (Button, Input, Icon, Badge, Checkbox...)
**Molecules**: Combinations (FormGroup, Card, Modal, Alert...)
**Organisms**: Complex sections (Header, Sidebar, DataTable, FilterPanel...)
**Templates**: Page layouts (AuthLayout, DashboardLayout...)
**Pages**: Use Templates + Components (KHÔNG viết UI elements mới)

### Rules
- Pages dùng component library (không inline UI)
- Features organized by domain (not layers)
- Mỗi feature có component library riêng hoặc dùng shared
- UI/UX nhất quán qua shared components

### Structure
```
frontend/
├── components/
│   ├── atoms/
│   ├── molecules/
│   └── organisms/
├── features/{feature}/
├── templates/
└── pages/
```

### Validation Checklist
- [ ] Pages sử dụng component library
- [ ] Không có inline UI elements trong pages
- [ ] Components dùng đúng atomic hierarchy
- [ ] Features organized by domain
- [ ] Shared components không chứa business logic

---

## TEST GENERATION (NẾU CẦN TEST CODE)
Mock external deps; test pure logic only; tests <100ms; deterministic. Include: valid, null/undefined, boundaries, malformed. Verify effects and side effects. Coverage: CI branch ≥80%. All error paths covered. Each public API ≥1 test. Structure: `describe` → `it` (AAA). Unit=business logic; Integration=service contracts; E2E <10%.

---

## COMPLIANCE & COST (if applicable)

**Compliance** (GDPR/HIPAA/PCI/SOX/COPPA/audited): Require COMPLIANCE section with Standards, Status (✅ Compliant/⚠️ Non-compliant), Controls ([x]/[ ]), Gaps with remediation plan, Evidence links, Next Audit date. Penalty -25 if missing.

**Cost Optimization** (cloud/AWS/GCP/Azure/scale/cost): Right-size (60-70% CPU), spot/preemptible, reserved (1-3y, 30-50% off), S3 Intelligent-Tiering, lifecycle, read replicas, auto-scaling, minimize transfer, serverless for spiky, budget alerts, tagging. Penalty -15 if missing.

---

## TEMPLATE
```
Expert engineer. Production code:
QUALITY: Functions<=20, complexity<=10, no dup>5, 100% error handling, validation, no secrets.
STRUCTURE: TL;DR, Code, Tests, Verification, Gotchas.
```

---

*v2.0: ~200 lines target. Unified v1.5 + mate extensions. Production-readiness focused.*
