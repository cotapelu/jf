# TODO.md - Complete Task List

> **Status**: 📋 Last Updated: 2026-05-07
> **Total Tasks**: 87
> **Completed**: 24
> **Pending**: 63

---

## 📊 Overview

| Priority | Count | Completed | Pending |
|----------|-------|-----------|---------|
| P0 - Critical | 5 | 0 | 5 |
| P1 - High | 22 | 7 | 15 |
| P2 - Medium | 28 | 16 | 12 |
| P3 - Low | 32 | 2 | 30 |
| **Total** | **87** | **11** | **76** |

---

## 🔴 P0 - CRITICAL (Showstoppers)

### Security

#### [P0-001] Prompt Injection via Tool Results 🔴
- **Issue**: Malicious content in tool results could inject instructions
- **Severity**: Critical
- **Status**: 🔴 Pending
- **Risk**: High
- **Fix**: Sanitize outputs, validate format tool messages
- **Related**: docs/MEMORY.md - SEC issue

#### [P0-002] Security Vulnerability - basic-ftp (CVE) ✅ FIXED
- **Package**: basic-ftp (transitive via get-uri)
- **CVE**: GHSA-chqc-8p9q-pq6q
- **Fix**: npm audit fix → basic-ftp@5.2.1
- **Verification**: npm audit reports 0 vulnerabilities
- **Status**: ✅ Done

### Test Infrastructure

#### [P0-003] OAuth Token Refresh Failure (Antigravity)
- **Issue**: 10 tests fail with "Failed to refresh OAuth token for google-antigravity"
- **Root Cause**: OAuth refresh token in test auth.json has expired or been revoked
- **Status**: 🟡 Credentials Expired (not code bug)
- **Fix**: Re-authenticate: run `pi` and login to Antigravity
- **Impact**: Blocks 10 tests in ai package + 2 in coding-agent

---

## 🟠 P1 - HIGH PRIORITY

### Testing & QA

#### [P1-001] Run Full Test Suite ✅ COMPLETED
- **Status**: ✅ Done (2026-04-09)
- **Result**: 1574/1588 tests passing (99%)

#### [P1-002] Fix TUI Rendering Test Failures ✅ COMPLETED
- **Status**: ✅ Done (2026-04-09)
- **Changes**: 
  - Fixed `clearOnShrink` default to `true`
  - Changed shrink detection to use `previousLines.length`
- **Result**: All 507 TUI tests pass

#### [P1-003] Fix Bash Tool Truncation Bug ✅ COMPLETED
- **Status**: ✅ Passing (2026-04-09)
- **Note**: Behavior already correct; test passes

#### [P1-004] Browser Smoke Check ✅ COMPLETED
- **Status**: ✅ Done
- **Fix**: Added external node modules to browser smoke check
- **Result**: All checks pass

#### [P1-005] Ollama Test Environment Limitations
- **Issue**: 6 tests fail due to insufficient memory (gpt-oss:20b requires >13GB RAM)
- **Status**: 📋 Documented - no action needed
- **Location**: `packages/ai/test/stream.test.ts`, `packages/ai/test/context-overflow.test.ts`

### Core Infrastructure

#### [P1-006] Create Agent Self-Awareness Infrastructure ✅ COMPLETED
- **Status**: ✅ Done
- **Created**:
  - docs/AGENT_PROFILE.md
  - docs/AGENT_METRICS.md
  - docs/MEMORY.md
  - docs/EVOLUTION.md

#### [P1-007] Configure Dev Environment ✅ COMPLETED
- **Status**: ✅ Done
- **Tasks**: npm install, build, check

#### [P1-008] Initialize Git Repository ✅ COMPLETED
- **Status**: ✅ Done
- **Initial commit**: 313eaf3

### Code Quality

#### [P1-009] Reduce Excessive `any` Types 🟡 IN PROGRESS
- **Status**: 🟡 In Progress (2026-05-07)
- **Progress**: Fixed 5+ occurrences in validation and env-api-keys
- **Changes**:
  - `env-api-keys.ts`: Fixed `getEnvApiKey` parameter type
  - `utils/validation.ts`: Typed `ajv` as `Ajv | null`, function return types as `Record<string, unknown>`, error type as `ErrorObject`
