# Core Directory Restructuring TODO

**Objective**: Reorganize `src/core/` by creating 6 new subdirectories and moving all files (except 2 top-level files) into them.

**Current State**:
- `src/core/` has 30 TypeScript files directly in the root
- 4 existing subdirectories: `tools/`, `extensions/`, `compaction/`, `export-html/`
- Too many files at root level; poor separation of concerns

**Target State**:
```
src/core/
├── index.ts                        (barrel - keep at root)
├── agent-session-runtime.ts        (runtime factory - keep at root)
│
├── session/        (NEW) - agent lifecycle & state management
│   ├── agent-session.ts
│   ├── agent-session-services.ts
│   ├── session-manager.ts
│   ├── session-cwd.ts
│   └── index.ts
│
├── config/         (NEW) - configuration management
│   ├── settings-manager.ts
│   ├── defaults.ts
│   ├── resolve-config-value.ts
│   └── index.ts
│
├── cli-tools/      (NEW) - CLI-specific utilities
│   ├── bash-executor.ts
│   ├── command-history.ts
│   ├── exec.ts
│   ├── auth-storage.ts
│   ├── keybindings.ts
│   ├── slash-commands.ts
│   └── index.ts
│
├── models/         (NEW) - model discovery & resolution
│   ├── model-registry.ts
│   ├── model-resolver.ts
│   ├── resource-loader.ts
│   └── index.ts
│
├── infra/          (NEW) - infrastructure concerns
│   ├── event-bus.ts
│   ├── timings.ts
│   ├── diagnostics.ts
│   ├── output-guard.ts
│   ├── sdk.ts
│   ├── package-manager.ts
│   └── index.ts
│
├── ux/             (NEW) - user experience components
│   ├── prompt-templates.ts
│   ├── system-prompt.ts
│   ├── messages.ts
│   ├── footer-data-provider.ts
│   ├── skills.ts
│   ├── source-info.ts
│   └── index.ts
│
├── extensions/     (existing)
├── compaction/     (existing)
└── export-html/    (existing)
```

**Root files reduced from 30 → 2** ✅
- New folders: 6 (session, config, cli-tools, models, infra, ux)
- Total folders in core/: 10 (6 new + 4 existing)

---

## Migration Steps

### Phase 1: Preparation
- [ ] Ensure all tests passing: `npm test`
- [ ] Commit current state: `git add -A && git commit -m "chore: prepare core restructuring"`
- [ ] Create branch: `git checkout -b refactor/core-reorg`

### Phase 2: Create Directories
```bash
cd src/core
mkdir session config cli-tools models infra ux
```

### Phase 3: Move Files to New Locations
```bash
# session/
mv agent-session.ts session-manager.ts session-cwd.ts agent-session-services.ts session/

# config/
mv settings-manager.ts defaults.ts resolve-config-value.ts config/

# cli-tools/
mv bash-executor.ts command-history.ts exec.ts auth-storage.ts keybindings.ts slash-commands.ts cli-tools/

# models/
mv model-registry.ts model-resolver.ts resource-loader.ts models/

# infra/
mv event-bus.ts timings.ts diagnostics.ts output-guard.ts sdk.ts package-manager.ts infra/

# ux/
mv prompt-templates.ts system-prompt.ts messages.ts footer-data-provider.ts skills.ts source-info.ts ux/
```

### Phase 4: Create Barrel Index Files
Create `index.ts` in each new folder:

**session/index.ts**:
```typescript
export * from "./agent-session.js";
export * from "./agent-session-services.js";
export * from "./session-manager.js";
export * from "./session-cwd.js";
```

**config/index.ts**:
```typescript
export * from "./settings-manager.js";
export * from "./defaults.js";
export * from "./resolve-config-value.js";
```

**cli-tools/index.ts**:
```typescript
export * from "./bash-executor.js";
export * from "./command-history.js";
export * from "./exec.js";
export * from "./auth-storage.js";
export * from "./keybindings.js";
export * from "./slash-commands.js";
```

**models/index.ts**:
```typescript
export * from "./model-registry.js";
export * from "./model-resolver.js";
export * from "./resource-loader.js";
```

**infra/index.ts**:
```typescript
export * from "./event-bus.js";
export * from "./timings.js";
export * from "./diagnostics.js";
export * from "./output-guard.js";
export * from "./sdk.js";
export * from "./package-manager.js";
```

**ux/index.ts**:
```typescript
export * from "./prompt-templates.js";
export * from "./system-prompt.js";
export * from "./messages.js";
export * from "./footer-data-provider.js";
export * from "./skills.js";
export * from "./source-info.js";
```

### Phase 5: Update core/index.ts
Replace the current exports with:

```typescript
/**
 * Core modules shared between all run modes.
 */

export {
	AgentSession,
	type AgentSessionConfig,
	type AgentSessionEvent,
	type AgentSessionEventListener,
	type ModelCycleResult,
	type PromptOptions,
	type SessionStats,
} from "./agent-session.js";

export {
	AgentSessionRuntime,
	type CreateAgentSessionRuntimeFactory,
	type CreateAgentSessionRuntimeResult,
	createAgentSessionRuntime,
} from "./agent-session-runtime.js";

export {
	type AgentSessionRuntimeDiagnostic,
	type AgentSessionServices,
	type CreateAgentSessionFromServicesOptions,
	type CreateAgentSessionServicesOptions,
	createAgentSessionFromServices,
	createAgentSessionServices,
} from "./agent-session-services.js";

export { type BashExecutorOptions, type BashResult, executeBash, executeBashWithOperations } from "./bash-executor.js"; // will be replaced by barrel import

// ... other existing exports that need path updates (will be replaced by barrel imports)

// NEW: export from subdirectories
export * from "./session/index.js";
export * from "./config/index.js";
export * from "./cli-tools/index.js";
export * from "./models/index.js";
export * from "./infra/index.js";
export * from "./ux/index.js";
export * from "./extensions/index.js";
export * from "./compaction/index.js";
export * from "./export-html/index.js";
```

