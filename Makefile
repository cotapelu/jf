# Makefile for JF - Pi Coding Agent
# Implements GOAL.md Testing Pipeline (27 Gates)
# Usage: make quality-gates (runs all applicable gates)

.PHONY: help quality-gates all-gates

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ========================================
# TIER 1: SOURCE & BUILD GATES
# ========================================

quality-gates: source-hygiene dependency-check clean-build artifact-verify static-analysis typecheck unit-tests coverage-gate ## Run sequential quality gates (Tier 1-8). Exits on first failure.

source-hygiene: ## Gate 1: Scan for debug code and hardcoded secrets
	@echo "=== Gate 1: Source Hygiene ==="
	@! grep -r "console\.log" src/ 2>/dev/null | grep -v "test" || (echo "❌ Debug console.log found in source"; exit 1)
	@! grep -r "debugger" src/ 2>/dev/null | grep -v "test" || (echo "❌ Debugger statements found"; exit 1)
	@! grep -r -i "password\s*=" src/ 2>/dev/null | grep -v "test" | grep -v "\"password\":\s*\"\\$${process.env" || (echo "❌ Hardcoded password found"; exit 1)
	@! grep -r -i "api_key\s*:" src/ 2>/dev/null | grep -v "test" || (echo "❌ Hardcoded API key found"; exit 1)
	@! grep -r "TODO:\s*FIXME\|XXX:\s*HACK" src/ 2>/dev/null | grep -v "test" || echo "⚠️ Found TODO/FIXME/XXX (consider addressing)"
	@echo "✓ Source hygiene OK"
	@true

dependency-check: ## Gate 2: Verify package-lock.json is present and up-to-date
	@echo "=== Gate 2: Dependency Freeze ==="
	@test -f package-lock.json || (echo "❌ package-lock.json missing"; exit 1)
	@git diff --cached --name-only | grep -q '^package-lock.json$$' || echo "⚠️ package-lock.json not staged (run git add package-lock.json)"
	@echo "✓ Dependency freeze OK"

clean-build: ## Gate 3: Production build succeeds
	@echo "=== Gate 3: Clean Build ==="
	@npm run build
	@echo "✓ Build succeeded"

artifact-verify: ## Gate 4: Verify build artifacts (dist/)
	@echo "=== Gate 4: Artifact Verification ==="
	@test -d dist || (echo "❌ dist/ directory missing"; exit 1)
	@test -f dist/main.js || (echo "❌ dist/main.js missing"; exit 1)
	@test -f dist/cli.js || (echo "❌ dist/cli.js missing"; exit 1)
	@echo "✓ Artifacts verified"

static-analysis: ## Gate 5: ESLint passes (0 errors, limited warnings)
	@echo "=== Gate 5: Static Analysis ==="
	@npm run lint
	@echo "✓ Lint passed"

typecheck: ## Gate 6: TypeScript strict mode passes
	@echo "=== Gate 6: Type/Schema Verification ==="
	@npm run typecheck
	@echo "✓ Type checking passed"

unit-tests: ## Gate 7: All unit tests pass
	@echo "=== Gate 7: Unit Tests ==="
	@npm test
	@echo "✓ All unit tests passed"

coverage-gate: ## Gate 8: Coverage >= 80% (statements, branches, functions, lines)
	@echo "=== Gate 8: Coverage Gate ==="
	@npm run test:coverage
	@node -e "const fs=require('fs');const path='coverage/coverage-summary.json';if(!fs.existsSync(path)){console.error('❌ Coverage summary not found');process.exit(1)};const cov=JSON.parse(fs.readFileSync(path,'utf8')).total;const s=cov.statements.pct,b=cov.branches.pct,f=cov.functions.pct,l=cov.lines.pct;const ok=s>=80&&b>=80&&f>=80&&l>=80;if(!ok){console.error('❌ Coverage below threshold:',{statements:s,branches:b,functions:f,lines:l});process.exit(1)};console.log('✓ Coverage OK:',{statements:s+'%',branches:b+'%',functions:f+'%',lines:l+'%'});"

# ========================================
# TIER 2: INTEGRATION & CONTRACT
# ========================================

# Note: Integration tests not yet implemented in jf project; placeholder
integration-tests: ## Gate 9: Integration tests (stub)
	@echo "=== Gate 9: Integration Tests ==="
	@echo "⚠️ Integration tests not yet implemented – skipping (TODO: add test:integration script)"
	@true

contract-tests: ## Gate 10: Contract tests (stub)
	@echo "=== Gate 10: Contract Tests ==="
	@echo "⚠️ Contract tests not yet implemented – skipping (TODO: add test:contract script)"
	@true

# ========================================
# TIER 3: DATA & MIGRATION
# ========================================

# Not applicable for jf (no database migrations); placeholder
migration-validation: ## Gate 11: Data migration validation (stub)
	@echo "=== Gate 11: Data Migration Validation ==="
	@echo "⚠️ No database migrations – skipping"
	@true

