# Full Project Reading Todo List

## Project Overview
- **Total code files**: 299 TypeScript/TSX files (excluding node_modules, dist, binaries)
- **Packages**: agent (5), ai (43), coding-agent (130), mom (16), pods (9), tui (25), web-ui (71)
- **Additional**: omp-legacy, pi-mono-legacy (legacy codebases)

---

## Reading Progress (2026-04-09)

- **Total Tasks**: ~150
- **Completed**: 60+
- **In Progress**: 0
- **Not Started**: ~90

---

## Completed Tasks (60+ files read)

### Phase 1: Core Architecture Files ✅
- [x] Root config files (package.json, tsconfig, biome, AGENTS.md, SYSTEM.md)
- [x] Documentation files (README, SYSTEM0/1, THEORY)

### Phase 2: Package agent ✅
- [x] index.ts, agent.ts, agent-loop.ts, types.ts, proxy.ts

### Phase 3: Package ai ✅
- [x] Core: index.ts, types.ts, models.ts, cli.ts, stream.ts, api-registry.ts
- [x] Providers: anthropic.ts, openai-responses.ts, google.ts
- [x] OAuth: utils/oauth/index.ts

### Phase 4: Package coding-agent ✅
- [x] Main: index.ts, main.ts, config.ts
- [x] CLI: args.ts (full parsing), session-picker.ts
- [x] Core: index.ts, agent-session.ts (102KB), session-manager.ts, extensions/index.ts, skills.ts
- [x] Tools (core/tools/): bash.ts, read.ts, write.ts, edit.ts, grep.ts, find.ts, ls.ts, todo-write.ts
- [x] Modes: interactive-mode.ts, rpc-mode.ts, rpc-client.ts, print-mode.ts
- [x] Components: index.ts (30+ components)

### Phase 5: Package tui ✅
- [x] Core: tui.ts (differential rendering, 900+ lines)
- [x] Components: input.ts (Emacs-style editing)

### Phase 6: Package mom ✅
- [x] Main: main.ts (Slack bot entry)
- [x] Agent: agent.ts (full Mom agent implementation)

### Phase 7: Package pods ✅
- [x] CLI: cli.ts (pod & model management)
- [x] Commands: models.ts (start/stop/list models, GPU allocation)

### Phase 8: Package web-ui ✅
- [x] Index: full exports

---

## Key Architecture Discoveries

### packages/ai - Unified LLM API
- **Stream-based API**: Event emitters cho streaming responses
- **20+ Providers**: Anthropic, OpenAI (Responses + Completions), Google, Mistral, Bedrock, etc.
- **OAuth Support**: 5 providers (Anthropic, GitHub Copilot, Google Gemini CLI, Antigravity, OpenAI Codex)
- **Model Registry**: Auto-discovery với model capabilities tracking
- **Cost Tracking**: Built-in token và cost calculation

### packages/coding-agent - Full CLI với Interactive Mode
- **AgentSession**: Core class (102KB), shared across all modes (interactive, print, rpc)
- **Session Storage**: JSONL format với version tracking (v3), tree structure (parent/child sessions)
- **Tools System** (trong `core/tools/`):
  - **bash**: Pluggable operations (local/SSH), process spawning, truncation
  - **read**: Text + image support, offset/limit, auto-resize images, syntax highlighting
  - **write**: Create/overwrite files, auto-create directories, syntax highlighting
  - **edit**: Exact text replacement, unified diff output, non-overlapping edits
  - **grep**: ripgrep integration, JSON output, match limits, context lines
  - **find**: fd integration, glob patterns, .gitignore respect
  - **ls**: Directory listing with file type detection
  - **todo-write**: Todo management tool
- **Extension System**: 50+ lifecycle events (before/after agent start, tool calls, etc.)
- **Skills System**: Custom prompts loaded from directories, frontmatter parsing
- **TUI Components**: 30+ components (AssistantMessage, UserMessage, ToolExecution, etc.)
- **CLI**: Full argument parsing (args.ts - 300+ lines), session management, model cycling (--models flag)

### packages/tui - Terminal UI
- **Differential Rendering**: Only re-render changed lines, performance optimized
- **Component Architecture**: Container, Text, Input, SelectList, Overlay, etc.
- **Input Handling**: Emacs-style (kill ring, undo stack), bracketed paste, Unicode/grapheme support
- **Overlay System**: Modal dialogs with positioning (anchor-based + percentage)
- **Hardware Cursor**: IME candidate window positioning

### packages/mom - Slack Bot (Message-Oriented Middleware)
- **Channel-based State**: Per-channel agent runners, cached
- **Sandbox Execution**: Docker or host-based execution
- **Event System**: Immediate, one-shot, periodic events (cron-based)
- **Memory**: Global + channel-specific MEMORY.md files
- **Skills**: Workspace-level + channel-specific skills
- **Tools**: bash, read, write, edit, attach (file sharing to Slack)
- **System Prompt**: Detailed Slack formatting (mrkdwn), channel/user IDs

### packages/pods - vLLM Deployment Management
- **SSH Integration**: Remote execution on GPU pods
- **Model Deployment**: Start/stop vLLM instances with custom scripts
- **GPU Allocation**: Round-robin selection, least-used-first
- **Port Management**: Auto-increment starting from 8001
- **Log Streaming**: Real-time log tailing with color support
- **Process Verification**: Check if processes are running, starting, or crashed

### packages/web-ui - Web Components
- **Chat Interface**: Full message rendering with attachments
- **Artifact System**: HTML, Markdown, Code, Image rendering
- **IndexedDB Storage**: Sessions, settings, custom providers
- **Sandbox Runtime**: Secure iframe execution
- **Provider Keys**: API key management with OAuth support

### packages/agent - Agent Framework
- **Agent Core**: Event-driven agent with state management
- **Tool Calling**: Built-in tool definitions and execution
- **Message Handling**: Convert to LLM format, streaming support

---

## Data Flow Summary

```
User Input (CLI/TUI/RPC)
    ↓
coding-agent/main.ts → parse args
    ↓
AgentSession (core)
    ├→ SessionManager (JSONL persistence)
    ├→ ModelRegistry (API keys, model discovery)
    ├→ SettingsManager (user preferences)
    ├→ ResourceLoader (skills, prompts, themes)
    ├→ ExtensionRunner (lifecycle events)
    └→ Tools (bash, read, write, edit, grep, find, ls, todo-write)
         ↓
    pi-agent (Agent class)
         ↓
    pi-ai (Stream API)
         ↓
    LLM Providers (Anthropic, OpenAI, Google, Mistral, Bedrock...)
```

---

## Remaining Tasks

- [ ] packages/ai: openai-completions.ts, google-vertex.ts, mistral.ts, amazon-bedrock.ts, bedrock-provider.ts
- [ ] packages/ai: utils/validation.ts, oauth-page.ts, pkce.ts, github-copilot.ts, anthropic.ts, google-gemini-cli.ts
- [ ] packages/coding-agent: migrations.ts, agent-session-runtime.ts, settings-manager.ts, model-registry.ts
- [ ] packages/coding-agent: context-manager.ts, session.ts
- [ ] packages/tui: terminal.ts, editor-component.ts, components/*
- [ ] packages/mom: sandbox.ts, store.ts, slack.ts, context.ts, events.ts, download.ts, tools/*
- [ ] packages/pods: index.ts, config.ts, types.ts, ssh.ts, commands/pods.ts
- [ ] packages/web-ui: ChatPanel.ts, components/*, storage/*, tools/*