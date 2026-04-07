# Agent Profile — Self-Awareness Data

## Identity

- **Agent**: pi autonomous software engineering agent
- **Stack**: TypeScript, Node.js, Vitest, Biome
- **Codebase**: pi-monorepo (multi-package)
- **Mode**: Long-running, self-improving

---

## Frequent Failure Modes

_This section will be populated after test runs and iterations._

Currently unknown — no tests executed yet.

---

## Stack-Specific Error Rates

_To be tracked after test runs._

- **TypeScript compile errors**: N/A (all clean on bootstrap)
- **Test failures**: N/A (not run)
- **Lint errors**: N/A (Biome clean)

---

## Fragile Modules (High Risk of Breakage)

Based on codebase structure inspection:

1. **`packages/coding-agent/src/core/agent-session-runtime.ts`**
   - Complex event-driven architecture
   - Multiple async flows (tool execution, message streaming, provider timeouts)
   - High coupling with provider implementations

2. **`packages/coding-agent/src/core/compaction/`**
   - Summarization logic (branch-summarization.ts)
   - State management during compaction
   - Edge cases: large sessions, nested branches

3. **OAuth Flows** (`packages/ai/src/utils/oauth/`)
   - Multiple providers (Anthropic, GitHub Copilot, Google, OpenAI Codex)
   - PKCE implementation, token refresh, page interception
   - Sensitive to browser/CLI environment differences

4. **Provider Implementations** (`packages/ai/src/providers/`)
   - Each provider has subtle differences in streaming, tool-calling, error codes
   - Anthropic, OpenAI, Google, Mistral, Bedrock all need consistent behavior
   - Cross-provider handoffs rely on exact message/tool mapping

5. **Extensions Loader** (`packages/coding-agent/src/core/extensions/loader.ts`)
   - Dynamic `import()` of user-provided code
   - Sandbox escape risks, crash isolation
   - Version compatibility with pi core

6. **Bash Executor** (`packages/coding-agent/src/core/bash-executor.ts`)
   - OS-specific behavior (Windows vs Unix)
   - Signal handling, process lifetime, PTY allocation
   - Security: arbitrary command execution

---

## Known Weaknesses

- **No test coverage metric**: Unknown what % of codebase is tested
- **No CI/CD**: No automated verification on commit/PR
- **No performance benchmarks**: Latency profiles unknown
- **No error monitoring**: Runtime exceptions not aggregated
- **OSS weekend mode**: Issue tracker auto-closing may mask user-reported bugs
- **Binary artifacts**: `packages/coding-agent/binaries/` contains prebuilt binaries — risk of stale binaries not being rebuilt

---

## Improvement Opportunities

1. **Testing**:
   - Run full test suite, measure coverage
   - Identify flaky tests, fix instability
   - Add integration tests for provider handoffs

2. **Reliability**:
   - Add circuit breakers for provider timeouts
   - Better error classification (retryable vs fatal)
   - Tool execution queue with backpressure

3. **Observability**:
   - Structured logging (JSON) for debugging
   - Metrics: token usage, tool latency, compaction frequency
   - Session health summary on exit

4. **Security**:
   - Sandbox extension runtime (worker threads, vm2, etc.)
   - Path traversal checks in file tools
   - Credential storage encryption

5. **Developer Experience**:
   - Better error messages with suggested fixes
   - Debug mode with verbose provider dumps
   - REPL for testing tools manually

---

## Last Updated

2025-04-06 (initial bootstrap)
