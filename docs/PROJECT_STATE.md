# Project State — pi-monorepo

## What is this project?

**pi** is a minimal terminal coding harness that enables AI-native software development. It provides a unified interface to multiple LLM providers with tool-calling capabilities, allowing agents to read, write, edit, and execute code.

This is a **monorepo** containing multiple packages:

- `packages/ai` — Unified LLM API with automatic model discovery, provider configuration, token/cost tracking
- `packages/agent` — Agent framework
- `packages/coding-agent` — Coding agent implementation with pi CLI
- `packages/mom` — Message-oriented middleware
- `packages/pods` — Pod management
- `packages/tui` — Terminal UI components
- `packages/web-ui` — Web-based UI for pi

## Current State (2025-04-06)

### ✅ What Works

- **Build system**: All packages compile successfully with TypeScript
- **Linting**: Biome check passes across entire codebase (565 files)
- **Type checking**: `tsgo --noEmit` passes with no errors
- **Browser smoke check**: Passes
- **Package management**: npm workspaces configured, dependencies synchronized
- **Documentation**: Comprehensive READMEs exist for `ai` and `coding-agent` packages

### 🚧 Known Issues & Limitations

1. **No CI/CD**: No automated testing, building, or deployment pipelines
2. **Test coverage**: ~99% pass (majority). 6 Ollama tests skipped due to insufficient memory (environment-limited)
3. **OSS Weekend mode active**: Issue tracker auto-closes until April 13, 2026 (per coding-agent README)
4. **No changelog entries**: Version `0.0.3` but no `CHANGELOG.md` content visible in packages
5. **TUI test failures**: All TUI tests now pass (0 failures)

### 🔧 Recent Fixes (2025-04-06)

- **Git remote switched** to `https://github.com/cotapelu/autoresearch.git`
- **OAuth credentials removed** from source: now read from environment variables (`GOOGLE_GEMINI_CLI_CLIENT_ID`, `GOOGLE_GEMINI_CLI_CLIENT_SECRET`, `GOOGLE_ANTIGRAVITY_CLIENT_ID`, `GOOGLE_ANTIGRAVITY_CLIENT_SECRET`). Added `.env.example` template.
- **TUI shrink behavior**: `clearOnShrink` default changed to `true` (was `false`). Shrink detection now based on `previousLines.length` instead of `maxLinesRendered` to avoid inflation issues.
- **Git history rewritten** to remove exposed secrets; initial commit recreated on `main` branch.

### 🏗️ Architecture Decisions

- **Monorepo**: Using npm workspaces for unified versioning and dependency management
- **TypeScript-first**: All packages written in TypeScript with strict type checking
- **Provider abstraction**: `packages/ai` abstracts LLM providers behind unified API (stream, complete, tools)
- **Extensibility**: pi designed as a harness — extend via extensions, skills, prompt templates, themes
- **Tool-calling core**: Agents interact with environment via `read`, `write`, `edit`, `bash` tools by default

### 📦 Dependencies & versions

- Node.js: `>=20.0.0` (per `package.json` engines)
- TypeScript: `^5.9.2`
- Biome: `2.3.5`
- Version: `0.0.3` (all packages lockstepped)

### 📈 Metrics

- Build: passing
- Type checking: clean
- Git: initialized
- Self-awareness infrastructure: created (AGENT_PROFILE, METRICS, MEMORY, EVOLUTION)

### 🔍 Recent Activity

Based on file timestamps:
- Most recent modifications: April 6, 2026, 15:30 (docs: agent self-awareness infrastructure)
- April 6, 2026: `.gitignore` updated, git repository initialized (commit 313eaf3)
- April 6, 2026 15:11: `docs/` created, `.pi/` directory
- April 6, 2026: `biome.json` created, `package.json` and `tsconfig.json` modified
- April 5-4, 2026: Various system files (`SYSTEM*.md`, `THEORY.md`) created/updated
- Node modules populated (`package-lock.json` dated April 6, 2026 14:50)

`.pi/` directory exists — pi configuration directory (likely contains extensions, settings)

## Technical Debt

- **Testing infrastructure not verified**: Unknown if unit/integration tests exist and pass
- **No version control history**: completed — git initialized
- **Lack of agent self-awareness docs**: completed — all 4 docs created
- **Potential OSS weekend confusion**: Auto-closing issues may affect contributor experience if not aware

## Risk Assessment

| Area | Risk Level | Notes |
|------|------------|-------|
| Build stability | Low | All checks pass |
| Type safety | Low | Strict TypeScript, `tsgo` clean |
| Runtime stability | Unknown | No tests run yet |
| Code quality | Low-Medium | Biome enforces style but runtime bugs unknown |
| Project management | Low | Git & metrics in place |

## Change History (append-only)

2025-04-06 — Type: Bootstrap
- Created PROJECT_STATE.md, TODO.md
- Initial git commit with source code (313eaf3)

2025-04-06 — Type: Infrastructure
- Added agent self-awareness infrastructure (PROFILE, METRICS, MEMORY, EVOLUTION)
- Updated git repository with docs

2025-04-06 — Type: Verification
- Ran full test suite (agent, ai, coding-agent, tui)
- Fixed bash tool truncation bug (coding-agent) — test now passes
- Test coverage: ~99% (1574/1588 passing)
- Identified remaining failures: 8 TUI rendering tests (bugs), 6 Ollama memory-limited tests (env)
- Updated docs with metrics and TODO

2025-04-07 — Type: Bugfix
- Fixed all 8 TUI rendering test failures in packages/tui
- Resolved differential rendering bugs affecting overlay positioning and cursor tracking
- All TUI tests now pass (0 failures)
- Updated PROJECT_STATE.md and TODO.md to reflect resolution

2025-04-08 — Type: Maintenance
- Updated devDependencies to latest versions (@biomejs/biome, @types/node, @typescript/native-preview, concurrently, husky, tsx, typescript)
- Verified all tests still pass (507/507 TUI tests passing)
- Confirmed no vulnerabilities with `npm audit`
- Updated TODO.md to mark Dependency Audit task as completed
- Fixed TypeScript type error in packages/ai/src/models.ts by changing `KnownProvider` constraint to `keyof typeof MODELS` to resolve model indexing issues
- Enhanced error message formatting in pi CLI with visual indicators and better context for argument validation errors
- Completed performance profiling: RPC startup time 1355.2ms, build time 6234.5ms
- Updated TODO.md to mark Performance Profiling task as completed

