# 📋 CURRENT FOCUS (2026-07-15)

**Priority 1: Function Length Compliance - Team Manager Refactor**
- ✅ Batch 1: Extracted `AgentWorkspace` and `AgentMessageBus` classes (SRP foundation)
- ✅ Batch 2: Extracted `createRuntimeForRole` and `runAgentLoop` into small helpers; fixed registerRuntime duplication.
- ✅ Batch 3: Extracted `handleAgentEvent` into `getEventText` helper; `AgentTeam` now 100% compliant.
- ✅ Batch 4: Finalized `runAgentLoop` extraction (completes AgentTeam compliance).
- ✅ Batch 5: Extracted `initializeLoadPromise` from `loadAll` in plugin-loader (reduced from 21 → 9 lines).
- ✅ Batch 6: Extracted `createLoadedPlugin` from `finalizePlugin` and `computeCapabilityMetadata` from `createCapability` in plugin-loader.
- ✅ Batch 7: Compressed remaining methods and extracted scheduleNewPluginLoad helpers; plugin-loader now 100% compliant.
- ✅ Batch 8: Extracted `executeOrchestration` helper in todos-tool; execute method now ≤20 lines.
- ✅ Batch 9: Extracted `executeOrchestration` helper in bash-actions; execute method now ≤20 lines.
- ✅ Batch 10: Refactored `master-tool.ts`; extracted helpers for `executeMaster` and `renderMasterResult`; all methods ≤20 lines.
- ✅ Batch 11: Refactored `tool-template.ts`; extracted `executeTool` and compressed `generateCommandHelp`; replaced `buildCommandMeta` with constant; all methods ≤20 lines.
- ✅ Batch 12: Refactored `team-tool.ts`; extracted `executeTeamTool` and helpers; all methods ≤20 lines.
- ✅ Batch 13: Refactored `team-ops-tool.ts`; extracted `executeTeamOpsTool` and helpers; all methods ≤20 lines; added `AgentTeam.updateStatus`.
- ✅ Batch 14: Refactored `call_graph.ts`; compressed `processCandidates` to ≤20 lines.
- ✅ Batch 15: Refactored `call_graph.ts`; compressed `resolveCallee`, `collectAllFiles`, `buildEdges` to ≤20 lines; module fully compliant.
- ✅ Batch 16: Refactored `dependency_tree.ts`; compressed `resolveInAllFiles` to ≤20 lines.
- ✅ Batch 17: Refactored session-tool.test.ts; extracted helpers and reduced two largest test blocks (>30 lines) to ≤20.
- ✅ Batch 18: Completed session-tool.test.ts compliance; all 37 tests ≤20 lines.
- ✅ Batch 19: Refactored codebase.test.ts (analyze tests); added runAnalyze helper; fixed 2 long tests.
- ✅ Batch 20: Compressed codebase.test.ts safe_edit tests: atomic success & rollback now ≤20 lines; simple imports test compressed.
- ✅ Batch 21: Refactored session-registry.test.ts; compressed tree structure tests; all 37 tests ≤20 lines.
- ✅ Batch 22: Compressed ast_query.test.ts (3 violations) and analyze_ast.test.ts (1 violation); all tests ≤20 lines.
- ✅ Batch 23: command-registry-help-edge.test.ts (8 violations) fixed.
- ✅ Batch 24: command-registry.test.ts (5 violations) fixed.
- ✅ Batch 25: call_graph.test.ts (4 violations) fixed.
- ✅ Batch 26: complexity.test.ts (3 violations) fixed.
- ✅ Batch 27: dependency_tree.test.ts (3 violations) fixed.
- ✅ Batch 28: stats-command.test.ts (3 violations) fixed.
- ✅ Batch 29: metrics.test.ts (2 violations) fixed.
- ✅ Batch 30: safe-edit-edge-cases.test.ts (2 violations) fixed.
- ✅ Batch 31: safe-edit-edittypes.test.ts (2 violations) fixed.
- ✅ Batch 32: command-cache.test.ts (2 violations) fixed.
- ✅ Batch 33: master_tool-stats.test.ts (2 violations) fixed.
- ✅ Batch 34: team-tool-coverage.test.ts (3 violations) fixed.
- ✅ Batch 35: team-manager-monitor.test.ts (2 violations) fixed.
- ✅ Batch 36: team-manager.gaps.test.ts (2 violations) fixed.
- 🔄 Batch 37 (next): Remaining violations: startCompletionMonitor.coverage (3), team-manager.test (2), team-multi-runtime (2), team-tool (2), bash-actions.coverage (2), and 17 single-violation files.

