# TODO — Prioritized Engineering Tasks

## Completed Tasks

### 1. Initialize Git Repository
**Status**: ✅ Completed  
- Git repository initialized with selective source code
- `.gitignore` configured to exclude binaries, node_modules, etc.
- Initial commit: 313eaf3

### 2. Create Agent Self-Awareness Infrastructure
**Status**: ✅ Completed  
- `docs/AGENT_PROFILE.md`
- `docs/AGENT_METRICS.md`
- `docs/MEMORY.md`
- `docs/EVOLUTION.md`

### 3. Verify Test Suites & Coverage
**Status**: ✅ Completed  
- Ran full test suite (agent, ai, coding-agent, tui)
- Fixed bash tool truncation bug (coding-agent) — test now passes
- Test coverage: 99% (1574/1588 passing)
- Identified remaining issues:
  - 8 TUI rendering test failures (bugs) → task #4
  - 6 Ollama tests skipped due to insufficient memory (environment-limited) → task #5
- Documentation updated in PROJECT_STATE.md and AGENT_METRICS.md

---

##优先级: High Impact + Low Risk

### 4. Fix TUI Rendering Test Failures
**Priority**: P1 (quality assurance)
**Risk**: Medium
**Impact**: High (8 failing tests, differential rendering bugs)
**Cost**: 4–8h

**Why**: 8 tests failing in `packages/tui` related to differential rendering, overlay positioning, cursor tracking. These are real bugs affecting TUI stability.

**Progress**:
- Fixed `clearOnShrink` default to `true` (was `false`).
- Changed shrink detection to use `previousLines.length` instead of `maxLinesRendered` to avoid inflation.
- Fixed all 8 failing TUI rendering tests (differential rendering bugs) - all tests now pass.

**Tasks**:
- Investigate root cause of remaining failures (append after shrink, stale content clearing, cursor tracking).
- Review diff algorithm for edge cases.
- Implement fix(es).
- Re-run tests until all pass.

**Success criteria**: All TUI tests pass (0 failures).

**Status**: ✅ Completed - All TUI tests now pass.

---

### 5. Investigate Ollama Test Environment Limitations
**Priority**: P2 (quality assurance)
**Risk**: Low
**Impact**: Medium (6 tests skipped, but environment-specific)
**Cost**: 2h

**Why**: 6 tests in `packages/ai` fail because the local Ollama model `gpt-oss:20b` requires >13GB RAM, exceeding available 6GB. These tests may need smaller models or skip conditions for low-memory environments.

**Progress**:
- Identified that 6 Ollama tests in stream.test.ts and context-overflow.test.ts fail due to insufficient memory
- Confirmed this is an environment limitation, not a code bug
- The gpt-oss:20b model requires >13GB RAM but only ~6GB is available

**Tasks**:
- Review `test/stream.test.ts` and `test/context-overflow.test.ts` Ollama tests
- Consider using a smaller model for tests or add conditional skip based on available memory
- Document environment requirements for full test coverage

**Success criteria**: Tests either pass on this machine or are skipped gracefully with clear reason.

**Note**: These 6 tests are expected to fail/skip in low-memory environments. No action needed unless testing in high-RAM environment.

---

### 6. Setup CI/CD Pipeline
**Priority**: P2
**Risk**: Medium
**Impact**: Medium
**Cost**: 2h

**Why**: Automated checks on push/PR ensure quality. GitHub Actions may already exist (`.github/workflows/ci.yml`) but needs verification.

**Tasks**:
- [x] Verify existing CI configuration (ci.yml exists and runs build, check, test)
- [x] Ensure CI runs: `npm run check`, `npm test`
- [x] Add status badges to README (fixed badge URL to point to correct repository)
- [ ] Document CI process (optional)

**Status**: ✅ Completed (CI verified, badge updated).

**Success criteria**: CI passes on main branch; badge shows status.

---

### 7. Changelog Management
**Priority**: P2
**Risk**: Low
**Impact**: Low-Medium
**Cost**: 1h

**Why**: Each package should have `CHANGELOG.md` with `[Unreleased]` section per release protocol in README.

**Tasks**:
- [x] Check each package for `CHANGELOG.md`
- [x] Create empty template if missing with `## [Unreleased]` section (added for `packages/pods`)
- [ ] Document changelog conventions in `docs/`

**Status**: ✅ Completed (all packages now have CHANGELOG.md).

**Success criteria**: All packages have properly formatted CHANGELOG.md.

---

## Medium Impact + Medium Risk

### 8. OSS Weekend Clarification
**Priority**: P3
**Risk**: Low
**Impact**: Low
**Cost**: 0.5h

**Why**: OSS weekend ends April 13, 2026. Confirm if this still applies and update docs accordingly.

**Progress**:
- Checked `.github/oss-weekend.json` - OSS weekend is active (started April 2, 2026, reopens April 13, 2026)
- Issue tracker auto-closes is currently enabled
- No update needed to README or workflows

**Tasks**:
- Check `.github/oss-weekend.json`
- Update README if weekend is over
- Ensure issue/PR workflow behaves as expected

**Status**: ✅ Completed - OSS weekend is still active as of today (2026-04-07)

---

### 9. Performance Profiling
**Priority**: P3
**Risk**: Medium
**Impact**: Medium
**Cost**: 3h

**Why**: Scripts exist: `npm run profile:tui` and `npm run profile:rpc`. Can identify bottlenecks.

**Tasks**:
- Run profiling scripts
- Document performance characteristics
- Identify slow paths for optimization

---

### 10. Dependency Audit
**Priority**: P3
**Risk**: Low
**Impact**: Low
**Cost**: 1h

**Why**: Ensure dependencies up-to-date, no known vulnerabilities.

**Tasks**:
- Run `npm audit`
- Review `overrides` in `package.json`
- Update outdated dependencies if safe

---

## Backlog

- Improve error messages in pi CLI
- Add more examples to `packages/coding-agent/examples/`
- Document extension/skill creation process
- Create video tutorials or screencasts
- Set up Dependabot for dependency updates
- Add contract tests for provider integrations
- Performance regression testing
- Load testing for RPC mode
