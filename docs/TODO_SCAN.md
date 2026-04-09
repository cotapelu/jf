# TODO — Codebase Scan & Understanding

## Purpose
Scan and understand all code in the repository to build a complete mental model of the codebase.

## Scan Strategy
1. **Overview** → Architecture, README, package.json
2. **Core Packages** → ai, agent, coding-agent (main logic)
3. **Support Packages** → tui, mom, pods, web-ui
4. **Patterns & Conventions** → Common patterns across packages

---

## Completed Tasks

### Phase 1: Project Overview (DONE)
- [x] Read PROJECT_STATE.md
- [x] Read main TODO.md
- [x] List all packages structure

---

## Active Tasks

### Phase 2: Core Package - ai ✅ COMPLETED
**Package**: `packages/ai` - Unified LLM API

**Key Understanding**:
- **Purpose**: Unified API for 20+ LLM providers (OpenAI, Anthropic, Google, Azure, Bedrock, etc.)
- **Core API**: `stream()`, `complete()`, `streamSimple()`, `completeSimple()`
- **Key Files**:
  - `src/types.ts` - Core types (Model, Context, StreamOptions)
  - `src/providers/` - 16 provider implementations
  - `src/models.generated.ts` - Auto-generated model registry (~490KB)
  - `src/index.ts` - Main exports
- **Features**: Tool calling, thinking/reasoning, cross-provider handoffs, OAuth, context serialization
- **Supported APIs**: anthropic-messages, google-generative-ai, openai-responses, openai-completions, bedrock-converse-stream, etc.

### Phase 3: Core Package - agent ✅ COMPLETED
**Package**: `packages/agent` - Agent framework

**Key Understanding**:
- **Purpose**: Stateful agent with tool execution and event streaming
- **Built on**: `@mariozechner/pi-ai`
- **Core Class**: `Agent` with `prompt()`, `continue()`, `subscribe()` methods
- **Key Files**:
  - `src/agent.ts` - Main Agent class
  - `src/agent-loop.ts` - Core loop logic
  - `src/types.ts` - Agent-specific types
- **Features**: Event-driven architecture, tool execution (parallel/sequential), steering, follow-up messages, thinking budgets
- **Event Types**: agent_start/end, turn_start/end, message_start/update/end, tool_execution_start/update/end
- **Extensible**: Custom message types via declaration merging

### Phase 4: Core Package - coding-agent ✅ COMPLETED
**Package**: `packages/coding-agent` - Main CLI tool (pi)

**Key Understanding**:
- **Purpose**: Terminal coding harness - minimal CLI for AI-driven development
- **Modes**: interactive, print, JSON, RPC, SDK
- **Key Components**:
  - `src/core/agent-session.ts` - Main session management (102KB)
  - `src/core/tools/` - Tool implementations (read, write, edit, bash, grep, find, ls)
  - `src/core/extensions/` - Extension system with 50+ event types
  - `src/core/skills.ts` - Skill loader
  - `src/core/session-manager.ts` - Session persistence
  - `src/core/settings-manager.ts` - User settings
  - `src/core/model-resolver.ts` - Model selection
- **Features**: Extensions, skills, prompt templates, themes, branching, compaction
- **Built on**: `@mariozechner/pi-agent-core`, `@mariozechner/pi-tui`

### Phase 5: UI Package - tui ✅ COMPLETED
**Package**: `packages/tui` - Terminal UI components

**Key Understanding**:
- **Purpose**: Minimal terminal UI framework with differential rendering
- **Key Features**:
  - Differential rendering (3 strategies: first, full, update)
  - Synchronized output (CSI 2026)
  - Bracketed paste mode
  - Component-based (Container, Box, Text, Input, Editor, Markdown, etc.)
- **Built-in Components**: Text, TruncatedText, Input, Editor, Markdown, Loader, SelectList, SettingsList, Spacer, Image, Box
- **Key Files**:
  - `src/tui.ts` - Main TUI class
  - `src/terminal.ts` - Terminal interface
  - `src/components/` - Component implementations

### Phase 6: Infrastructure Package - mom ✅ COMPLETED
**Package**: `packages/mom` - Message-oriented middleware (Slack bot)

**Key Understanding**:
- **Purpose**: Slack bot powered by LLM with self-managing capabilities
- **Key Features**:
  - Self-installing tools (apk, npm, etc.)
  - Slack integration (Socket Mode)
  - Docker sandbox support
  - Persistent workspace per channel
  - Memory files (MEMORY.md)
  - Skills (CLI tools)
  - Events system (scheduled tasks)