**Quality Gates:**
- Tests: 1318 passing, coverage maintained above thresholds (statements ~94%, branches ~87%)
- Lint: 0 errors, TypeScript: clean
- All changes backward compatible, non-breaking

---

# 📋 TODO - REFACTOR `src/main.ts` (LEGACY)

**File**: `src/main.ts` (300 lines)
**Ngày phân tích**: 2025-06-19
**Trạng thái**: ❌ NOT PRODUCTION READY (Score: 65/100)
**Target**: 🎯 A- grade (90+) after refactor

---

## 📊 TỔNG QUAN

File entry point chính của Pi SDK application với **nhiều vấn đề nghiêm trọng**:

- ❌ **17 occurrences** of `as any` (type safety violation)
- ❌ **35 lines** duplicated code (DRY violation)
- ❌ **3 functions** complexity >10 (main: 15, createRuntime: 12)
- ❌ **40 lines** dead code (unused function, imports, variables)
- ❌ **Critical error handling gaps** (mode.run() unhandled, 80% async calls)
- ❌ **5 security issues** (path disclosure, extension trust, PII leakage)
- ⚠️ **0 unit tests** visible
- ⚠️ **Debug logs** in production code
- ⚠️ **SOLID violations** (SRP, ISP, DIP)

**Estimated effort**: 16-20 hours full refactor
**Quick wins**: 1-2 hours for immediate improvements

---

## 🎯 QUALITY GATE CHECKLIST

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Functions ≤20 lines | 0/3 (0%) | 3/3 (100%) | ❌ |
| Complexity ≤10 | 1/3 (33%) | 3/3 (100%) | ❌ |
| No 5+ duplicates | ❌ 35 lines dup | 0 lines | ❌ |
| Error handling 100% | 20% coverage | 100% | ❌ |
| Input validation 100% | 0% | 100% | ❌ |
| No hardcoded secrets | ✅ 100% | ✅ 100% | ✅ |
| Testable | 10% | 80%+ | ❌ |
| Coverage ≥80% | 0% | 80%+ | ❌ |
| All tests pass | N/A | ✅ | N/A |

---

## 🔴 CRITICAL ISSUES (MUST FIX)

### **C1. Duplicate Extension Loading Code**
- **Severity**: 🔴 CRITICAL
- **Location**: Lines 44-78 (unused function), Lines 173-198 (actual)
- **Issue**: 95% identical code, 35 lines duplicated
- **Impact**: Maintenance nightmare, bug propagation, inconsistency
- **Effort**: 2 hours
- **Fix**: Extract `ExtensionLoader` class, reuse in both places

### **C2. No Error Handling for `mode.run()`**
- **Severity**: 🔴 CRITICAL
- **Location**: Line 259
- **Issue**: `await mode.run()` without try-catch → unhandled rejection crash
- **Impact**: Application crashes on any InteractiveMode error (network, tool error, OOM)
- **Effort**: 30 min
- **Fix**: Wrap with try-catch, graceful shutdown, exit code 1

### **C3. Type Safety Violations (17 `as any` casts)**
- **Severity**: 🔴 CRITICAL
- **Locations**: Lines 50, 53, 57, 61, 65, 69, 73, 77, 174, 178, 182, 186, 190, 194, 198, 226, 233
- **Issue**: Systematic casting to `any` bypasses TypeScript type checking
- **Impact**: Runtime errors, undefined behavior, security vulnerabilities
- **Effort**: 3 hours
- **Fix**: Create declaration augmentation for Pi SDK, remove all `as any`

