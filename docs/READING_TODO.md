# Full Project Reading Todo List

## Project Overview
- **Total code files**: ~579 TypeScript files (excluding node_modules, dist, binaries)
- **Packages**: agent (6), ai (43), coding-agent (280+), mom (13), pods (8), tui (42), web-ui (70)
- **Additional**: omp-legacy, pi-mono-legacy (legacy codebases)

---

## Reading Progress (2026-04-09)

- **Total Tasks**: ~200
- **Completed**: 70+
- **In Progress**: 0
- **Not Started**: ~130

---

## Completed Tasks (60+ files read)

### Phase 1: Core Architecture Files ✅
- [x] Root config files (package.json, tsconfig, biome, AGENTS.md, SYSTEM.md)
- [x] Documentation files (README, SYSTEM0/1, THEORY)

### Phase 2: Package agent ✅
- [x] index.ts, agent.ts, agent-loop.ts, types.ts, proxy.ts
- [x] Test files

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

## Remaining Tasks (To Be Read)

### Phase A: packages/ai - Remaining Providers (8 files)
- [x] packages/ai/src/providers/openai-completions.ts
- [x] packages/ai/src/providers/google-vertex.ts
- [ ] packages/ai/src/providers/mistral.ts
- [ ] packages/ai/src/providers/amazon-bedrock.ts
- [ ] packages/ai/src/providers/bedrock-provider.ts
- [ ] packages/ai/src/providers/azure-openai-responses.ts
- [ ] packages/ai/src/providers/faux.ts
- [ ] packages/ai/src/providers/github-copilot-headers.ts
- [ ] packages/ai/src/providers/transform-messages.ts
- [ ] packages/ai/src/providers/register-builtins.ts
- [ ] packages/ai/src/providers/simple-options.ts

### Phase B: packages/ai - Utils (9 files)
- [x] packages/ai/src/utils/validation.ts
- [ ] packages/ai/src/utils/oauth-page.ts
- [ ] packages/ai/src/utils/pkce.ts
- [ ] packages/ai/src/utils/oauth/github-copilot.ts
- [ ] packages/ai/src/utils/oauth/anthropic.ts
- [ ] packages/ai/src/utils/oauth/google-gemini-cli.ts
- [ ] packages/ai/src/utils/oauth/google-antigravity.ts
- [ ] packages/ai/src/utils/oauth/openai-codex.ts
- [ ] packages/ai/src/utils/oauth/types.ts
- [ ] packages/ai/src/utils/event-stream.ts
- [ ] packages/ai/src/utils/hash.ts
- [ ] packages/ai/src/utils/json-parse.ts
- [ ] packages/ai/src/utils/overflow.ts
- [ ] packages/ai/src/utils/sanitize-unicode.ts
- [ ] packages/ai/src/utils/typebox-helpers.ts
- [ ] packages/ai/src/env-api-keys.ts
- [ ] packages/ai/src/oauth.ts

### Phase H: packages/coding-agent - Core (50 files)
- [x] packages/coding-agent/src/core/agent-session.ts (partial read)
- [ ] packages/coding-agent/src/core/agent-session-runtime.ts
- [ ] packages/coding-agent/src/core/agent-session-services.ts
- [ ] packages/coding-agent/src/core/auth-storage.ts
- [ ] packages/coding-agent/src/core/bash-executor.ts
- [ ] packages/coding-agent/src/core/command-history.ts
- [ ] packages/coding-agent/src/core/compaction/branch-summarization.ts
- [ ] packages/coding-agent/src/core/compaction/compaction.ts
- [ ] packages/coding-agent/src/core/compaction/utils.ts
- [ ] packages/coding-agent/src/core/defaults.ts
- [ ] packages/coding-agent/src/core/diagnostics.ts
- [ ] packages/coding-agent/src/core/event-bus.ts
- [ ] packages/coding-agent/src/core/exec.ts
- [ ] packages/coding-agent/src/core/export-html/ansi-to-html.ts
- [ ] packages/coding-agent/src/core/export-html/tool-renderer.ts
- [ ] packages/coding-agent/src/core/extensions/loader.ts
- [ ] packages/coding-agent/src/core/extensions/runner.ts
- [ ] packages/coding-agent/src/core/extensions/types.ts
- [ ] packages/coding-agent/src/core/extensions/wrapper.ts
- [ ] packages/coding-agent/src/core/footer-data-provider.ts
- [ ] packages/coding-agent/src/core/keybindings.ts
- [ ] packages/coding-agent/src/core/messages.ts
- [ ] packages/coding-agent/src/core/model-registry.ts
- [ ] packages/coding-agent/src/core/model-resolver.ts
- [ ] packages/coding-agent/src/core/output-guard.ts
- [ ] packages/coding-agent/src/core/package-manager.ts
- [ ] packages/coding-agent/src/core/prompt-templates.ts
- [ ] packages/coding-agent/src/core/resolve-config-value.ts
- [ ] packages/coding-agent/src/core/resource-loader.ts
- [ ] packages/coding-agent/src/core/sdk.ts
- [ ] packages/coding-agent/src/core/session-cwd.ts
- [ ] packages/coding-agent/src/core/settings-manager.ts
- [ ] packages/coding-agent/src/core/slash-commands.ts
- [ ] packages/coding-agent/src/core/source-info.ts
- [ ] packages/coding-agent/src/core/system-prompt.ts
- [ ] packages/coding-agent/src/core/timings.ts
- [ ] packages/coding-agent/src/core/tools/edit-diff.ts
- [ ] packages/coding-agent/src/core/tools/file-mutation-queue.ts
- [ ] packages/coding-agent/src/core/tools/path-utils.ts
- [ ] packages/coding-agent/src/core/tools/render-utils.ts
- [ ] packages/coding-agent/src/core/tools/tool-definition-wrapper.ts
- [ ] packages/coding-agent/src/core/tools/truncate.ts