- **Next**: Audit OAuth and provider response types, enable stricter TS config

#### [P1-010] OAuth Error Handling Swallows Original Error ✅ FIXED
- **Status**: ✅ Fixed (2025-04-09)
- **Location**: `packages/ai/src/utils/oauth/index.ts:getOAuthApiKey()`
- **Fix**: Changed catch to preserve error cause using `{ cause: error }`

### Documentation

#### [P1-011] Create Extension Guide ✅ COMPLETED
- **Status**: ✅ Done
- **Created**: docs/EXTENSION_GUIDE.md

#### [P1-012] Setup CI/CD Pipeline ✅ COMPLETED
- **Status**: ✅ Done
- **Features**: 
  - GitHub Actions for PR checks
  - Status badges in READMEs
  - Auto-versioning on merge

#### [P1-013] Changelog Management ✅ COMPLETED
- **Status**: ✅ Done
- **All packages**: Have CHANGELOG.md with [Unreleased] section

#### [P1-014] Biome Version Migration ✅ COMPLETED
- **Status**: ✅ Done
- **Changes**: biome.json v2.3.5 → v2.4.10
- **Result**: 0 warnings

#### [P1-015] Dependabot Configuration ✅ COMPLETED
- **Status**: ✅ Done
- **File**: .github/dependabot.yml
- **Schedule**: Weekly on Mondays

### Performance

#### [P1-016] Performance Baseline ✅ COMPLETED
- **Status**: ✅ Done
- **Metrics**:
  - Build time: ~17s
  - TUI tests: 1084 pass, 4 fail (OAuth), 140 skipped

---

## 🟡 P2 - MEDIUM PRIORITY

### Testing

#### [P2-001] Integration Tests for Cross-Provider Handoffs ✅ DONE
- **Status**: ✅ Done (2026-05-07)
- **File**: `packages/ai/test/cross-provider-handoffs.test.ts`
- **Coverage**: 8 comprehensive cross-provider handoff test scenarios
- **Providers Tested**: OpenAI, Anthropic, Google, Mistral
- **Test Scenarios**:
  - OpenAI → Anthropic handoff with thinking blocks
  - Thinking preservation across providers
  - Tool call handoff
  - Multi-provider round-robin conversation
  - Context consistency across providers
  - Reasoning feature differences
  - Complex multi-provider tool workflow
  - Message transformation validation
- **Validates**: Message format transformation, thinking block preservation, tool call integrity
- **Goal**: Test message transformation between providers

#### [P2-002] End-to-End Tests for Common Workflows ✅ DONE
- **Status**: ✅ Done (2026-05-07)
- **File**: `packages/ai/test/e2e-workflows.test.ts`
- **Coverage**: 12 end-to-end workflow tests
- **Workflows Tested**:
  - Simple Q&A conversations
  - Multi-turn conversations
  - Context-aware follow-ups
  - Tool call execution
  - Multi-step tool workflows
  - Error handling in tool workflows
  - Thinking and reasoning workflows
  - Mixed content workflows (text + thinking)
  - Long context workflows (20+ messages)
  - Stream event workflows
  - Context accumulation across operations
  - Error recovery workflows

- **Scenarios**: 12 comprehensive E2E test scenarios
- **Focus**: Edit-compile-run loop

#### [P2-003] Property-Based Testing ✅ DONE
- **Status**: ✅ Done (2026-05-07)
- **File**: `packages/ai/test/property-based.test.ts`
- **Coverage**: 10 comprehensive property tests
- **Features**:
  - Context size handling (0-20 messages)
  - Message ordering preservation
  - Thinking/reasoning flag validation
  - Thinking block serialization
  - Various thinking levels
  - Model ID generation patterns
  - Concurrent stream operations
  - API consistency across model types
  - Stream event validity
  - Fast-check integration (20-50 runs per test)
- **Invariants Tested**: 15+ critical properties
- **Tools**: fast-check/vitest

#### [P2-004] Chaos Engineering Tests
- **Status**: 📋 Pending
- **Focus**: Distributed components

#### [P2-005] Edge Case Testing for Error Conditions
- **Status**: 📋 Pending

