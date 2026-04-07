# MEMORY — Recurring Issue Pattern Cache

## Format

```
[MEMORY]
[TYPE]: BUG | MISSING | IMPROVEMENT
[ISSUE]: short description (specific)
[FIX]: actionable avoidance strategy
[COUNT]: integer (1-9)
```

Max 5 entries. When adding 6th, drop oldest.

---

## Current Entries

_No recurring issues observed yet. This will be populated after code generation and self-reflection cycles._

---

## How It Works

During each iteration's SELF-REFLECTION CYCLE, identify issues:

1. Bug: Something that could fail at runtime
2. Missing: Something that should be there but isn't
3. Improvement: Something that could be better

If the same ISSUE appears in multiple iterations → increment COUNT. When COUNT ≥ 2 → trigger RULE_UPDATE to AGENTS.md.

---

## Examples (for reference)

```
[MEMORY]
[TYPE]: BUG
[ISSUE]: off-by-one error in loop boundaries
[FIX]: use `for (const [i, item] of seq.entries())` instead of manual index math
[COUNT]: 2

[MEMORY]
[TYPE]: MISSING
[ISSUE]: no input validation for null/empty user prompts
[FIX]: add guard clause at start of every public function: `if (!input) throw new Error('...')`
[COUNT]: 3
```

---

## Last Updated

2025-04-06 (initialized, empty)
