# Full Project Reading Todo List

## Project Overview
- Total code files: 583 TypeScript/TSX files
- Packages: agent, ai, coding-agent, mom, pods, tui, web-ui
- Additional: omp-legacy (legacy codebase)

---

## Phase 1: Core Architecture Files (Priority: HIGH)

### Task 1.1: Read Root Configuration Files
- [x] 1.1.1 Read `/home/quangtynu/Qcoder/autoresearch/package.json` - Root package.json
- [x] 1.1.2 Read `/home/quangtynu/Qcoder/autoresearch/tsconfig.base.json` - Base TypeScript config
- [x] 1.1.3 Read `/home/quangtynu/Qcoder/autoresearch/biome.json` - Biome linting config
- [x] 1.1.4 Read `/home/quangtynu/Qcoder/autoresearch/AGENTS.md` - Agent guidelines
- [x] 1.1.5 Read `/home/quangtynu/Qcoder/autoresearch/SYSTEM.md` - System configuration

### Task 1.2: Read Documentation Files
- [x] 1.2.1 Read `/home/quangtynu/Qcoder/autoresearch/README.md` - Main readme
- [x] 1.2.2 Read `/home/quangtynu/Qcoder/autoresearch/SYSTEM0.md`
- [x] 1.2.3 Read `/home/quangtynu/Qcoder/autoresearch/SYSTEM1.md`
- [x] 1.2.4 Read `/home/quangtynu/Qcoder/autoresearch/THEORY.md`

---

## Phase 2: Package ai (Priority: HIGH)
**Path**: `/home/quangtynu/Qcoder/autoresearch/packages/ai/src`

### Task 2.1: Read ai package - Core
- [x] 2.1.1 Read `packages/ai/src/index.ts` - Main entry point
- [x] 2.1.2 Read `packages/ai/src/types.ts` - Type definitions
- [x] 2.1.3 Read `packages/ai/src/models.ts` - Model configurations
- [ ] 2.1.4 Read `packages/ai/src/cli.ts` - CLI interface

### Task 2.2: Read ai package - Providers
- [x] 2.2.1 Read `packages/ai/src/providers/anthropic.ts` - Anthropic provider
- [ ] 2.2.2 Read `packages/ai/src/providers/openai-responses.ts` - OpenAI responses
- [ ] 2.2.3 Read `packages/ai/src/providers/openai-completions.ts` - OpenAI completions
- [ ] 2.2.4 Read `packages/ai/src/providers/google.ts` - Google provider
- [ ] 2.2.5 Read `packages/ai/src/providers/google-vertex.ts` - Google Vertex
- [ ] 2.2.6 Read `packages/ai/src/providers/mistral.ts` - Mistral provider
- [ ] 2.2.7 Read `packages/ai/src/providers/amazon-bedrock.ts` - Amazon Bedrock
- [ ] 2.2.8 Read `packages/ai/src/providers/bedrock-provider.ts` - Bedrock base

### Task 2.3: Read ai package - OAuth Utils
- [ ] 2.3.1 Read `packages/ai/src/utils/oauth/index.ts`
- [ ] 2.3.2 Read `packages/ai/src/utils/oauth/oauth-page.ts`
- [ ] 2.3.3 Read `packages/ai/src/utils/oauth/pkce.ts`
- [ ] 2.3.4 Read `packages/ai/src/utils/oauth/github-copilot.ts`
- [ ] 2.3.5 Read `packages/ai/src/utils/oauth/anthropic.ts`
- [ ] 2.3.6 Read `packages/ai/src/utils/oauth/google-gemini-cli.ts`

### Task 2.4: Read ai package - Utilities
- [ ] 2.4.1 Read `packages/ai/src/stream.ts` - Stream handling
- [ ] 2.4.2 Read `packages/ai/src/api-registry.ts` - API registry
- [ ] 2.4.3 Read `packages/ai/src/utils/validation.ts` - Validation utilities

---

## Phase 3: Package agent (Priority: HIGH)
**Path**: `/home/quangtynu/Qcoder/autoresearch/packages/agent/src`

### Task 3.1: Read agent package
- [x] 3.1.1 Read `packages/agent/src/index.ts` - Entry point
- [x] 3.1.2 Read `packages/agent/src/agent.ts` - Agent implementation
- [ ] 3.1.3 Read `packages/agent/src/agent-loop.ts` - Agent loop
- [ ] 3.1.4 Read `packages/agent/src/types.ts` - Type definitions
- [ ] 3.1.5 Read `packages/agent/src/proxy.ts` - Proxy functionality