### **C4. Dead Code Pollution**
- **Severity**: 🔴 CRITICAL
- **Items**:
  - `loadExtensionsForRuntime()` function (lines 37-76) - defined but never called
  - Unused imports: `discoverAndLoadExtensions`, `join`, all `create*Tool` functions
  - `demoModel` variable (lines 250-254) - never used
  - `/* eslint-disable */` comment hiding unused imports
- **Impact**: Bundle bloat, confusion, technical debt
- **Effort**: 1 hour
- **Fix**: Remove all dead code, enable eslint rule

### **C5. God Function - `main()` does too much**
- **Severity**: 🔴 CRITICAL
- **Location**: Lines 149-214 (60 lines, complexity 15)
- **Responsibilities**:
  1. Initialize runtime
  2. Set global state
  3. Load & bind extensions
  4. Launch interactive mode
- **Impact**: Hard to test, maintain, understand
- **Effort**: 2 hours
- **Fix**: Split into 3 functions: `initializeRuntime()`, `loadExtensions()`, `launchInteractiveMode()`

---

## 🟠 HIGH PRIORITY ISSUES

### **H1. Extension API Missing Proper Types**
- **Severity**: 🟠 HIGH
- **Location**: Lines 44-78, 173-198
- **Issue**: `api: any` with `def: any`, `config: any` everywhere
- **Impact**: No type safety for extension developers, runtime errors
- **Effort**: 2 hours
- **Fix**: Define `ExtensionAPI` interface, `ExtensionCommand` type

### **H2. Silent Error Swallowing**
- **Severity**: 🟠 HIGH
- **Location**: Lines 231-238
- **Code**:
  ```typescript
  try {
    if (sess.refreshCommands) sess.refreshCommands();
    if (sess.runtime?.refreshCommands) sess.runtime.refreshCommands();
  } catch (e) {
    // ignore  // ❌ CRITICAL: Silent failure
  }
  ```
- **Impact**: Commands may not refresh, no visibility into failures
- **Effort**: 30 min
- **Fix**: At minimum log error, preferably throw or degrade gracefully

### **H3. Hardcoded Magic Values**
- **Severity**: 🟠 HIGH
- **Values**:
  - `'<jf>'` (lines 210, 214) - sourceInfo.path
  - `'jf-extensions'` (line 217) - extension name
  - `'1.0.0'` (line 218) - version hardcoded
  - `'project'` (lines 210, 214) - scope hardcoded
- **Impact**: Cannot change without modifying code, inflexible
- **Effort**: 1 hour
- **Fix**: Move to constants at top, or derive from extension manifest

### **H4. No Input Validation**
- **Severity**: 🟠 HIGH
- **Locations**: Throughout
- **Missing**:
  - `cwd` validation (path traversal?)
  - `agentDir` validation
  - Extension tool name uniqueness check (line 208)
  - Command name collision with built-ins
- **Impact**: Security vulnerabilities, runtime errors
- **Effort**: 2 hours
- **Fix**: Add validation functions, throw descriptive errors

### **H5. Inconsistent Error Handling**
- **Severity**: 🟠 HIGH
- **Issue**: Some async calls have try-catch (extension loading), others none (services creation, session creation, mode.run)
- **Coverage**: ~20% vs required 100%
- **Impact**: Unpredictable failures, no graceful degradation
- **Effort**: 2 hours
- **Fix**: Wrap all async calls, consistent error policy

---

## 🟡 MEDIUM PRIORITY ISSUES

### **M1. Security - Information Disclosure**
- **Severity**: 🟡 MEDIUM
- **Locations**:
  - Line 242: `console.log(\` Parent session: ${runtime.session.sessionFile}\n\`)` → absolute path
  - Line 229: `console.log('[Debug] Commands:', Array.from(extensionCommands.keys()))` → command enumeration