#### [P2-006] Test Coverage Gaps - Edge Cases
- **Issue**: 14/1588 tests failing (0.88%)
- **Status**: ⚠️ Investigating
- **Areas to test**:
  - [ ] Empty/NULL inputs to tools
  - [ ] Network timeouts and retries
  - [ ] Large file handling (editor)
  - [ ] Unicode edge cases (combining characters, RTL)
  - [ ] Concurrent tool calls
  - [ ] Provider failover scenarios

### AI Package

#### [P2-007] Implement Tests for Google Provider Specifics
- **Status**: 📋 Pending

#### [P2-008] Document Rate Limits by Provider ✅ DONE
- **Status**: ✅ Done (2026-05-07)
- **Document**: `docs/RATE_LIMITS.md` created
- **Coverage**: OpenAI, Anthropic, Google, Mistral, Ollama
- **Includes**: Rate limits, error handling, best practices, monitoring
- **Last Updated**: 2026-05-07

#### [P2-009] Add More Faux Provider Fixtures ✅ DONE
- **Status**: ✅ Done (2026-05-07)
- **Files Created**:
  - `packages/ai/test/faux-fixtures.ts` - Comprehensive fixture library
  - `packages/ai/test/faux-fixtures.test.ts` - Tests for fixtures
- **Features**:
  - Pre-configured test providers (standard, reasoning, error-prone, tool-testing)
  - Response factories (echo, thinking, tool-using, multi-step, persona, error)
  - Common response patterns (simple, thinking, toolCall, multiStep, error, etc.)
  - Conversation sequences for flow testing
  - Utility functions for test setup
- **Update TODO.md [P2-009]

#### [P2-010] Cross-Provider Handoff Improvements
- **Issue**: Thinking block transformation may lose reasoning context
- **Status**: 📋 Pending

### Agent Core Package

#### [P2-011] Custom Message Types - Examples ✅ DONE
- **Status**: ✅ Done (2026-05-07)
- **Files Created**:
  - `examples/custom-messages/README.md` - Complete guide with 5 message types
  - `examples/custom-messages/custom-tool-result.ts` - Enhanced tool results with metadata
  - `examples/custom-messages/structured-thinking.ts` - Step-by-step reasoning
- **Features**:
  - Custom tool results with execution time and validation
  - Annotated user messages with semantic metadata
  - Structured thinking with reasoning steps
  - Enhanced image messages with regions of interest
  - Workflow state tracking
- **Integration**: Type guards, validators, formatters included
- **Update TODO.md [P2-011]

#### [P2-012] Add More Performance Metrics
- **Status**: 📋 Pending

#### [P2-013] Document Recommended Retry Patterns
- **Status**: 📋 Pending

#### [P2-014] Implement Exponential Backoff Global ✅ DONE
- **Status**: ✅ Done (2026-05-07)
- **Created**: `packages/ai/src/utils/retry.ts` with exponential backoff utility
- **Features**: withRetry(), fetchWithRetry(), isRetryableError(), calculateDelay()
- **Exported**: From `packages/ai/src/index.ts`
- **Related**: docs/AGENT_PROFILE.md

#### [P2-015] Circuit Breaker Per Provider
- **Status**: 📋 Pending

#### [P2-016] Watchdog Timeout Agent Loop ✅ DONE
- **Status**: ✅ Done (2026-05-07)
- **Implementation**:
  - `packages/agent/src/watchdog.ts` - Watchdog timer class
  - `packages/agent/src/watchdog-example.ts` - Usage examples
  - `packages/agent/src/agent-loop.ts` - Integrated watchdog into agent loop
  - `packages/agent/src/types.ts` - Added `watchdogTimeoutMs` config option
- **Features**:
  - Prevents infinite loops and runaway execution
  - Configurable timeout (default 30s)
  - Warning callbacks at 80% threshold
  - Auto-extension for follow-up messages
  - Per-operation and session-level timeouts

### Coding Agent Package

#### [P2-017] Skills Discovery - SKILL.md Parsing
- **Status**: 📋 Pending

#### [P2-018] Test Package System - npm/git install
- **Status**: 📋 Pending

#### [P2-019] Validate Prompt Templates - Variable Expansion
- **Status**: 📋 Pending