seed-data: ## Gate 12: Seed data integrity (stub)
	@echo "=== Gate 12: Seed Data Integrity ==="
	@echo "⚠️ No seed data – skipping"
	@true

# ========================================
# TIER 4: SECURITY & COMPLIANCE
# ========================================

security-scan: ## Gate 13: npm audit (HIGH+ severity)
	@echo "=== Gate 13: Security Scan ==="
	@npm audit --audit-level=high || (echo "❌ HIGH+ vulnerabilities found"; exit 1)
	@echo "✓ Security scan passed"

secrets-scan: ## Gate 14: Scan for secrets (requires trufflehog or similar)
	@echo "=== Gate 14: Secrets Scan ==="
	@if command -v trufflehog >/dev/null 2>&1; then \\\n  trufflehog scan --regex . --fail || (echo "❌ Secrets detected"; exit 1); \\\nelse \\\n  echo "⚠️ trufflehog not installed – skipping"; \\\nfi
	@true

compliance-check: ## Gate 15: Compliance matrix completeness
	@echo "=== Gate 15: Compliance Check ==="
	@test -f docs/COMPLIANCE.md || (echo "❌ docs/COMPLIANCE.md missing"; exit 1)\n# Check for checked controls\n@grep -q '\\[x\\]' docs/COMPLIANCE.md || (echo "⚠️ No compliance controls checked");\n@echo "✓ Compliance documentation present"\n@true

license-scan: ## Gate 16: License scan (require permissive licenses)
	@echo "=== Gate 16: Dependency License Scan ==="
	@echo "⚠️ License scanning not yet implemented – skipping (TODO: add license-check script)"
	@true

# ========================================
# TIER 5: PERFORMANCE
# ========================================

performance-sanity: ## Gate 17: Performance benchmark (stub)
	@echo "=== Gate 17: Performance Sanity ==="
	@echo "⚠️ Performance benchmarks not yet implemented – skipping (TODO: add benchmark script)"
	@true

load-stress: ## Gate 18: Load stress test (stub)
	@echo "=== Gate 18: Load Stress Test ==="
	@echo "⚠️ Load testing not yet implemented – skipping"
	@true

endurance: ## Gate 19: Endurance test (stub)
	@echo "=== Gate 19: Endurance Test ==="
	@echo "⚠️ Endurance testing not yet implemented – skipping"
	@true

spike-test: ## Gate 20: Spike test (stub)
	@echo "=== Gate 20: Spike Test ==="
	@echo "⚠️ Spike testing not yet implemented – skipping"
	@true

# ========================================
# TIER 6: FAILURE & RESILIENCE
# ========================================

chaos-test: ## Gate 21: Chaos engineering (stub)
	@echo "=== Gate 21: Failure Mode Testing ==="
	@echo "⚠️ Chaos testing not yet implemented – skipping"
	@true

circuit-breaker: ## Gate 22: Circuit breaker validation (stub)
	@echo "=== Gate 22: Circuit Breaker Validation ==="
	@echo "⚠️ Circuit breaker tests not yet implemented – skipping"
	@true

retry-backoff: ## Gate 23: Retry & backoff (stub)
	@echo "=== Gate 23: Retry & Backoff ==="
	@echo "⚠️ Retry tests not yet implemented – skipping"
	@true

# ========================================
# TIER 7: OBSERVABILITY & OPS
# ========================================

observability: ## Gate 24: Observability validation (stub)
	@echo "=== Gate 24: Observability Validation ==="
	@echo "⚠️ Observability tests not yet implemented – skipping"
	@true

config-validation: ## Gate 25: Configuration validation
	@echo "=== Gate 25: Config Validation ==="
	@echo "⚠️ Config validation not yet implemented – skipping"
	@true

packaging: ## Gate 26: Packaging verification (docker/npm pack)
	@echo "=== Gate 26: Packaging ==="
	@npm pack --dry-run >/dev/null 2>&1 || (echo "❌ npm pack dry-run failed"; exit 1)
	@echo "✓ Packaging OK"

# ========================================
# TIER 8: RELEASE
# ========================================

sign-off: ## Gate 27: Manual sign-off reminder (always passes, prints reminder)
	@echo "=== Gate 27: Sign-off (MANUAL) ==="
	@echo "All automated gates passed."
	@echo "Obtain manual sign-offs from: Tech Lead, Security Team, SRE, Product Owner, QA."
	@echo "See docs/SIGN_OFF_CHECKLIST.md (to be created)."
	@true

# ========================================
# CONVENIENCE TARGETS
# ========================================

all-gates: quality-gates integration-tests contract-tests migration-validation seed-data \\\n\tsecurity-scan secrets-scan compliance-check license-scan \\\n\tperformance-sanity load-stress endurance spike-test \\\n\tchaos-test circuit-breaker retry-backoff \\\n\ttobservability config-validation packaging sign-off ## Run all 27 gates (includes stubs)

quick: source-hygiene dependency-check clean-build static-analysis typecheck unit-tests coverage-gate ## Quick gates for local development

# Alias for CI
quality: quality-gates