- **Impact**: PII leakage, directory structure exposure, reconnaissance help for attackers
- **Effort**: 1 hour
- **Fix**: Sanitize paths, remove debug dumps in production

### **M2. Extension Trust Boundary Missing**
- **Severity**: 🟡 MEDIUM
- **Location**: Line 200 - `await extensionsAggregator(api)`
- **Issue**: No validation that extensions are trusted/signed
- **Risk**: Malicious extension could:
  - Use `exec` to run arbitrary commands
  - Access `getFlag` to read internal config
  - Exfiltrate data via `sendMessage`
- **Effort**: 4+ hours (major design change)
- **Fix**:
  - Extension signature verification
  - Permission model (capabilities)
  - Allowlist/denylist
  - Sandboxing (eval restrictions)

### **M3. `process.argv[1]` PII Leakage**
- **Severity**: 🟡 MEDIUM
- **Location**: Lines 80, 82 in `myCustomPrompt`
- **Issue**: `process.argv[1]` may contain:
  - Temporary paths with session IDs
  - User home directory (PII)
  - Internal project structure
- **Impact**: PII in prompt metadata, logs
- **Effort**: 30 min
- **Fix**: Use `__filename` or sanitize

### **M4. Debug Logs in Production**
- **Severity**: 🟡 MEDIUM
- **Logs**:
  - Line 150: Banner
  - Line 201: `[Debug] Aggregator loaded...`
  - Line 229: `[Debug] Commands: [...]`
  - Line 242: Session path
- **Impact**: Noise, performance, information leakage
- **Effort**: 1 hour
- **Fix**: Use structured logger with LOG_LEVEL env var

### **M5. SOLID Violations**
- **Severity**: 🟡 MEDIUM
- **Issues**:
  - **ISP**: Import 40+ symbols, use 10%
  - **SRP**: `main()` does 4 things
  - **DIP**: Direct dependency on concrete `extensionsAggregator`
- **Impact**: Tight coupling, hard to test/extend
- **Effort**: 3 hours (included in refactor)
- **Fix**: Already covered by splitting functions, dependency injection

### **M6. No Graceful Shutdown**
- **Severity**: 🟡 MEDIUM
- **Issue**: No signal handlers (SIGINT, SIGTERM)
- **Impact**: Abrupt termination, session not saved, state loss
- **Effort**: 1 hour
- **Fix**: Add process signal handlers, cleanup before exit

---

## 🟢 LOW PRIORITY / NICE-TO-HAVE

### **L1. Speculative Generality**
- **Issue**: `pluginLoader: undefined` never used
- **Effort**: 10 min
- **Fix**: Remove or implement stub

### **L2. Commented Code**
- **Issue**: Lines 246-247: Vietnamese comments explaining disabled verbose flag
- **Effort**: 5 min
- **Fix**: Remove or convert to proper documentation

### **L3. Inconsistent Language**
- **Issue**: Mixed English/Vietnamese comments
- **Effort**: 15 min
- **Fix**: Standardize on English

### **L4. Missing JSDoc**
- **Issue**: Functions lack documentation
- **Effort**: 1 hour
- **Fix**: Add JSDoc for all exported functions

### **L5. No Unit Tests**
- **Severity**: 🟢 LOW (should be higher but separate task)
- **Effort**: 4-6 hours
- **Fix**: Write tests for:
  - `initializeRuntime()`
  - `ExtensionLoader.load()`
  - `buildExtensionObject()`
  - Error scenarios

---

## 📋 DETAILED REFACTOR PLAN

### **PHASE 1: Immediate Cleanup (1 hour)**
**Goal**: Remove noise, reduce lines, quick wins

**Tasks**:
- [ ] Delete `loadExtensionsForRuntime()` function (lines 37-76)
- [ ] Remove unused imports: `discoverAndLoadExtensions`, `join`, all `create*Tool`
- [ ] Delete `/* eslint-disable */` comment
- [ ] Remove `demoModel` variable (lines 250-254)
- [ ] Delete banner log (line 150)
- [ ] Remove `[Debug]` logs (lines 201, 229)
- [ ] Delete session path log (line 242)
- [ ] Remove commented code lines 246-247