#### [P2-020] Extension System - registerTool, registerCommand ✅ DONE
- **Status**: ✅ Done (2026-05-07)
- **Created**: `examples/custom-extension/advanced-extension.ts`
- **Features**: Project file manager tool, analyze command, lifecycle events, custom widgets, session state
- **Documentation**: Updated README with basic + advanced examples
- **Co-authored-by**: Auto-Commit <auto@commit.com>

#### [P2-021] Session/Tree Management - /tree, /fork, compaction ✅ DONE
- **Status**: ✅ Done (2026-05-07)
- **Features**:
  - `/tree` command - Navigate session tree (switch branches)
  - `/fork` command - Create new fork from previous message
  - `/compact` command - Manual session compaction
  - TreeSelectorComponent for visual tree navigation
  - CompactionSummaryMessageComponent
- **Location**: `packages/coding-agent/src/modes/interactive/`

#### [P2-022] Interactive Mode and Editor - TUI Integration ✅ DONE
- **Status**: ✅ Done (2026-05-07)
- **Verification**: All 519 TUI tests pass
- **Integration**:
  - InteractiveMode properly integrates with pi-tui
  - Editor components (CustomEditor, extension editors)
  - Keybinding system working
  - Unicode/regional indicator rendering correct
- **Location**: `packages/coding-agent/src/modes/interactive/`

### TUI Package

#### [P2-023] Test Components with Edge Cases
- **Status**: 📋 Pending
- **Focus**: Very long text, unicode

#### [P2-024] Validate IME Positioning - CJK Locales
- **Status**: 📋 Pending

#### [P2-025] Add More Custom Component Examples ✅ DONE
- **Status**: ✅ Done (2026-05-07)
- **Examples Created**:
  - `examples/custom-components/progress-bar.ts` - Animated progress bar
  - `examples/custom-components/status-indicator.ts` - Animated status indicator with 5 states
  - `examples/custom-components/README.md` - Comprehensive guide with 5 example components
- **Features**: Progress bars, status indicators, data tables, notifications, command palettes
- **Documentation**: Full usage examples and integration guide
- **Location**: `examples/custom-components/`


#### [P2-026] Fix visibleWidth for Unicode ✅ DONE
- **Status**: ✅ Verified (2026-05-07)
- **Investigation**: Used Intl.Segmenter with grapheme granularity (line 4)
- **Implementation**: segmenter.segment() with codePointAt() handles surrogate pairs correctly
- **Testing**: 518 TUI tests pass, including Unicode/regional indicator tests
- **Related**: docs/AGENT_PROFILE.md

### Mom Package

#### [P2-027] Security Audit - Prompt Injection Scenarios ✅ DONE
- **Status**: ✅ Done (2026-05-07)
- **Document**: `docs/SECURITY_AUDIT.md` created
- **Coverage**:
  - Tool result injection risks
  - User message injection
  - Extension-based attacks
  - System prompt manipulation
  - Tool definition exploits
  - Context poisoning
  - Mitigation strategies
- **Immediate Actions**: Prioritized (P0-P3)
- **Testing**: Automated/manual recommendations

#### [P2-028] Test Docker Sandbox Isolation
- **Status**: 📋 Pending

#### [P2-029] Validate Event System - Cron, One-shot
- **Status**: 📋 Pending

### Code Quality

#### [P2-030] Audit Event Listener Cleanup
- **Status**: 📋 Pending
- **Risk**: Memory leaks in extensions, TUI components
- **Locations**:
  - [ ] packages/coding-agent/src/core/extensions/
  - [ ] TUI overlay lifecycle
  - [ ] Verify `Disposable` pattern usage

#### [P2-031] Race Conditions in State Management
- **Status**: 📋 Pending
- **Location**: packages/agent/src/ (Agent state)
- **Tasks**:
  - [ ] Check if Agent.run() is reentrant
  - [ ] Verify state updates are atomic
  - [ ] Add tests with parallel tool executions

### Error Handling

#### [P2-032] Improved JSON Streaming Validation
- **Status**: 📋 Pending
- **Related**: docs/AGENT_PROFILE.md - JSON parse errors

#### [P2-033] Rate Limiting Local + Request Queue
- **Status**: 📋 Pending

---

## 🟢 P3 - LOW PRIORITY

### Documentation