**Note**: We'll fix the import paths in next phase. Initially keep the old explicit exports broken; we'll update them systematically.

### Phase 6: Update Import Paths in All Source Files
Run automated find/replace for internal imports. For each file that imports from core:

**Search patterns**:
- `from "./agent-session"` → unchanged (still at root? no, moved to session/)
- `from "./settings-manager"` → `from "./config/settings-manager"`
- `from "./bash-executor"` → `from "./cli-tools/bash-executor"`
- etc.

**Better approach**: Use `sed` or a script to update paths systematically.

Example for each moved file category:

| Old Path | New Path |
|----------|----------|
| `./agent-session` | `./session/agent-session` |
| `./agent-session-services` | `./session/agent-session-services` |
| `./session-manager` | `./session/session-manager` |
| `./session-cwd` | `./session/session-cwd` |
| `./settings-manager` | `./config/settings-manager` |
| `./defaults` | `./config/defaults` |
| `./resolve-config-value` | `./config/resolve-config-value` |
| `./bash-executor` | `./cli-tools/bash-executor` |
| `./command-history` | `./cli-tools/command-history` |
| `./exec` | `./cli-tools/exec` |
| `./auth-storage` | `./cli-tools/auth-storage` |
| `./keybindings` | `./cli-tools/keybindings` |
| `./slash-commands` | `./cli-tools/slash-commands` |
| `./model-registry` | `./models/model-registry` |
| `./model-resolver` | `./models/model-resolver` |
| `./resource-loader` | `./models/resource-loader` |
| `./event-bus` | `./infra/event-bus` |
| `./timings` | `./infra/timings` |
| `./diagnostics` | `./infra/diagnostics` |
| `./output-guard` | `./infra/output-guard` |
| `./sdk` | `./infra/sdk` |
| `./package-manager` | `./infra/package-manager` |
| `./prompt-templates` | `./ux/prompt-templates` |
| `./system-prompt` | `./ux/system-prompt` |
| `./messages` | `./ux/messages` |
| `./footer-data-provider` | `./ux/footer-data-provider` |
| `./skills` | `./ux/skills` |
| `./source-info` | `./ux/source-info` |

**Important**: These are relative imports within `src/core/`. For example, in `agent-session-runtime.ts`:
```typescript
// Before:
import type { AgentSession } from "./agent-session.js";
// After:
import type { AgentSession } from "./session/agent-session.js";
```

**Script idea**: Create a Node script to update all `.ts` files in `src/core/`:
```javascript
// scripts/fix-imports.js
const fs = require('fs');
const path = require('path');

const replacements = [
  { from: /from "\.\/agent-session"/g, to: 'from "./session/agent-session"' },
  // ... all other mappings
];

// Walk through all .ts files in src/core and apply replacements
```

### Phase 7: Update External Imports (in other packages)
Check other packages in the monorepo that import from `@quangtynu/pi-coding-agent/src/core/*`:
- Search in `packages/*/src/` for imports from `"../coding-agent/src/core/"`
- Update paths accordingly

### Phase 8: Verify TypeScript Compilation
```bash
# Clean build
npm run clean
# Type check only (no emit)
npx tsc --noEmit
# Fix any errors
```

### Phase 9: Run Tests
```bash
npm test
```
Fix any failing tests.

### Phase 10: Build and Verify
```bash
npm run build
```
Check dist output structure.

### Phase 11: Manual Smoke Test
Run the CLI:
```bash
node dist/cli.js --help
# Try basic operations if possible
```

### Phase 12: Final Commit
```bash
git add -A
git commit -m "feat(core): reorganize directory structure into domains"
```

---

## Risk Mitigation

- **Breaking changes**: This is a major internal refactor. No public API change if `core/index.ts` barrel exports remain compatible.
- **Test coverage**: Ensure tests cover imports and integration points.
- **Rollback**: Keep the branch; can revert if issues found.

---

## Checklist Before Merge

- [ ] All tests passing
- [ ] TypeScript compilation clean (`--noEmit`)
- [ ] Build successful (`npm run build`)
- [ ] Barrel exports in `core/index.ts` correct
- [ ] No leftover moved files in root (only `index.ts` and `agent-session-runtime.ts`)
- [ ] All internal imports updated
- [ ] Documentation (if any) updated
- [ ] No circular dependencies introduced

---

## Notes

- **Do not rename files**, only move them.
- **Keep `.js` extensions** in imports (ESM).
- **Barrel exports** in each new folder must be comprehensive.
- **Cross-dependency check**: Ensure no new circular dependencies between `session/`, `config/`, `models/`, etc.
- **Largest files**: `agent-session.ts` (102K) stays; if needed, can be split later but out of scope.

---

## Post-Migration Cleanup (Optional)

- Consider splitting `agent-session.ts` into smaller modules within `session/` (future task).
- Extract `package-manager.ts` from `infra/` into its own domain if it grows.
- Review `ux/` for further splitting (prompts vs context vs skills).