**Verification**:
- File size: ~170 lines (from 300)
- `eslint` passes with no unused vars
- No debug logs remain

---

### **PHASE 2: Type Safety Foundation (2 hours)**
**Goal**: Eliminate all `as any` casts

**Tasks**:
- [ ] Create `src/types/extensions.ts`:
  ```typescript
  export interface ExtensionAPI { /* all methods */ }
  export interface ExtensionCommand { name: string; [key: string]: any }
  export interface Extension { /* all properties */ }
  ```
- [ ] Create `src/types/pi-augmentation.d.ts` to extend Pi SDK types
- [ ] Replace inline `any` types with proper interfaces
- [ ] Validate all method signatures match real Pi SDK

**Verification**:
- `tsc --noEmit` passes with 0 errors
- Search file: 0 occurrences of `as any`
- IDE shows proper autocomplete

---

### **PHASE 3: Extract ExtensionLoader (2 hours)**
**Goal**: Remove duplication, single responsibility

**Tasks**:
- [ ] Create `src/services/extension-loader.ts`
- [ ] Implement:
  - `private extensionTools: ToolDefinition[]`
  - `private extensionCommands: Map<string, ExtensionCommand>`
  - `buildAPI(): ExtensionAPI` - returns api object
  - `async load(aggregator): Promise<boolean>`
  - `getTools(): ToolDefinition[]`
  - `getCommands(): Map<string, ExtensionCommand>`
  - `buildExtensionObject(metadata): Extension`
- [ ] Refactor `main()` to use `ExtensionLoader`
- [ ] Remove duplicate API construction code

**Verification**:
- 0 duplicate code lines
- `ExtensionLoader` unit tested (separate task)
- Mock aggregator in test → verifies collection

---

### **PHASE 4: Split main() into Functions (2 hours)**
**Goal**: SRP, testability, complexity ≤10

**Tasks**:
```typescript
async function initializeRuntime(): Promise<AgentSessionRuntime>
async function loadExtensions(runtime: AgentSessionRuntime): Promise<void>
async function launchInteractiveMode(runtime: AgentSessionRuntime): Promise<void>
```

**Implementation**:
- [ ] `initializeRuntime`:
  - Create `SessionManager`
  - Call `createAgentSessionRuntime(createRuntime, options)`
  - `setCurrentRuntime(runtime)`
  - Wrap in try-catch, validate result
- [ ] `loadExtensions`:
  - Use `ExtensionLoader`
  - Bind to session
  - Refresh commands (with proper error handling)
- [ ] `launchInteractiveMode`:
  - Create `InteractiveMode`
  - Wrap `mode.run()` in try-catch
- [ ] `main()` becomes:
  ```typescript
  export async function main() {
    try {
      const runtime = await initializeRuntime();
      await loadExtensions(runtime);
      await launchInteractiveMode(runtime);
    } catch (err) {
      logger.fatal(err, 'Application startup failed');
      process.exit(1);
    }
  }
  ```

**Verification**:
- Each function ≤20 lines ✓
- Complexity ≤10 ✓
- Unit testable with mocks ✓

---

### **PHASE 5: Error Handling Blanket (2 hours)**
**Goal**: 100% coverage for all async operations

**Tasks**:
- [ ] Wrap `createAgentSessionServices()` in `createRuntime` (line 103)
- [ ] Wrap `createAgentSessionFromServices()` in `createRuntime` (line 127)
- [ ] Fix `ExtensionLoader.load()` error handling (already in Phase 3)
- [ ] Wrap `bindExtensions()` in try-catch with fallback strategy
- [ ] Wrap `refreshCommands()` - either remove try-ignore or log error
- [ ] Add error handling to `ExtensionLoader.buildAPI()` optional methods
- [ ] Graceful degradation strategy:
  - If services fail → log error, exit 1
  - If extensions fail → log warning, continue without
  - If session bind fails → log error, exit 1 (critical)

