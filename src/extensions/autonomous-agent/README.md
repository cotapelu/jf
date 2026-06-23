# Autonomous Agent Extension

Provides continuous, self-improving agent that runs in the background to maintain and enhance codebase quality.

## Features

- **Continuous Discovery**: Runs every 2 hours to scan codebase for issues
- **Quality Gate Enforcement**: Lint, TypeScript, Tests, Build
- **Security Scanning**: Detect secrets, npm audit
- **Complexity Analysis**: Identify functions needing refactoring
- **Proactive Improvements**: Suggests coverage increases, dependency updates, etc.
- **Auto-Fix**: Automatically fixes violations (in future iterations)
- **Metrics Logging**: Records all actions to `docs/AGENT_METRICS.md`
- **Git Integration**: Auto-commits and pushes successful changes

## Commands

- `/autonomous.start` - Start the autonomous agent (starts automatically by default)
- `/autonomous.stop` - Stop the autonomous agent
- `/autonomous.status` - Check current status (cycles, tasks completed/failed)
- `/autonomous.now` - Trigger an immediate improvement cycle

## Configuration

- `--autonomous-auto-start` (boolean, default: true) - Enable/disable auto-start on load

## How It Works

1. **Discovery Phase**: Runs quality gates (lint, type-check, tests, build) and security scans
2. **Proactive Analysis**: Even if no violations, finds improvements:
   - Coverage gaps (<85%)
   - High complexity functions (≥8)
   - Outdated dependencies
   - Security hardening opportunities
3. **Prioritization**: Tasks sorted by severity (CRITICAL → HIGH → MEDIUM → LOW)
4. **Execution**: Executes top task, runs tests to verify, commits if successful
5. **Metrics**: Logs results to AGENT_METRICS.md, updates AGENT_PROFILE.md and EVOLUTION.md as needed

## Compliance

All changes pass the Quality Gate:
- Functions ≤20 lines
- Complexity ≤10
- No 5+ duplicates
- 100% error handling (public APIs)
- 100% input validation (external)
- No hardcoded secrets
- Coverage ≥80%
- All tests pass

## Future Enhancements

- Auto-fix implementation for common violations
- Team delegation for complex refactors
- Performance benchmarking
- Observability instrumentation
- Concurrency safety analysis
- Automated documentation updates