---

## Phase 4: Package coding-agent (Priority: HIGH)
**Path**: `/home/quangtynu/Qcoder/autoresearch/packages/coding-agent/src`

### Task 4.1: Read coding-agent - Main Entry
- [x] 4.1.1 Read `packages/coding-agent/src/index.ts` - Entry point
- [x] 4.1.2 Read `packages/coding-agent/src/main.ts` - Main logic (partial)
- [ ] 4.1.3 Read `packages/coding-agent/src/config.ts` - Configuration
- [ ] 4.1.4 Read `packages/coding-agent/src/migrations.ts` - Migrations

### Task 4.2: Read coding-agent - CLI
- [ ] 4.2.1 Read `packages/coding-agent/src/cli/args.ts` - CLI arguments
- [ ] 4.2.2 Read `packages/coding-agent/src/cli/session-picker.ts` - Session picker
- [ ] 4.2.3 Read `packages/coding-agent/src/cli/list-models.ts` - Model listing
- [ ] 4.2.4 Read `packages/coding-agent/src/cli/config-selector.ts` - Config selector

### Task 4.3: Read coding-agent - Core
- [ ] 4.3.1 Read `packages/coding-agent/src/core/core.ts` - Core module
- [ ] 4.3.2 Read `packages/coding-agent/src/core/orchestrator.ts` - Orchestrator
- [ ] 4.3.3 Read `packages/coding-agent/src/core/provider.ts` - Provider interface

### Task 4.4: Read coding-agent - Modes
- [x] 4.4.1 Read `packages/coding-agent/src/modes/interactive/interactive-mode.ts` - Interactive mode
- [x] 4.4.2 Read `packages/coding-agent/src/modes/rpc/rpc-mode.ts` - RPC mode
- [x] 4.4.3 Read `packages/coding-agent/src/modes/rpc/rpc-client.ts` - RPC client
- [x] 4.4.4 Read `packages/coding-agent/src/modes/print-mode.ts` - Print mode

### Task 4.5: Read coding-agent - Interactive Components
- [ ] 4.5.1 Read `packages/coding-agent/src/modes/interactive/components/index.ts` - Component index
- [ ] 4.5.2 Read `packages/coding-agent/src/modes/interactive/components/assistant-message.ts` - Assistant message
- [ ] 4.5.3 Read `packages/coding-agent/src/modes/interactive/components/user-message.ts` - User message
- [ ] 4.5.4 Read `packages/coding-agent/src/modes/interactive/components/tool-execution.ts` - Tool execution
- [ ] 4.5.5 Read `packages/coding-agent/src/modes/interactive/components/bash-execution.ts` - Bash execution

### Task 4.6: Read coding-agent - Tools
- [x] 4.6.1 Read `packages/coding-agent/src/tools/index.ts` - Tools index
- [x] 4.6.2 Read `packages/coding-agent/src/tools/todo-write.ts` - Todo write tool

---

## Phase 5: Package tui (Priority: MEDIUM)
**Path**: `/home/quangtynu/Qcoder/autoresearch/packages/tui/src`

### Task 5.1: Read tui package - Core
- [x] 5.1.1 Read `packages/tui/src/index.ts` - Entry point
- [ ] 5.1.2 Read `packages/tui/src/tui.ts` - Main TUI
- [ ] 5.1.3 Read `packages/tui/src/terminal.ts` - Terminal handling
- [ ] 5.1.4 Read `packages/tui/src/editor-component.ts` - Editor component

### Task 5.2: Read tui package - Components
- [ ] 5.2.1 Read `packages/tui/src/components/editor.ts` - Editor component
- [ ] 5.2.2 Read `packages/tui/src/components/input.ts` - Input component
- [ ] 5.2.3 Read `packages/tui/src/components/select-list.ts` - Select list

---

## Phase 6: Package mom (Priority: MEDIUM)
**Path**: `/home/quangtynu/Qcoder/autoresearch/packages/mom/src`

### Task 6.1: Read mom package
- [x] 6.1.1 Read `packages/mom/src/main.ts` - Main entry (Slack bot)
- [ ] 6.1.2 Read `packages/mom/src/agent.ts` - Mom agent
- [ ] 6.1.3 Read `packages/mom/src/sandbox.ts` - Sandbox
- [ ] 6.1.4 Read `packages/mom/src/store.ts` - Store