**Verification**:
- All `await` calls inside try-catch or have `.catch()`
- No `// ignore` comments
- Error messages include context (function, params)

---

### **PHASE 6: Input Validation (2 hours)**
**Goal**: Validate all external inputs

**Tasks**:
- [ ] Validate `cwd` in `initializeRuntime()`:
  ```typescript
  function validateCwd(cwd: string): asserts cwd is string {
    if (!cwd || typeof cwd !== 'string') throw new Error('Invalid cwd');
    if (cwd.includes('..')) throw new Error('Cwd cannot contain ..');
    if (!path.isAbsolute(cwd)) throw new Error('Cwd must be absolute');
  }
  ```
- [ ] Validate `agentDir`
- [ ] In `ExtensionLoader.buildExtensionObject()`:
  - Check tool names unique (line 208)
  - Check no collision with built-in tool names
  - Validate extension metadata (name, version format)
- [ ] Validate `services`, `runtime` parameters not null/undefined

**Verification**:
- Unit tests: invalid inputs throw descriptive errors
- Fuzzing: random inputs handled gracefully

---

### **PHASE 7: Security Hardening (2 hours)**
**Goal**: Fix all security issues

**Tasks**:
- [ ] Sanitize logged paths:
  ```typescript
  function sanitizePath(path: string): string {
    const home = os.homedir();
    return path.replace(home, '~').replace(/\/[^\/]{8,}/g, '/...');
  }
  ```
- [ ] Remove sensitive data from logs:
  - Session path: use `sanitizePath()`
  - Command list: remove in production (debug only)
- [ ] Add extension signature check stub:
  ```typescript
  function verifyExtension(ext: Extension): boolean {
    // TODO: implement proper signature verification
    return true; // placeholder
  }
  ```
- [ ] Fix `process.argv[1]` exposure in `myCustomPrompt`:
  - Replace with `__filename`
  - Or sanitize: `path.basename(process.argv[1])`
- [ ] Add allowlist for extension sources (future)

**Verification**:
- No absolute paths in logs
- No PII in logs
- Extension metadata sanitized

---

### **PHASE 8: Structured Logging (1 hour)**
**Goal**: Replace `console.*` with proper logger

**Tasks**:
- [ ] Add `pino` or `winston` dependency
- [ ] Create `src/logger.ts`:
  ```typescript
  import pino from 'pino';
  export const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    transport: process.env.NODE_ENV === 'production' ? undefined : { target: 'pino-pretty' }
  });
  ```
- [ ] Replace all `console.log`, `console.warn`, `console.error` with `logger.*`
- [ ] Add structured data: `logger.info({ extensions: count }, 'Loaded')`
- [ ] Set up log rotation (future)

**Verification**:
- JSON logs in production mode
- Human-readable in dev mode
- No `console.*` calls remain (except in tests)

---

### **PHASE 9: Graceful Shutdown (1 hour)**
**Goal**: Handle SIGTERM, SIGINT properly

**Tasks**:
- [ ] Add signal handlers in `initializeRuntime()` or `main()`:
  ```typescript
  let shuttingDown = false;
  const signals = ['SIGINT', 'SIGTERM', 'SIGQUIT'];
  for (const signal of signals) {
    process.once(signal, async () => {
      if (shuttingDown) return;
      shuttingDown = true;
      logger.info({ signal }, 'Shutting down gracefully');
      // Cleanup: close session, save state, etc.
      await cleanupRuntime(runtime);
      process.exit(0);
    });
  }
  ```
- [ ] Implement `cleanupRuntime(runtime)`:
  - Close session (if needed)
  - Flush logger
  - Release resources
- [ ] Ensure `mode.run()` responds to shutdown signal

**Verification**:
- `kill -TERM <pid>` → graceful shutdown
- No zombie processes
- State persisted if needed