### Phase D: packages/coding-agent - CLI (6 files)
- [ ] packages/coding-agent/src/cli.ts
- [ ] packages/coding-agent/src/cli/config-selector.ts
- [ ] packages/coding-agent/src/cli/file-processor.ts
- [ ] packages/coding-agent/src/cli/initial-message.ts
- [ ] packages/coding-agent/src/cli/list-models.ts

### Phase E: packages/coding-agent - Modes (8 files)
- [ ] packages/coding-agent/src/modes/interactive/components/armin.ts
- [ ] packages/coding-agent/src/modes/interactive/components/assistant-message.ts
- [ ] packages/coding-agent/src/modes/interactive/components/bash-execution.ts
- [ ] packages/coding-agent/src/modes/interactive/components/branch-summary-message.ts
- [ ] packages/coding-agent/src/modes/interactive/components/compaction-summary-message.ts
- [ ] packages/coding-agent/src/modes/interactive/components/config-selector.ts
- [ ] packages/coding-agent/src/modes/interactive/components/countdown-timer.ts
- [ ] packages/coding-agent/src/modes/interactive/components/custom-editor.ts
- [ ] packages/coding-agent/src/modes/interactive/components/custom-message.ts
- [ ] packages/coding-agent/src/modes/interactive/components/diff.ts
- [ ] packages/coding-agent/src/modes/interactive/components/dynamic-border.ts
- [ ] packages/coding-agent/src/modes/interactive/components/extension-editor.ts
- [ ] packages/coding-agent/src/modes/interactive/components/extension-input.ts
- [ ] packages/coding-agent/src/modes/interactive/components/extension-selector.ts
- [ ] packages/coding-agent/src/modes/interactive/components/footer.ts
- [ ] packages/coding-agent/src/modes/interactive/components/keybinding-hints.ts
- [ ] packages/coding-agent/src/modes/interactive/components/login-dialog.ts
- [ ] packages/coding-agent/src/modes/interactive/components/model-selector.ts
- [ ] packages/coding-agent/src/modes/interactive/components/oauth-selector.ts
- [ ] packages/coding-agent/src/modes/interactive/components/scoped-models-selector.ts
- [ ] packages/coding-agent/src/modes/interactive/components/session-selector-search.ts
- [ ] packages/coding-agent/src/modes/interactive/components/session-selector.ts
- [ ] packages/coding-agent/src/modes/interactive/components/settings-selector.ts
- [ ] packages/coding-agent/src/modes/interactive/components/show-images-selector.ts
- [ ] packages/coding-agent/src/modes/interactive/components/skill-invocation-message.ts
- [ ] packages/coding-agent/src/modes/interactive/components/theme-selector.ts
- [ ] packages/coding-agent/src/modes/interactive/components/thinking-selector.ts
- [ ] packages/coding-agent/src/modes/interactive/components/tool-execution.ts
- [ ] packages/coding-agent/src/modes/interactive/components/tree-selector.ts
- [ ] packages/coding-agent/src/modes/interactive/components/user-message-selector.ts
- [ ] packages/coding-agent/src/modes/interactive/components/user-message.ts
- [ ] packages/coding-agent/src/modes/interactive/components/visual-truncate.ts
- [ ] packages/coding-agent/src/modes/interactive/theme/theme.ts
- [ ] packages/coding-agent/src/modes/rpc/jsonl.ts
- [ ] packages/coding-agent/src/modes/rpc/rpc-types.ts