### Task 6.2: Read mom package - Tools
- [ ] 6.2.1 Read `packages/mom/src/tools/index.ts` - Tools index
- [ ] 6.2.2 Read `packages/mom/src/tools/bash.ts` - Bash tool
- [ ] 6.2.3 Read `packages/mom/src/tools/read.ts` - Read tool
- [ ] 6.2.4 Read `packages/mom/src/tools/write.ts` - Write tool

---

## Phase 7: Package pods (Priority: MEDIUM)
**Path**: `/home/quangtynu/Qcoder/autoresearch/packages/pods/src`

### Task 7.1: Read pods package
- [ ] 7.1.1 Read `packages/pods/src/index.ts` - Entry point
- [x] 7.1.2 Read `packages/pods/src/cli.ts` - CLI (pod & model management)
- [ ] 7.1.3 Read `packages/pods/src/commands/pods.ts` - Pods command
- [ ] 7.1.4 Read `packages/pods/src/commands/models.ts` - Models command

---

## Phase 8: Package web-ui (Priority: MEDIUM)
**Path**: `/home/quangtynu/Qcoder/autoresearch/packages/web-ui/src`

### Task 8.1: Read web-ui package - Core
- [ ] 8.1.1 Read `packages/web-ui/src/index.ts` - Entry point
- [ ] 8.1.2 Read `packages/web-ui/src/ChatPanel.ts` - Chat panel

### Task 8.2: Read web-ui package - Tools
- [ ] 8.2.1 Read `packages/web-ui/src/tools/index.ts` - Tools index
- [ ] 8.2.2 Read `packages/web-ui/src/tools/renderer-registry.ts` - Renderer registry

### Task 8.3: Read web-ui package - Artifacts
- [ ] 8.3.1 Read `packages/web-ui/src/tools/artifacts/artifacts.ts` - Artifacts
- [ ] 8.3.2 Read `packages/web-ui/src/tools/artifacts/MarkdownArtifact.ts`
- [ ] 8.3.3 Read `packages/web-ui/src/tools/artifacts/HtmlArtifact.ts`

### Task 8.4: Read web-ui package - Storage
- [ ] 8.4.1 Read `packages/web-ui/src/storage/app-storage.ts` - App storage
- [ ] 8.4.2 Read `packages/web-ui/src/storage/store.ts` - Store
- [ ] 8.4.3 Read `packages/web-ui/src/storage/stores/sessions-store.ts` - Sessions store

---

## Phase 9: Docs Files (Priority: MEDIUM)

### Task 9.1: Read docs files
- [x] 9.1.1 Read `docs/PROJECT_STATE.md` - Project state (full)
- [ ] 9.1.2 Read `docs/AGENT_PROFILE.md` - Agent profile
- [ ] 9.1.3 Read `docs/AGENT_METRICS.md` - Agent metrics
- [ ] 9.1.4 Read `docs/MEMORY.md` - Memory entries
- [ ] 9.1.5 Read `docs/EVOLUTION.md` - Evolution roadmap
- [ ] 9.1.6 Read `docs/EXTENSION_GUIDE.md` - Extension guide

---

## Reading Progress

- **Total Tasks**: ~90
- **Completed**: 15
- **In Progress**: 0
- **Not Started**: 75

---

## Notes
- Each task involves reading the file and documenting key findings
- Issues found should be noted for docs/TODO.md update
- Start from Phase 1 and work through sequentially

---

## Reading Summary (Completed 2026-04-08)

### Project Overview Discovered:
- **Total**: 583 TypeScript/TSX files across 7 packages
- **Packages**: ai, agent, coding-agent, mom, pods, tui, web-ui + omp-legacy
- **Version**: 0.0.3 (all packages locked)
- **Node.js**: >=20.0.0

### Architecture Highlights:
1. **ai package**: Unified LLM API with 20+ providers (Anthropic, OpenAI, Google, Mistral, etc.)
2. **agent package**: Agent framework wrapping pi-ai, supports steering/follow-up queues
3. **coding-agent**: Full CLI with session management, tools, extension system, skills
4. **tui package**: Terminal UI components (Editor, Input, SelectList, etc.)
5. **mom package**: Slack bot for message-oriented middleware
6. **pods package**: vLLM deployment management on GPU pods
7. **web-ui package**: Web-based UI with artifact rendering

### Key Features Identified:
- Extension system with lifecycle events (before/after agent start, tool calls, etc.)
- Skills system for custom prompts
- Session compaction for conversation summarization
- OAuth support for multiple providers
- Tool definitions: bash, read, write, edit, grep, find, ls
- Theme system for TUI customization

### Legacy Code:
- `omp-legacy/` contains old Rust/TypeScript code not used in main packages