---

### **PHASE 10: Constants & Configuration (1 hour)**
**Goal**: Remove magic values

**Tasks**:
- [ ] Create `src/constants.ts`:
  ```typescript
  export const EXTENSION = {
    NAME: 'jf-extensions',
    VERSION: '1.0.0',
    DESCRIPTION: 'Extensions from src/extensions',
    SOURCE_INFO: {
      path: __filename,
      source: 'local' as const,
      scope: 'project' as const,
      origin: 'top-level' as const
    }
  };
  ```
- [ ] Replace hardcoded values in `buildExtensionObject()`
- [ ] Define built-in tool names as constant array

**Verification**:
- 0 magic strings/numbers
- All constants defined in one place

---

### **PHASE 11: Final Polish (1 hour)**
**Goal**: Code review, documentation, cleanup

**Tasks**:
- [ ] Add JSDoc to all exported functions
- [ ] Run `prettier --write` formatting
- [ ] Run `eslint --fix` auto-fixes
- [ ] Update `AGENT_METRICS.md` with before/after metrics
- [ ] Update `AGENT_PROFILE.md` with new weaknesses (if any)
- [ ] Update `EVOLUTION.md` with refactor plan
- [ ] Create changelog entry
- [ ] Manual testing:
  - Run CLI, verify extensions load
  - Test error scenarios (kill extension aggregator)
  - Test signals (SIGTERM)

---

## 📅 TIMELINE

| Phase | Hours | Dependencies | Assignee |
|-------|-------|--------------|----------|
| Phase 1: Cleanup | 1 | None | Dev |
| Phase 2: Types | 2 | Phase 1 | Dev |
| Phase 3: ExtensionLoader | 2 | Phase 2 | Dev |
| Phase 4: Split main() | 2 | Phase 3 | Dev |
| Phase 5: Error Handling | 2 | Phase 4 | Dev |
| Phase 6: Validation | 2 | Phase 5 | Dev |
| Phase 7: Security | 2 | Phase 6 | Dev |
| Phase 8: Logging | 1 | Phase 7 | Dev |
| Phase 9: Shutdown | 1 | Phase 8 | Dev |
| Phase 10: Constants | 1 | Phase 9 | Dev |
| Phase 11: Polish | 1 | Phase 10 | Dev |
| **Total** | **16** | - | - |

**Alternative**: Phases 1-3 as **Week 1**, Phases 4-7 as **Week 2**, Phases 8-11 as **Week 3**

---

## 🧪 TESTING PLAN

### **Unit Tests** (4-6 hours, separate task)

**Test files**:
- `src/__tests__/main.unit.test.ts`
- `src/__tests__/extension-loader.test.ts`
- `src/__tests__/types/augmentation.test.ts`

**Coverage targets**:
- `initializeRuntime()`: 100%
- `loadExtensions()`: 100%
- `launchInteractiveMode()`: 100%
- `ExtensionLoader` methods: 100%

**Scenarios**:
- ✅ Happy path (all services succeed)
- ❌ `createAgentSessionServices()` throws
- ❌ `createAgentSessionFromServices()` throws
- ❌ `extensionsAggregator()` throws
- ❌ `bindExtensions()` throws
- ❌ `mode.run()` throws
- ✅ Extensions empty (0 tools, 0 commands)
- ✅ Duplicate tool names (should warn/skip)
- ✅ Invalid cwd, agentDir
- ✅ SIGTERM during startup
- ✅ SIGTERM during InteractiveMode

---

## 📈 METRICS TRACKING

### **Before Refactor**
```
File size: 300 lines
Functions: 3 (0 ≤20 lines)
Complexity: avg 12 (max 15)
as any: 17 occurrences
Dead code: 40 lines
Duplication: 35 lines
Error handling: 20%
Tests: 0%
Grade: C+ (65)
```