- **Tools**: bash, read, write, edit, attach
- **Architecture**: Agent-based with channel-specific context management

### Phase 7: Data Package - pods ✅ COMPLETED
**Package**: `packages/pods` - Pod management

**Key Understanding**:
- **Purpose**: Deploy and manage LLMs on GPU pods with automatic vLLM configuration
- **Key Features**:
  - Automatic vLLM setup on Ubuntu pods
  - Tool calling configuration for agentic models (Qwen, GPT-OSS, GLM)
  - Multi-model management with smart GPU allocation
  - OpenAI-compatible API endpoints
  - Interactive agent for testing
- **Supported Pods**: DataCrunch, RunPod, Vast.ai, Prime Intellect, AWS EC2
- **CLI**: `pi pods setup`, `pi start`, `pi stop`, `pi agent`

### Phase 8: Web Package - web-ui ✅ COMPLETED
**Package**: `packages/web-ui` - Web-based UI

**Key Understanding**:
- **Purpose**: Reusable web UI components for AI chat interfaces
- **Built with**: mini-lit web components + Tailwind CSS v4
- **Key Components**:
  - `ChatPanel` - High-level chat interface
  - `AgentInterface` - Lower-level chat
  - `ArtifactsPanel` - HTML, SVG, Markdown rendering
- **Features**: 
  - Tools: JavaScript REPL, document extraction
  - Attachments: PDF, DOCX, XLSX, PPTX, images
  - Storage: IndexedDB-backed
  - CORS Proxy handling
- **Integration**: Uses `@mariozechner/pi-ai` and `@mariozechner/pi-agent-core`

---

## Understanding Goals

After full scan, I should understand:

1. **Architecture**: How do packages interact? What's the dependency graph?
2. **Data Flow**: How does a request flow through the system?
3. **Key Abstractions**: What are the main interfaces/types?
4. **Entry Points**: Where does execution start for each package?
5. **Testing Strategy**: How are tests organized?
6. **Configuration**: How is the system configured?

---

## Output

After scanning, produce:
- Architecture diagram (text-based)
- Key concepts summary
- Dependency graph
- Notable patterns identified
- Questions for further investigation

---

## 📊 ARCHITECTURE DIAGRAM

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           pi (coding-agent)                                  │
│                        Terminal Coding Harness                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
              ┌─────────────────────────┼─────────────────────────┐
              ▼                         ▼                         ▼
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│  pi-agent-core      │    │     pi-tui          │    │     pi-ai           │
│   (agent package)   │    │   (tui package)     │    │   (ai package)      │
└─────────────────────┘    └─────────────────────┘    └─────────────────────┘
         │                           │                         ▲
         └───────────────────────────┼─────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         External Providers                                  │
│  OpenAI • Anthropic • Google • Azure • Bedrock • Mistral • Groq • etc.    │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Layer Architecture:**
```
┌────────────────────────────────────┐
│  coding-agent (CLI/TUI)           │  ← User Interface Layer
├────────────────────────────────────┤
│  agent (Agent class, events)       │  ← Business Logic Layer
├────────────────────────────────────┤
│  ai (Providers, Models)            │  ← API Abstraction Layer
├────────────────────────────────────┤
│  External LLM Providers            │  ← External Services
└────────────────────────────────────┘
```

---

## 🔑 KEY CONCEPTS SUMMARY

### 1. **Provider Abstraction** (`packages/ai`)
- Unified interface for 20+ LLM providers
- Each provider implements: `stream()`, `complete()`, message transformation
- Supported APIs: `anthropic-messages`, `google-generative-ai`, `openai-responses`, `openai-completions`, `bedrock-converse-stream`
- Model registry auto-generated with ~490KB of model definitions

### 2. **Agent Framework** (`packages/agent`)
- Stateful agent with event-driven architecture
- Core loop: `prompt()` → LLM call → tool execution → response
- Event types for UI: `agent_start/end`, `turn_start/end`, `message_start/update/end`, `tool_execution_*`
- Tool execution modes: `parallel` (default) or `sequential`
- Extensible via custom message types (declaration merging)

### 3. **Coding Harness** (`packages/coding-agent`)
- Minimal terminal UI for AI-driven development
- 4 modes: interactive, print, JSON, RPC, SDK
- Core tools: `read`, `write`, `edit`, `bash`, `grep`, `find`, `ls`
- Extensibility: Extensions (50+ events), Skills, Prompt Templates, Themes
- Session management: branching, compaction, persistence