### Phase F: packages/coding-agent - Utils (18 files)
- [ ] packages/coding-agent/src/utils/changelog.ts
- [ ] packages/coding-agent/src/utils/child-process.ts
- [ ] packages/coding-agent/src/utils/clipboard-image.ts
- [ ] packages/coding-agent/src/utils/clipboard-native.ts
- [ ] packages/coding-agent/src/utils/clipboard.ts
- [ ] packages/coding-agent/src/utils/exif-orientation.ts
- [ ] packages/coding-agent/src/utils/frontmatter.ts
- [ ] packages/coding-agent/src/utils/git.ts
- [ ] packages/coding-agent/src/utils/image-convert.ts
- [ ] packages/coding-agent/src/utils/image-resize.ts
- [ ] packages/coding-agent/src/utils/mime.ts
- [ ] packages/coding-agent/src/utils/paths.ts
- [ ] packages/coding-agent/src/utils/photon.ts
- [ ] packages/coding-agent/src/utils/shell.ts
- [ ] packages/coding-agent/src/utils/sleep.ts
- [ ] packages/coding-agent/src/utils/tools-manager.ts

### Phase G: packages/coding-agent - Bun (2 files)
- [ ] packages/coding-agent/src/bun/cli.ts
- [ ] packages/coding-agent/src/bun/register-bedrock.ts

### Phase H: packages/coding-agent - Root files (3 files)
- [ ] packages/coding-agent/src/migrations.ts
- [ ] packages/coding-agent/src/package-manager-cli.ts

### Phase J: packages/tui - Remaining (22 files)
- [x] packages/tui/src/terminal.ts (partial read)
- [ ] packages/tui/src/autocomplete.ts
- [ ] packages/tui/src/editor-component.ts
- [ ] packages/tui/src/fuzzy.ts
- [ ] packages/tui/src/keybindings.ts
- [ ] packages/tui/src/keys.ts
- [ ] packages/tui/src/kill-ring.ts
- [ ] packages/tui/src/stdin-buffer.ts
- [ ] packages/tui/src/terminal-image.ts
- [ ] packages/tui/src/undo-stack.ts
- [ ] packages/tui/src/utils.ts
- [ ] packages/tui/src/components/box.ts
- [ ] packages/tui/src/components/cancellable-loader.ts
- [ ] packages/tui/src/components/editor.ts
- [ ] packages/tui/src/components/image.ts
- [ ] packages/tui/src/components/loader.ts
- [ ] packages/tui/src/components/markdown.ts
- [ ] packages/tui/src/components/select-list.ts
- [ ] packages/tui/src/components/settings-list.ts
- [ ] packages/tui/src/components/spacer.ts
- [ ] packages/tui/src/components/text.ts
- [ ] packages/tui/src/components/truncated-text.ts

### Phase K: packages/mom - Remaining (7 files)
- [x] packages/mom/src/slack.ts (partial read)
- [ ] packages/mom/src/context.ts
- [ ] packages/mom/src/download.ts
- [ ] packages/mom/src/events.ts
- [ ] packages/mom/src/log.ts
- [ ] packages/mom/src/sandbox.ts
- [ ] packages/mom/src/store.ts
- [ ] packages/mom/src/tools/attach.ts
- [ ] packages/mom/src/tools/bash.ts
- [ ] packages/mom/src/tools/edit.ts
- [ ] packages/mom/src/tools/read.ts
- [ ] packages/mom/src/tools/truncate.ts
- [ ] packages/mom/src/tools/write.ts

### Phase L: packages/pods - Remaining (3 files)
- [x] packages/pods/src/index.ts
- [ ] packages/pods/src/types.ts
- [ ] packages/pods/src/ssh.ts
- [ ] packages/pods/src/commands/pods.ts
- [ ] packages/pods/src/commands/prompt.ts