#### [D-001] Add More Integration Guides
- **Status**: 📋 Pending

#### [D-002] Update Changelogs (unreleased sections)
- **Status**: 📋 Pending

#### [D-003] Create Pi-packages Examples
- **Status**: 📋 Pending

#### [D-004] Document omp-legacy/ Directory
- **Status**: 📋 Pending
- **Issue**: Old Rust/TypeScript code, unclear if deprecated

### UX/UI

#### [U-001] Additional Themes
- **Status**: 📋 Pending

#### [U-002] Configurable Keybindings Improvements
- **Status**: 📋 Pending

#### [U-003] Advanced Extension Examples
- **Status**: 📋 Pending

#### [U-004] Progress Bar Visualization
- **Status**: 📋 Pending

### Technical Debt

#### [T-001] Inconsistent Tool Parameter Validation
- **Status**: 📋 Pending
- **Location**: packages/coding-agent/src/core/tools/
- **Tasks**:
  - [ ] Audit all tools (read, write, edit, grep, find, ls, bash)
  - [ ] Standardize validation (e.g., file existence checks)
  - [ ] Create validation utility functions

#### [T-002] Missing TypeScript Strict Checks
- **Status**: 📋 Pending
- **Tasks**:
  - [ ] Ensure all tsconfig.json have strict: true
  - [ ] Enforce via CI

#### [T-003] Build Time Optimization (~17s)
- **Status**: 📋 Pending
- **Tasks**:
  - [ ] Profile TypeScript compilation
  - [ ] Check for circular dependencies
  - [ ] Consider incremental builds

#### [T-004] Configuration & Environment Variable Validation
- **Status**: 📋 Pending
- **Tasks**:
  - [ ] Audit all process.env access
  - [ ] Add validation with clear error messages
  - [ ] Document required env vars in READMEs

### Performance

#### [P-001] Performance Regression Testing
- **Priority**: Low
- **Risk**: Medium
- **Cost**: 2h
- **Tasks**:
  - [ ] Set up baseline metrics
  - [ ] Add performance assertions to CI
  - [ ] Document known performance characteristics

#### [P-002] Load Testing for RPC Mode
- **Priority**: Low
- **Risk**: Medium
- **Cost**: 3h
- **Tasks**:
  - [ ] Identify load test scenarios
  - [ ] Run load tests with concurrent sessions
  - [ ] Document capacity limits

### Future Features

#### [F-001] Cloud Sync of Sessions
- **Status**: 📋 Backlog

#### [F-002] Branching & Merging of Session Histories
- **Status**: 📋 Backlog

#### [F-003] Video Tutorials/Screencasts
- **Status**: 📋 Backlog

#### [F-004] More Examples in packages/coding-agent/examples/
- **Status**: 📋 Backlog

### Observability

#### [O-001] Structured Logging
- **Status**: 📋 In Progress
- **Goal**: JSON logging option

#### [O-002] Token Usage & Cost Tracking Per Session
- **Status**: 📋 In Progress

#### [O-003] Diagnostics Report (/diagnostics command)
- **Status**: 📋 Pending

---

## 📋 TASK TRACKING BY PHASE

### Phase 1: Setup (6/6 = 100%) ✅

| # | Task | Status |
|---|------|--------|
| 1.1 | Initialize Git Repository | ✅ Done |
| 1.2 | Create Agent Self-Awareness Infrastructure | ✅ Done |
| 1.3 | Verify Test Suites & Coverage | ✅ Done |
| 1.4 | Fix TUI Rendering Test Failures | ✅ Done |
| 1.5 | Setup CI/CD Pipeline | ✅ Done |
| 1.6 | Changelog Management | ✅ Done |

### Phase 2: Core AI (0/5 = 0%) 🔴

| # | Task | Status |
|---|------|--------|
| 2.1 | Validar tool calling - Argument validation, streaming | 🔄 In Progress |
| 2.2 | Test cross-provider handoffs - Transformación mensajes | 📋 Pending |
| 2.3 | Auditar context serialization - JSON roundtrip tests | 📋 Pending |
| 2.4 | Test suite completo - stream, tokens, abort, handoff | 📋 Pending |
| 2.5 | Google provider specific tests | 📋 Pending |

### Phase 3: Agent Core (0/5 = 0%) 🔴

