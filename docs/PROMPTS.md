# Slash Command Prompts — `.pi/prompts/`

This directory contains prompt templates for pi's slash commands. These prompts are triggered when users invoke specific commands in the terminal.

---

## Overview

| Command | File | Description |
|---------|------|-------------|
| `/pr` | `pr.md` | Review PRs from URLs |
| `/wr` | `wr.md` | Wrap up task (changelog, commit, push) |
| `/is` | `is.md` | Analyze GitHub issues |
| `/cl` | `cl.md` | Audit changelog entries |

---

## Command Details

### `/pr` — Review PRs

**File**: `.pi/prompts/pr.md`

Process:
1. Add `inprogress` label to PR via GitHub CLI
2. Read PR page (description, comments, commits, changed files)
3. Identify linked issues, read them
4. Analyze diff against current main branch
5. Check changelog entries in `packages/*/CHANGELOG.md`
6. Check if README/docs need modification
7. Provide structured review (Good, Bad, Ugly, Questions)
8. Add change summary and test requirements

**Output format**:
```
PR: <url>
Changelog: ...
Good: ...
Bad: ...
Ugly: ...
Questions or Assumptions: ...
Change summary: ...
Tests: ...
```

---

### `/wr` — Wrap Task

**File**: `.wr.md`

Process:
1. Add/update changelog entry under `## [Unreleased]`
2. If tied to GitHub issue/PR, draft final comment
3. Commit only files changed in this session
4. Include `closes #<issue>` in commit message (if applicable)
5. Check current branch is `main`
6. Push

**Constraints**:
- Never stage unrelated files
- Never use `git add .` or `git add -A`
- Run checks before committing
- Do not open PR unless explicitly asked

---

### `/is` — Issue Analysis

**File**: `is.md`

Process:
1. Add `inprogress` label to issue
2. Read issue (all comments, linked issues/PRs)
3. **For bugs**:
   - Ignore root cause analysis in issue (likely wrong)
   - Trace actual code path
   - Propose fix
4. **For features**:
   - Verify implementation proposals independently
   - Propose most concise approach
   - List affected files

**Note**: Do NOT implement unless explicitly asked. Analyze only.

---

### `/cl` — Changelog Audit

**File**: `cl.md`

Process:
1. Find last release tag: `git tag --sort=-version:refname | head -1`
2. List commits since last tag
3. Read each package's `[Unreleased]` section
4. Verify:
   - Changelog entry exists for each commit
   - Format correct (internal vs external contribution)
   - Cross-package duplication (ai/agent/tui → coding-agent)
5. Report:
   - Commits with missing entries
   - Entries needing cross-package duplication
   - Add missing entries directly

---

## Usage in pi

These prompts are loaded as slash command handlers. When user types:
- `/pr <url>` → loads pr.md with URL as argument
- `/wr` → loads wr.md
- `/is <issue-number>` → loads is.md with issue number
- `/cl` → loads cl.md

The prompts define the **behavior** but the actual execution happens through GitHub CLI tools and file operations.