### **After Refactor Targets**
```
File size: ~200 lines (main.ts) + 150 lines (new files)
Functions: 6+ (all ≤20 lines)
Complexity: avg ≤8 (max ≤10)
as any: 0 occurrences
Dead code: 0 lines
Duplication: 0 lines
Error handling: 100%
Tests: 80%+ coverage
Grade: A- (90+)
```

---

## 🚀 IMPLEMENTATION CHECKLIST

### **Pre-Refactor**
- [ ] Create backup branch: `git checkout -b refactor/main-cleanup`
- [ ] Run existing tests (if any): `npm test`
- [ ] Document current behavior (screenshots, logs)
- [ ] Set up coverage tool: `npm i -D c8`

### **During Refactor**
- [ ] Commit after each phase (atomic commits)
- [ ] Run linting: `npm run lint`
- [ ] Run type checking: `npm run type-check`
- [ ] Manual smoke test after each phase
- [ ] Update this TODO file with progress

### **Post-Refactor**
- [ ] All phases completed
- [ ] All tests passing: `npm test`
- [ ] Coverage ≥80%: `npm run test:coverage`
- [ ] Lint & type-check passing
- [ ] Prettier formatted
- [ ] Manual E2E test (run CLI, verify functionality)
- [ ] Review with team/code owner
- [ ] Merge to main with protection

---

## 🎯 DEFINITION OF DONE

For each phase:
- [ ] Code implemented
- [ ] Tests written (where applicable)
- [ ] Documentation updated (JSDoc, constants)
- [ ] Linting passes
- [ ] Type checking passes
- [ ] Manual verification completed
- [ ] This TODO updated with ✅

Overall:
- [ ] All phases 1-11 complete
- [ ] `src/main.ts` ≤200 lines
- [ ] Zero `as any` casts
- [ ] Zero debug `console.log` in non-test files
- [ ] All functions ≤20 lines, complexity ≤10
- [ ] 100% error handling coverage
- [ ] 80%+ test coverage
- [ ] Production-ready (no console logs, structured logging, graceful shutdown)

---

## 🔗 RELATED FILES & RESOURCES

### **Files to modify**
- `src/main.ts` - primary
- `src/types/extensions.ts` - new
- `src/types/pi-augmentation.d.ts` - new
- `src/services/extension-loader.ts` - new
- `src/logger.ts` - new
- `src/constants.ts` - new

### **Dependencies to add**
- `pino` or `winston` (logger)
- `c8` (coverage)
- (optional) `yaml` for extension manifests

### **Docs to update**
- `README.md` - if CLI usage changes
- `docs/ARCHITECTURE.md` - new structure
- `docs/AGENT_METRICS.md` - metrics
- `docs/AGENT_PROFILE.md` - weaknesses
- `docs/EVOLUTION.md` - roadmap
- `CHANGELOG.md` - new entry

---

## 📞 ESCALATION & QUESTIONS

**If stuck**:
1. Review Pi SDK types/definitions thoroughly
2. Consult team architect for extension architecture
3. Check `@earendil-works/pi-coding-agent` issue tracker for similar patterns
4. Create spike to test `bindExtensions` behavior

**Open questions**:
- Should we implement extension signature verification now or later?
- Should we support hot-reloading extensions?
- Should we have config file for extension settings?
- What's the exact type of `Extension`? Need to reverse-engineer from Pi SDK

---

## 📊 BURNOUT PREVENTION

This is **16-20 hours** of focused work. Suggestions:
- Split into 3 days (5h/day)
- Pair program for complex types
- Take breaks every 90 minutes
- Celebrate after each phase completion
- Keep this TODO updated with actual time spent

---

**Last updated**: 2025-06-19
**Owner**: TBD (you?)
**Status**: 📝 Planning
 - [x] Refactor createTodoTool in todos-tool.ts (next high-impact)
- [x] Refactor createMasterTool in master-tool.ts (next high-impact)
- [ ] Refactor resolveInAllFiles in dependency_tree.ts (next)
- [ ] Refactor AgentTeam in team-manager.ts (1007 lines)