| # | Task | Status |
|---|------|--------|
| 3.1 | Validar tool execution modes - Parallel vs Sequential | 📋 Pending |
| 3.2 | Test steering/follow-up queues - one-at-a-time vs all | 📋 Pending |
| 3.3 | Error handling y recovery - Abort, retry logic | 📋 Pending |
| 3.4 | Custom message types - Ejemplos | 📋 Pending |
| 3.5 | Performance metrics | 📋 Pending |

### Phase 4: Coding Agent (0/6 = 0%) 🔴

| # | Task | Status |
|---|------|--------|
| 4.1 | Verificar extension system - registerTool, registerCommand | 🔄 In Progress |
| 4.2 | Probar session/tree management - /tree, /fork, compaction | 🔄 In Progress |
| 4.3 | Test interactive mode y editor - TUI integration | 🔄 In Progress |
| 4.4 | Skills discovery - SKILL.md parsing | 📋 Pending |
| 4.5 | Test package system - npm/git install | 📋 Pending |
| 4.6 | Validate prompt templates - Variable expansion | 📋 Pending |

### Phase 5: Test & QA (0/4 = 0%) 🔴

| # | Task | Status |
|---|------|--------|
| 5.1 | Integration tests cross-package | 📋 Pending |
| 5.2 | Property-based tests | 📋 Pending |
| 5.3 | Chaos engineering tests | 📋 Pending |
| 5.4 | Edge case testing | 📋 Pending |

### Phase 6: Extensibility (0/3 = 0%) 🔴

| # | Task | Status |
|---|------|--------|
| 6.1 | Extension security - Sandboxed runtime | 📋 Pending |
| 6.2 | Extension examples | 📋 Pending |
| 6.3 | Extension documentation | ✅ Done |

---

## 🎯 QUARTERLY GOALS

### Q2 2026 Objectives

| Goal | Current | Target | Status |
|------|---------|--------|--------|
| Coverage | 45% | >80% | 🔴 |
| Velocity | 10 tasks/mo | 25 tasks/mo | 🟡 |
| Rollbacks | 0 | maintain 0 | ✅ |
| Build time | 17s | <25s | ✅ |

### Success Metrics

- [ ] Coverage >80% in 2 months
- [ ] Zero rollbacks this quarter
- [ ] <5 test failures/month
- [ ] Build time <25s

---

## 🔄 RECENT UPDATES

### 2026-05-07
- Created comprehensive TODO.md from all source files
- Total tasks: 87 (11 completed, 76 pending)

### 2026-05-06
- Extension guide created
- Performance baseline established

### 2026-04-10
- Full codebase scan completed (140+ files)
- Bug hunt: 15 bugs identified (P0-P3)

---

## 📈 BUG TRACKING SUMMARY

| ID | Bug | Severity | Status |
|----|-----|-----------|--------|
| BUG-001 | OAuth Token Refresh Failure | P0 | 🟡 Credentials |
| BUG-002 | Clipboard Image Test Failures | P1 | ✅ Fixed |
| BUG-003 | Bash Tool Truncation | P1 | ✅ Verified |
| BUG-004 | Compaction with Thinking Models | P1 | 🟡 Credentials |
| BUG-005 | Security - basic-ftp CVE | P1 | ✅ Fixed |
| BUG-006 | Excessive `any` Types | P2 | ⚠️ Tech Debt |
| BUG-007 | OAuth Error Handling | P2 | ✅ Fixed |
| BUG-008 | Test Coverage Gaps | P2 | ⚠️ Investigating |
| BUG-009 | Memory Leaks in Event Listeners | P2 | 📋 Pending |
| BUG-010 | Race Conditions in State | P2 | 📋 Pending |
| BUG-011 | Inconsistent Tool Validation | P3 | 📋 Pending |
| BUG-012 | TypeScript Strict Checks | P3 | 📋 Pending |
| BUG-013 | Build Time ~17s | P3 | 📋 Pending |
| BUG-014 | Config Env Vars | P3 | 📋 Pending |
| BUG-015 | Legacy Code omp-legacy/ | P3 | 📋 Pending |

---

**Maintained by**: Auto-updating
**Next Review**: Weekly
**Owner**: System Agent