### 4. **TUI Framework** (`packages/tui`)
- Differential rendering (3 strategies)
- Synchronized output (CSI 2026) for flicker-free updates
- Component-based: Container, Box, Text, Input, Editor, Markdown, SelectList
- Focusable interface for IME support

### 5. **Slack Bot** (`packages/mom`)
- LLM-powered Slack bot with self-managing capabilities
- Docker sandbox for security
- Per-channel workspace with memory files
- Skills: Custom CLI tools
- Events: Scheduled tasks (one-shot, periodic)

### 6. **GPU Pod Management** (`packages/pods`)
- Deploy LLMs on GPU pods with vLLM
- Automatic tool calling configuration
- Multi-model management with GPU allocation
- OpenAI-compatible API endpoints

### 7. **Web UI** (`packages/web-ui`)
- Reusable web components (mini-lit + Tailwind)
- Chat interface with artifacts
- IndexedDB storage
- CORS proxy handling

---

## 🔗 DEPENDENCY GRAPH

```
package.json (root)
    │
    ├── packages/ai
    │   └── @anthropic-ai/sdk, @google/genai, openai, @aws-sdk/client-bedrock-runtime
    │
    ├── packages/agent
    │   └── packages/ai (peer)
    │
    ├── packages/coding-agent
    │   ├── packages/agent (peer)
    │   ├── packages/tui (peer)
    │   └── packages/ai (peer)
    │
    ├── packages/tui
    │   └── chalk, (standalone, no ai dependency)
    │
    ├── packages/mom
    │   ├── packages/agent (peer)
    │   └── packages/ai (peer)
    │
    ├── packages/pods
    │   └── (standalone CLI, uses any OpenAI-compatible client)
    │
    └── packages/web-ui
        ├── packages/agent (peer)
        ├── packages/ai (peer)
        └── mini-lit, tailwindcss
```

**Key Insight**: `packages/agent` is the bridge between UI and AI. It depends on `packages/ai` but is independent from `packages/tui`.

---

## 🎨 NOTABLE PATTERNS IDENTIFIED

### 1. **Event-Driven Architecture**
- Agent emits events: `message_update`, `tool_execution_*`, `turn_start/end`, etc.
- UI subscribes to events for real-time updates
- Event types allow fine-grained control over rendering

### 2. **Provider Plugin System**
- Each LLM provider is a separate module in `src/providers/`
- Register via `registerApiProvider()` in `register-builtins.ts`
- Lazy loading to reduce bundle size

### 3. **Tool Definition with TypeBox**
- Tools defined using TypeBox schemas for type safety
- Automatic validation with AJV
- Schema serialization for distributed systems

### 4. **Stream/Complete Pattern**
- `stream()`: For real-time updates (events)
- `complete()`: For single response
- Both support same functionality, just different consumption pattern

### 5. **Context Serialization**
- `Context` object can be JSON serialized
- Enables: persistence, handoff between models, transfer between services

### 6. **Cross-Provider Handoffs**
- Seamlessly switch models mid-conversation
- Automatic message transformation for compatibility
- Thinking blocks converted to `<thinking>` tagged text

### 7. **Extension System** (coding-agent)
- 50+ event types for lifecycle hooks
- Custom slash commands, widgets, overlays
- Hot-reload support

### 8. **Differential Rendering** (tui)
- First render: output all
- Width change/change above: full re-render
- Normal: update only changed lines
- CSI 2026 for atomic updates

---

## ❓ QUESTIONS FOR FURTHER INVESTIGATION

1. **Model Registry Generation**: How is `models.generated.ts` generated? What's the source?
2. **OAuth Implementation**: How does token refresh work across providers?
3. **Session Branching**: How does the branching mechanism work in detail?
4. **Compaction Algorithm**: How does context compaction work?
5. **vLLM Configuration**: How are tool calling parsers auto-selected?
6. **Extension Security**: How are extensions sandboxed?
7. **Test Coverage**: What's the test strategy per package?

---

## ✅ SCAN COMPLETE

**Date**: 2026-04-09
**Packages Scanned**: 7 (ai, agent, coding-agent, tui, mom, pods, web-ui)
**Total Files**: ~500+ TypeScript files
**Key Insight**: This is a well-architected monorepo with clear separation of concerns:
- `ai` = LLM API abstraction
- `agent` = Stateful agent logic
- `coding-agent` = Terminal UI harness
- `tui` = Reusable TUI components
- `mom` = Slack bot application
- `pods` = GPU pod deployment tool
- `web-ui` = Web chat components