### Phase M: packages/web-ui - Remaining (35 files)
- [x] packages/web-ui/src/ChatPanel.ts (partial read)
- [ ] packages/web-ui/src/components/AgentInterface.ts
- [ ] packages/web-ui/src/components/AttachmentTile.ts
- [ ] packages/web-ui/src/components/ConsoleBlock.ts
- [ ] packages/web-ui/src/components/CustomProviderCard.ts
- [ ] packages/web-ui/src/components/ExpandableSection.ts
- [ ] packages/web-ui/src/components/Input.ts
- [ ] packages/web-ui/src/components/MessageEditor.ts
- [ ] packages/web-ui/src/components/MessageList.ts
- [ ] packages/web-ui/src/components/Messages.ts
- [ ] packages/web-ui/src/components/ProviderKeyInput.ts
- [ ] packages/web-ui/src/components/StreamingMessageContainer.ts
- [ ] packages/web-ui/src/components/ThinkingBlock.ts
- [ ] packages/web-ui/src/components/message-renderer-registry.ts
- [ ] packages/web-ui/src/components/sandbox/ArtifactsRuntimeProvider.ts
- [ ] packages/web-ui/src/components/sandbox/AttachmentsRuntimeProvider.ts
- [ ] packages/web-ui/src/components/sandbox/ConsoleRuntimeProvider.ts
- [ ] packages/web-ui/src/components/sandbox/FileDownloadRuntimeProvider.ts
- [ ] packages/web-ui/src/components/sandbox/RuntimeMessageBridge.ts
- [ ] packages/web-ui/src/components/sandbox/RuntimeMessageRouter.ts
- [ ] packages/web-ui/src/components/sandbox/SandboxRuntimeProvider.ts
- [ ] packages/web-ui/src/components/sandbox/SandboxedIframe.ts
- [ ] packages/web-ui/src/dialogs/ApiKeyPromptDialog.ts
- [ ] packages/web-ui/src/dialogs/AttachmentOverlay.ts
- [ ] packages/web-ui/src/dialogs/CustomProviderDialog.ts
- [ ] packages/web-ui/src/dialogs/ModelSelector.ts
- [ ] packages/web-ui/src/dialogs/PersistentStorageDialog.ts
- [ ] packages/web-ui/src/dialogs/ProvidersModelsTab.ts
- [ ] packages/web-ui/src/dialogs/SessionListDialog.ts
- [ ] packages/web-ui/src/dialogs/SettingsDialog.ts
- [ ] packages/web-ui/src/prompts/prompts.ts
- [ ] packages/web-ui/src/utils/attachment-utils.ts
- [ ] packages/web-ui/src/utils/auth-token.ts
- [ ] packages/web-ui/src/utils/format.ts
- [ ] packages/web-ui/src/utils/i18n.ts
- [ ] packages/web-ui/src/utils/model-discovery.ts
- [ ] packages/web-ui/src/utils/proxy-utils.ts
- [ ] packages/web-ui/src/utils/test-sessions.ts
- [ ] packages/web-ui/src/tools/extract-document.ts
- [ ] packages/web-ui/src/tools/javascript-repl.ts
- [ ] packages/web-ui/src/tools/renderer-registry.ts
- [ ] packages/web-ui/src/tools/renderers/BashRenderer.ts
- [ ] packages/web-ui/src/tools/renderers/CalculateRenderer.ts
- [ ] packages/web-ui/src/tools/renderers/DefaultRenderer.ts
- [ ] packages/web-ui/src/tools/renderers/GetCurrentTimeRenderer.ts
- [ ] packages/web-ui/src/tools/types.ts
- [ ] packages/web-ui/src/tools/artifacts/ArtifactElement.ts
- [ ] packages/web-ui/src/tools/artifacts/ArtifactPill.ts
- [ ] packages/web-ui/src/tools/artifacts/artifacts-tool-renderer.ts
- [ ] packages/web-ui/src/tools/artifacts/artifacts.ts
- [ ] packages/web-ui/src/tools/artifacts/Console.ts
- [ ] packages/web-ui/src/tools/artifacts/DocxArtifact.ts
- [ ] packages/web-ui/src/tools/artifacts/ExcelArtifact.ts
- [ ] packages/web-ui/src/tools/artifacts/GenericArtifact.ts
- [ ] packages/web-ui/src/tools/artifacts/HtmlArtifact.ts
- [ ] packages/web-ui/src/tools/artifacts/ImageArtifact.ts
- [ ] packages/web-ui/src/tools/artifacts/MarkdownArtifact.ts
- [ ] packages/web-ui/src/tools/artifacts/PdfArtifact.ts
- [ ] packages/web-ui/src/tools/artifacts/SvgArtifact.ts
- [ ] packages/web-ui/src/tools/artifacts/TextArtifact.ts
- [ ] packages/web-ui/src/storage/app-storage.ts
- [ ] packages/web-ui/src/storage/backends/indexeddb-storage-backend.ts
- [ ] packages/web-ui/src/storage/stores/custom-providers-store.ts
- [ ] packages/web-ui/src/storage/stores/provider-keys-store.ts
- [ ] packages/web-ui/src/storage/stores/sessions-store.ts
- [ ] packages/web-ui/src/storage/stores/settings-store.ts
- [ ] packages/web-ui/src/storage/store.ts
- [ ] packages/web-ui/src/storage/types.ts

---

## Key Architecture Discoveries (from previous scan)

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

## Notes

- This is a reading task only - no code changes
- Each file will be read and understood for architecture documentation
- Progress will be updated as files are read
- Focus on understanding the overall architecture and key patterns