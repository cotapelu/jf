# 🚀 PI SDK - FULL CAPABILITIES & UTILIZATION GUIDE

**Date:** 2025-06-16
**Version:** 0.79.2
**Purpose:** Tổng hợp đầy đủ năng lực của Pi Coding Agent SDK và cách tận dụng tối đa

---

## 📊 TABLE OF CONTENTS

1. [Tổng quan](#tổng-quan)
2. [Capabilities by Tier](#capabilities-by-tier)
3. [Full API Reference](#full-api-reference)
4. [Utilization Strategies](#utilization-strategies)
5. [Combination Patterns](#combination-patterns)
6. [Implementation Roadmap](#implementation-roadmap)
7. [Code Examples](#code-examples)

---

## 🎯 TỔNG QUAN

Pi Coding Agent SDK là **full-featured framework** để build AI coding assistants với:

- ✅ Session lifecycle management (create, switch, fork, dispose)
- ✅ Multi-session & session tree support
- ✅ Context window management & compaction
- ✅ 7 built-in tools + custom tool system
- ✅ Plugin/extension architecture
- ✅ Full TUI (terminal UI) components
- ✅ Multi-model provider abstraction
- ✅ Event-driven architecture
- ✅ Skills/reusable prompt system
- ✅ Config & settings persistence
- ✅ Auth & trust management
- ✅ Package management integration
- ✅ File operations (read/write/edit/grep/find/ls/bash)
- ✅ Image processing utilities
- ✅ Clipboard, highlighting, themes

**Total exports:** 150+ types, 50+ functions, 20+ classes

---

## 🏆 CAPABILITIES BY TIER

### **TIER 1: FOUNDATION (Core Architecture)**

#### **1.1 Session Lifecycle Management**

**API:**
```typescript
createAgentSession(options?) → CreateAgentSessionResult
createAgentSessionFromServices({ services, ... }) → CreateAgentSessionResult
createAgentSessionRuntime(factory, options) → AgentSessionRuntime
```

**Classes:**
- `AgentSession` - conversation state
- `AgentSessionRuntime` - full runtime với session + services

**Methods:**
- `runtime.switchSession(sessionPath, options)` - switch to another session
- `runtime.newSession(options)` - create new child session
- `runtime.fork(entryId, options)` - fork at specific point
- `runtime.importFromJsonl(path)` - import external session
- `runtime.dispose()` - cleanup

**Utilization:**
```
✅ Parallel task execution:
   - Main session: overall goal
   - Fork child cho từng subtask
   - Switch between, collect results
   
✅ Incremental development:
   - /session create "experiment"
   - Try approach A
   - /switch back to main
   - Keep or discard
   
✅ Session snapshots:
   - Create session "before-refactor"
   - Refactor trong session mới
   - Compare, rollback if needed
```

---

#### **1.2 Multi-Session Management**

**API:**
```typescript
SessionManager.create(cwd) → SessionManager
SessionManager.inMemory() → SessionManager (cho testing)
```

**Classes:**
- `SessionManager` - quản lý session files
- `SessionRegistry` (custom trong project) - in-memory tracking
- `MultiSessionManager` (custom) - extended với tree operations

**Features:**
- Auto-save sessions to `.pi/sessions/`
- Session versioning & migration
- Context building từ session
- Serialization/deserialization

**Utilization:**
```
✅ Session tree:
   parent
   ├─ child-1 (feature-auth)
   ├─ child-2 (feature-search)
   └─ child-3 (bugfix-login)
   
✅ Session tagging:
   Tag: "feature", "bugfix", "research"
   Filter, search by tags
   
✅ Session metadata:
   Name, description, timestamps
   Search by name/content
```

---

#### **1.3 Context Window & Compaction**

**API:**
```typescript
compact(entries, settings) → CompactionResult
shouldCompact(entries, options) → boolean
calculateContextTokens(entries) → number
generateBranchSummary(entries, options) → BranchSummaryResult
collectEntriesForBranchSummary(entries) → CollectEntriesResult
DEFAULT_COMPACTION_SETTINGS
```

**Utilization:**
```
✅ Smart compaction:
   - When tokens > 80% window → auto summarize
   - Summarize old messages, keep code snippets
   - Preserve recent errors for debugging
   
✅ Branch-based context:
   - Main timeline: overall goal
   - Branch 1: implementation details
   - Switch branches, each tự compact
   
✅ Token budgeting:
   - Prioritize: code > errors > chat
   - Evict: small talk after 1h
   - Dynamic: allocate more to active branch
```

---

### **TIER 2: EXECUTION**

#### **2.1 Tool System**

**Built-in Tool Factories:**
```typescript
createBashTool(cwd) → ToolDefinition
createCodingTools(cwd) → [read, bash, edit, write]
createEditTool(cwd) → ToolDefinition
createFindTool(cwd) → ToolDefinition
createGrepTool(cwd) → ToolDefinition
createLsTool(cwd) → ToolDefinition
createReadOnlyTools(cwd) → [read, grep, find, ls]
createReadTool(cwd) → ToolDefinition
createWriteTool(cwd) → ToolDefinition
```

**Tool Definition Structure:**
```typescript
interface ToolDefinition {
  name: string;
  label?: string;
  description: string;
  promptSnippet?: string;
  promptGuidelines?: string[];
  parameters: JSONSchema;
  execute(
    toolCallId: string,
    params: any,
    signal?: AbortSignal,
    onUpdate?: (result: any) => void,
    ctx?: ExtensionContext
  ): Promise<ToolResult>;
}
```

**Tool Input Types:**
- `BashToolInput`, `EditToolInput`, `ReadToolInput`, `WriteToolInput`
- `FindToolInput`, `GrepToolInput`, `LsToolInput`

**Utilization:**
```
✅ Tool composition:
   read → grep → edit → write (chained)
   Each output feeds next input
   
✅ Tool queue:
   withFileMutationQueue(toolFn)
   - Batch multiple edits
   - Atomic apply or rollback
   
✅ Custom tool factory:
   function createMyTool(cwd: string): ToolDefinition {
     return {
       name: 'my_tool',
       parameters: { type: 'object', properties: { ... } },
       execute: async (id, params) => { ... }
     };
   }
```

---

#### **2.2 Model Provider Abstraction**

**API:**
```typescript
ModelRegistry.create(authStorage, modelsPath) → ModelRegistry
ModelProviderService.createProvider(providerName, config) → ModelProvider
ModelInfo { provider, id, contextWindow, reasoning? }
```

**Features:**
- Multi-provider: Anthropic, OpenAI, Google, etc.
- Model selection UI
- Context window tracking
- Thinking level配置

**Utilization:**
```
✅ Smart routing:
   if (task === 'code') use claude-sonnet
   if (task === 'simple') use gpt-4o
   if (task === ' budget') use claude-haiku
   
✅ Fallback chain:
   Primary: claude-sonnet-4
   Fallback: gpt-4-turbo
   Fallback: gpt-3.5-turbo
   
✅ Cost optimization:
   Track token usage per model
   Auto-select cheapest viable
   Budget alerts at $X spent
```

---

#### **2.3 Prompt Template System**

**API:**
```typescript
interface PromptTemplate {
  name: string;
  description: string;
  filePath: string;
  sourceInfo: SourceInfo;
  content: string;
}

resourceLoader.loadPrompt(name) → PromptTemplate
resourceLoaderOptions.promptsOverride → Customize prompts
```

**Utilization:**
```
✅ Role-based prompts:
   - assistant: system prompt
   - tool_use: how to use tools
   - multi_agent_child: for child agents
   
✅ Project-specific:
   Override prompts qua .pi/prompts/
   Team conventions baked into prompts
   
✅ A/B testing:
   Different prompt variants
   Track which performs better
```

---

#### **2.4 Skills System (Reusable Prompts)**

**API:**
```typescript
loadSkills(dir?) → LoadSkillsResult
loadSkillsFromDir(dir, options) → LoadSkillsResult
Skill { name, description, prompt, frontmatter }
formatSkillsForPrompt(skills) → string
```

**Skills là YAML files:**
```yaml
name: extract-function
description: Extract a function from larger code
prompt: |
  You are refactoring expert...
frontmatter:
  tags: [refactor, extract]
  parameters:
    - start_line
    - end_line
```

**Utilization:**
```
✅ Skill library:
   skills/
   ├─ refactor/
   │   ├─ extract-function.yaml
   │   ├─ rename-symbol.yaml
   │   └─ split-class.yaml
   ├─ test/
   │   ├─ unit-test.yaml
   │   ├─ integration-test.yaml
   │   └─ e2e-test.yaml
   
✅ Skill invocation:
   User: "Extract lines 10-50 into function"
   → Agent: "Invoking skill: refactor.extract-function"
   → Load skill, execute với params
   
✅ Skill chaining:
   Pipeline: extract → test → doc → commit
   Each step là skill riêng
```

---

### **TIER 3: INTERACTION**

#### **3.1 Interactive Mode (TUI)**

**API:**
```typescript
InteractiveMode(runtime, options)
InteractiveModeOptions {
  initialMessages?: string[]
  verbose?: boolean
  ...
}
```

**Features:**
- Full-screen terminal UI
- Multi-line input (``` to submit)
- Command prefix (/session, /model, /exit)
- History (↑/↓)
- Auto-suggestions
- Theme支持

**TUI Components (21 components):**
- `AssistantMessageComponent`, `UserMessageComponent`
- `ToolExecutionComponent`, `SessionSelectorComponent`
- `ModelSelectorComponent`, `SettingsSelectorComponent`
- `ThemeSelectorComponent`, `LoginDialogComponent`
- `BashExecutionComponent`, `CustomEditor`
- 11+ more components

**Utilization:**
```
✅ Rich session management UI:
   SessionSelectorComponent → tree view
   Click to switch, rename, delete
   
✅ Inline code review:
   ToolExecutionComponent → show diff
   Approve/Reject với key hints
   
✅ Real-time settings:
   ModelSelector → change model mid-session
   ThemeSelector → dark/light toggle
```

---

#### **3.2 RPC Mode (Remote Agents)**

**API:**
```typescript
RpcClient(options) → RpcClient
runRpcMode(createRuntime, options) → Promise<void>
RpcCommand, RpcResponse, RpcEventListener
```

**Use case:**
- Agent chạy trên server
- Client connect qua WebSocket/stdio
- Remote execution

**Utilization:**
```
✅ Cloud agent:
   API server exposes RPC endpoint
   IDE plugin connects as client
   → Cloud compute, local UI
   
✅ Multi-user:
   One agent server, many clients
   Each client có session riêng
   Shared knowledge base
```

---

### **TIER 4: INFRASTRUCTURE**

#### **4.1 Config & Settings**

**API:**
```typescript
SettingsManager.create(cwd, agentDir) → SettingsManager
Settings { model, thinkingLevel, tools, ... }
loadProjectContextFiles(cwd, agentDir) → Promise<ContextFiles>
```

**Config files:**
- `.pi/config.json` - project config
- `.piignore` - ignore patterns
- `.pi/settings.json` - user settings

**Utilization:**
```
✅ Project conventions:
   .pi/config.json:
   {
     "style": "typescript",
     "framework": "react",
     "testing": "vitest",
     "maxHistory": 1000
   }
   → Agent tự applies conventions
   
✅ Team standards:
   Commit .pi/config.json vào repo
   All developers share same config
   
✅ User preferences:
   ~/.pi/settings.json:
   { "defaultModel": "claude-sonnet-4" }
```

---

#### **4.2 Auth & Trust**

**API:**
```typescript
AuthStorage.create(backend, path) → AuthStorage
FileAuthStorageBackend(path) → AuthStorageBackend
InMemoryAuthStorageBackend() → AuthStorageBackend
AuthCredential { type, provider, data? }
ApiKeyCredential { apiKey }

ProjectTrustStore.getDecision(resource) → ProjectTrustDecision
ProjectTrustDecision { allowed, reason, expiresAt? }
hasTrustRequiringProjectResources(operation) → boolean
```

**Utilization:**
```
✅ Secure API keys:
   Tool cần OpenAI API key
   → Check AuthStorage
   → Prompt user nếu missing
   → Encrypt lưu vào ~/.pi/auth.json
   
✅ Project trust:
   User: "Read src/secrets/"
   → Check ProjectTrustStore
   → If not trusted → ask user
   → Remember decision
   
✅ OAuth flow:
   Tool cần GitHub access
   → Initiate OAuth
   → Store token in AuthStorage
   → Refresh automatically
```

---

#### **4.3 Resource Loader**

**API:**
```typescript
DefaultResourceLoader(options) → ResourceLoader
ResourceLoader {
  loadPrompt(name) → PromptTemplate
  loadResource(path) → ResolvedResource
  reload() → Promise<void>
}
```

**Capabilities:**
- Load prompts từ files hoặc package
- Template resolution
- Cache + reload

**Utilization:**
```
✅ Multi-source prompts:
   - Built-in: @earendil-works/pi-coding-agent/prompts/
   - Project: .pi/prompts/
   - Package: node_modules/some-pkg/prompts/
   Priority: project > package > built-in
   
✅ Hot-reload:
   Edit .pi/prompts/assistant.txt
   → reload() → changes apply immediately
   No restart needed
   
✅ Template variables:
   {{projectName}} trong prompt
   Auto-filled từ config
```

---

#### **4.4 Package Manager**

**API:**
```typescript
DefaultPackageManager.create(cwd, options?) → PackageManager
PackageManager {
  resolveDependencies() → ResolvedPaths
  installDependencies(deps, options?) → Promise<void>
  getPackageManager() → 'npm' | 'yarn' | 'pnpm'
}
```

**Utilization:**
```
✅ Auto-install:
   User: "Use lodash"
   Agent:
   1. Add 'import _ from "lodash"'
   2. Detect missing package
   3. packageManager.install(['lodash'])
   4. Verify type-check
   
✅ Dependency health:
   /deps audit → npm audit
   /deps update → safe updates
   /deps tree → show dependency graph
   
✅ Lockfile维护:
   Auto-generate package-lock.json
   Detect conflicts
   Suggest resolutions
```

---

#### **4.5 File Operations (7 Built-in Tools)**

**Read Tool:**
- `read(path, options?)` → file content
- Options: offset, limit, maxLines, maxBytes
- Auto-truncate large files

**Write Tool:**
- `write(path, content, options?)` → create/overwrite
- Options: createParents, mode, encoding
- Safe: backup .bak, atomic write

**Edit Tool:**
- `edit(path, edits, options?)` → surgical edits
- Edits: [{ from, to, insert? }]
- dry-run support

**Bash Tool:**
- `bash(command, options?)` → execute shell
- Options: cwd, env, timeout
- Stream output real-time

**Find Tool:**
- `find(pattern, options?)` → find files
- Options: cwd, ignore, maxResults

**Grep Tool:**
- `grep(pattern, options?)` → search text
- Options: cwd, include, exclude, maxResults

**Ls Tool:**
- `ls(path, options?)` → list directory
- Options: depth, ignore, details

**Utilization:**
```
✅ Safe file operations:
   Edit → dry-run → preview → apply
   Write → backup → atomic → verify
   
✅ Batch operations:
   Find all .js files → grep for "console.log" → edit to remove
   Chained: find → grep → edit
   
✅ Smart truncation:
   Read 1000+ lines → auto-truncate với context
   "Showing first 100, last 50 lines"
```

---

### **TIER 5: UTILITIES**

#### **5.1 Image Processing**

**API:**
```typescript
resizeImage(buffer, options) → ResizedImage
convertToPng(buffer) → Buffer
formatDimensionNote(width, height) → string
```

**Utilization:**
```
✅ Screenshot analysis:
   User paste screenshot
   → resize to manageable size
   → convert to base64
   → send to vision model
   
✅ Icon generation:
   Request: "Create favicon"
   → Generate with DALL-E
   → resize to 32x32, 16x16
   → convert to PNG
```

---

#### **5.2 Clipboard & Parsing**

**API:**
```typescript
copyToClipboard(text) → Promise<void>
parseFrontmatter(content) → { frontmatter, body }
stripFrontmatter(content) → string
```

**Utilization:**
```
✅ Copy code snippets:
   After generating code
   → auto-copy to clipboard
   → "Copied to clipboard!"
   
✅ Frontmatter extraction:
   Markdown files với YAML frontmatter
   Parse metadata separately
```

---

#### **5.3 Shell & Code Highlighting**

**API:**
```typescript
getShellConfig() → ShellConfig (detect bash/zsh/fish)
highlightCode(code, language, options?) → HighlightResult
initTheme(), getMarkdownTheme(), getSelectListTheme()
```

**Utilization:**
```
✅ Code display:
   Syntax highlighting trong TUI
   Theme-aware colors
   
✅ Shell integration:
   Detect user's shell
   Load shell config (aliases, env)
   Execute bash trong proper env
```

---

## 🔄 UTILIZATION STRATEGIES

---

### **STRATEGY 1: Session Tree Workflow**

```
GOAL: Build authentication system

Main Session: "Implement OAuth login"
├─ Child 1 (research): "Research best practices"
├─ Child 2 (backend): "Implement OAuth server"
├─ Child 3 (frontend): "Implement login UI"
└─ Child 4 (tests): "Write integration tests"

Workflow:
1. Main session: define goal, constraints
2. Fork 4 children (parallel)
3. Switch between children, review progress
4. Merge results back to main
5. Final integration & test
```

**Advantages:**
- Parallel execution (4x faster)
- Isolation (failures contained)
- Easy rollback (delete child sessions)
- Clear separation of concerns

---

### **STRATEGY 2: Event-Driven Automation**

```
EVENT: ToolCallEvent
├─ Log to analytics database
├─ Increment metrics counter
├─ Check if need compaction (tokens > 80%)
├─ If tool = 'read' → cache result
└─ If tool failed → trigger retry logic

EVENT: SessionStartEvent
├─ Load project config
├─ Initialize session in registry
├─ Set up logging context
└─ Apply user preferences

EVENT: ToolResultEvent
├─ Update session context
├─ Maybe trigger next tool (chain)
└─ Notify UI if interactive
```

**Implementation:**
```typescript
const bus = createEventBus();

bus.on('tool_call', (event) => {
  metrics.increment(`tool_calls_${event.toolName}`);
  analytics.log(event);
});

bus.on('tool_result', async (event) => {
  if (event.isError) {
    await handleError(event);
  } else {
    await cacheResult(event);
  }
});
```

---

### **STRATEGY 3: Extension Ecosystem**

```
Core Agent
├─ Extension: git
│   ├─ Tools: git_commit, git_push, git_pull, git_rebase
│   ├─ Hooks: pre_commit, post_merge
│   └─ UI: Git status panel
├─ Extension: docker
│   ├─ Tools: docker_build, docker_run, docker_push
│   ├─ Hooks: after_build
│   └─ UI: Container status
├─ Extension: kubernetes
│   ├─ Tools: k8s_deploy, k8s_logs, k8s_portforward
│   └─ UI: Pod status
└─ Extension: jira
    ├─ Tools: jira_create_issue, jira_transition
    └─ UI: Ticket view
```

**Extension Structure:**
```typescript
// .pi/extensions/git/extension.ts
export const gitExtension: Extension = {
  name: 'git',
  setup(runtime) {
    registerTools([
      createGitCommitTool(runtime),
      createGitPushTool(runtime),
    ]);
    
    // Hook vào events
    runtime.on('session_start', () => {
      git.init();
    });
  },
  
  actions: {
    createBranch: (name) => { ... },
    merge: (branch) => { ... },
  },
  
  components: {
    GitStatusPanel: () => h('div', ...),
  },
};
```

---

### **STRATEGY 4: Skill Chains**

```
User: "Add login feature with tests"

Pipeline:
1. plan-feature (skill)
   → Generate implementation plan
   → Output: 5 steps

2. scaffold-auth (skill)
   → Create files: auth.service.ts, auth.controller.ts
   → implement basic structure

3. implement-login (skill)
   → Fill in actual logic
   → Use project patterns

4. generate-unit-tests (skill)
   → Test cho auth.service

5. generate-e2e-tests (skill)
   → Test login flow

6. review-code (skill)
   → Self-review, fix issues

7. commit-changes (skill)
   → git add/commit với good message
```

**Skill Chain Definition:**
```yaml
chain: add-feature
steps:
  - skill: plan-feature
    params:
      feature: "login"
  - skill: scaffold
    params:
      type: "auth"
      framework: "express"
  - skill: implement
    dependsOn: [scaffold]
  - skill: test
    params:
      testType: "unit"
    dependsOn: [implement]
  - skill: review
    dependsOn: [test]
  - skill: commit
    params:
      message: "feat: add login"
    dependsOn: [review]
```

---

### **STRATEGY 5: Context-Aware Coding**

```
Project Index (scanned once):
{
  "utils": {
    "formatDate": { file: "src/utils/date.ts", signature: "formatDate(date: Date): string" },
    "validateEmail": { file: "src/utils/validation.ts", signature: "validateEmail(email: string): boolean" }
  },
  "patterns": {
    "repository": "All DB access goes through Repository classes",
    "controller": "Controllers extend BaseController",
    "logger": "Use logger.info(), not console.log"
  },
  "dependencies": {
    "lodash": "^4.17.21",
    "express": "^4.18.0"
  }
}

Agent behavior:
User: "Format this timestamp"
→ Search index → finds formatDate() exists
→ "I see utils.formatDate() exists. Use it?"
→ User: "Yes"
→ Reuse existing function

User: "Write DB access"
→ Check pattern → "Use Repository pattern"
→ Generate Repository class
→ Follow existing structure
```

---

## 🎯 COMBINATION PATTERNS

---

### **PATTERN 1: Parallel Development with Sessions**

```typescript
// Main session
const mainSession = runtime.session;

// Fork 3 children cho 3 features
const [feature1, feature2, feature3] = await Promise.all([
  runtime.fork('feature1-entry-id'),
  runtime.fork('feature2-entry-id'),
  runtime.fork('feature3-entry-id'),
]);

// Work on each independently
await workOnFeature(feature1);
await workOnFeature(feature2);
await workOnFeature(feature3);

// Merge back
runtime.switchSession(mainSession.sessionFile);
// Pull changes from children
```

**Use case:** Large features, parallelizable tasks

---

### **PATTERN 2: Auto-Retry with Event Bus**

```typescript
const bus = createEventBus();

bus.on('tool_failed', async (event) => {
  const { toolName, error, attempt = 0 } = event.details;
  
  if (attempt < 3 && shouldRetry(error)) {
    setTimeout(async () => {
      // Retry với backoff
      await runtime.session.callTool(toolName, event.params);
    }, 1000 * Math.pow(2, attempt));
  } else {
    // Give up, notify user
    await reportFailure(event);
  }
});
```

**Use case:** Unreliable tools (network, bash)

---

### **PATTERN 3: Skill-Based Workflow**

```typescript
// Define workflow
const workflow = {
  name: 'implement-feature',
  steps: [
    { skill: 'plan', params: { type: 'feature' } },
    { skill: 'scaffold', params: { template: 'express-api' } },
    { skill: 'implement' },
    { skill: 'test', params: { coverage: true } },
    { skill: 'review' },
    { skill: 'commit' },
  ],
};

// Execute
for (const step of workflow.steps) {
  const result = await invokeSkill(step.skill, step.params);
  if (result.failed) break;
}
```

---

### **PATTERN 4: Extension Composition**

```typescript
// Load extensions dynamically
const extensions = await discoverAndLoadExtensions('.pi/extensions');

// Each extension contributes:
// - Tools
// - Hooks
// - UI components
// - Config

// Combined power:
// User types: "Deploy to production"
// Agent:
// 1. git extension: git commit, tag
// 2. docker extension: docker build, push
// 3. k8s extension: kubectl apply
// 4. slack extension: notify team
```

---

### **PATTERN 5: Smart Context Management**

```typescript
// Monitor token usage
const tokens = calculateContextTokens(runtime.session.messages);
const window = runtime.services.modelProviderService.getContextWindow();

if (tokens > window * 0.8) {
  // Auto-compaction
  const result = await compact(entries, {
    strategy: 'summarize_branches',
    keepRecent: 10,
    keepCode: true,
  });
  
  // Replace messages với compacted version
  runtime.session.messages = result.entries;
}
```

---

## 🗺️ IMPLEMENTATION ROADMAP

---

### **PHASE 1: Foundation (Week 1-2)**

**Goals:**
- ✅ Codebase indexer (AST scanning)
- ✅ Project conventions detector
- ✅ Basic skill system

**Deliverables:**
```
src/indexer/
  ├─ codebase-indexer.ts  (scan project, build index)
  ├─ convention-detector.ts (detect patterns)
  └─ index-utils.ts

src/skills/
  ├─ loader.ts
  ├─ executor.ts
  └─ registry.ts

.p/skills/ (example skills)
  ├─ refactor/
  │   ├─ extract-function.yaml
  │   └─ rename-symbol.yaml
  └─ test/
      └─ unit-test.yaml
```

---

### **PHASE 2: Smart Tools (Week 3-4)**

**Goals:**
- ✅ Smart search tool (with context)
- ✅ Refactoring tools (extract, rename)
- ✅ Test generation tool

**Deliverables:**
```
src/tools/smart-search/
  ├─ tool.ts
  ├─ searcher.ts
  └─ context-builder.ts

src/tools/refactor/
  ├─ extract-function.ts
  ├─ rename-symbol.ts
  └─ split-class.ts

src/tools/testing/
  ├─ generate-tests.ts
  ├─ run-tests.ts
  └─ coverage-reporter.ts
```

---

### **PHASE 3: Workflow Automation (Week 5-6)**

**Goals:**
- ✅ Session tree UI
- ✅ Skill chaining engine
- ✅ Event-driven hooks

**Deliverables:**
```
src/workflow/
  ├─ engine.ts (execute skill chains)
  ├─ planner.ts (plan multi-step)
  └─ validator.ts (verify each step)

src/ui/session-tree/
  └─ SessionTreeComponent.tsx (TUI)

src/hooks/
  ├─ tool-retry.ts
  ├─ auto-compact.ts
  └─ cache-results.ts
```

---

### **PHASE 4: Extensions (Week 7-8)**

**Goals:**
- ✅ Extension discovery & loading
- ✅ Git extension
- ✅ Docker extension

**Deliverables:**
```
src/extensions/
  ├─ loader.ts
  ├─ registry.ts
  └─ runtime.ts

extensions/git/
  ├─ extension.ts
  ├─ tools/
  │   ├─ commit.ts
  │   ├─ push.ts
  │   └─ pull.ts
  └─ hooks.ts

extensions/docker/
  ├─ extension.ts
  ├─ tools/
  │   ├─ build.ts
  │   ├─ run.ts
  │   └─ push.ts
  └── utils.ts
```

---

## 💻 CODE EXAMPLES

---

### **Example 1: Smart Search Tool**

```typescript
// src/tools/smart-search/tool.ts
export const smartSearchTool: ToolDefinition = {
  name: 'smart_search',
  description: 'Search codebase with smart understanding',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'What to search for' },
      context: { type: 'string', description: 'Additional context' },
    },
  },
  async execute(toolCallId, params) {
    const index = await loadCodebaseIndex();
    const results = await semanticSearch(index, params.query, params.context);
    
    return {
      content: results.map(r => ({
        type: 'text',
        text: `File: ${r.file}\nRelevance: ${r.score}\nSnippet:\n${r.snippet}`,
      })),
      details: { results },
    };
  },
};
```

---

### **Example 2: Extract Function Skill**

```yaml
# .pi/skills/refactor/extract-function.yaml
name: extract-function
description: Extract a block of code into a new function
prompt: |
  Extract lines {{start_line}}-{{end_line}} from {{file}} into a new function.
  
  Requirements:
  - Function name: {{function_name}}
  - Parameters: Infer from used variables
  - Return type: Infer from return statements
  - Move extracted code exactly
  - Replace original with function call
  - Update imports if needed
  
  Provide:
  1. New function definition
  2. Modified original file with function call
  3. Explanation of changes
frontmatter:
  tags: [refactor, extract]
  requiredParams:
    - file
    - start_line
    - end_line
    - function_name
```

---

### **Example 3: Event Hook for Auto-Compact**

```typescript
// src/hooks/auto-compact.ts
export function setupAutoCompact(runtime: AgentSessionRuntime) {
  const bus = runtime.services.eventBus; // Assuming event bus available
  
  bus.on('tool_result', async (event) => {
    const session = runtime.session;
    const tokens = calculateContextTokens(session.messages);
    const window = runtime.services.modelProviderService.getContextWindow();
    
    if (tokens > window * 0.8) {
      console.log(`[AutoCompact] Tokens: ${tokens}/${window}, compacting...`);
      
      const result = await compact(session.messages, {
        strategy: 'summarize_old',
        keepRecent: 20,
      });
      
      session.messages = result.entries;
      await session.save();
      
      bus.emit('session_compacted', {
        sessionId: session.sessionFile,
        tokensBefore: tokens,
        tokensAfter: calculateContextTokens(result.entries),
      });
    }
  });
}
```

---

### **Example 4: Extension with Git Tools**

```typescript
// extensions/git/extension.ts
export const gitExtension: Extension = {
  name: 'git',
  version: '1.0.0',
  setup(runtime) {
    // Register tools
    runtime.services.toolRegistry.register(createGitCommitTool(runtime));
    runtime.services.toolRegistry.register(createGitPushTool(runtime));
    
    // Hook into session events
    runtime.on('session_start', () => {
      git.init();
      console.log('[git] Extension initialized');
    });
  },
  
  actions: {
    async createBranch(name: string) {
      await git.branch(name);
      return { success: true, branch: name };
    },
    
    async merge(branch: string, options?: { squash?: boolean }) {
      await git.merge(branch, options);
      return { success: true };
    },
  },
  
  components: {
    GitStatusPanel: () => {
      const status = git.getStatus();
      return h('div', { class: 'git-panel' }, [
        h('h3', 'Git Status'),
        h('ul', status.modified.map(f => h('li', f))),
      ]);
    },
  },
};
```

---

## 📊 CAPABILITY MATRIX

| Capability | API/Class | Difficulty | Value | Priority |
|------------|-----------|------------|-------|----------|
| Session tree | `runtime.fork()`, `MultiSessionManager` | Medium | High | P0 |
| Event bus | `createEventBus()`, events | Medium | High | P0 |
| Skills | `loadSkills()`, `formatSkillsForPrompt()` | Easy | High | P0 |
| Extensions | `defineTool()`, `discoverAndLoadExtensions()` | Medium | High | P1 |
| Compaction | `compact()`, `generateBranchSummary()` | Medium | Medium | P1 |
| Tool factories | `create*Tool()` | Easy | High | P1 |
| Model routing | `ModelRegistry`, `ModelInfo` | Easy | Medium | P2 |
| Auth/Trust | `AuthStorage`, `ProjectTrustStore` | Medium | Medium | P2 |
| TUI components | 21 components | Hard | Medium | P2 |
| Package manager | `DefaultPackageManager` | Easy | Low | P3 |
| Image utils | `resizeImage()`, `convertToPng()` | Easy | Low | P3 |
| Clipboard | `copyToClipboard()` | Trivial | Low | P3 |

---

## 🎯 RECOMMENDED FOCUS

**To make LLM truly superior, prioritize:**

1. **Session Tree + Parallel Execution** (P0)
   - Fork multiple children
   - Work in parallel
   - Merge results

2. **Smart Context + Compaction** (P0)
   - Auto-summarize old messages
   - Keep relevant code snippets
   - Infinite memory illusion

3. **Skill Chains** (P0)
   - Define workflows
   - Execute multi-step
   - Verify each step

4. **Event-Driven Automation** (P1)
   - Hooks on events
   - Auto-retry, auto-compact
   - Metrics & observability

5. **Extension Ecosystem** (P1)
   - Git, Docker, K8s
   - Modular capabilities
   - User-customizable

---

## 📝 CONCLUSION

Pi SDK cung cấp **enterprise-grade foundation** với:

- ✅ **Full session lifecycle** (create, switch, fork, dispose)
- ✅ **Multi-session tree** support
- ✅ **Smart context** management (compaction, summarization)
- ✅ **Plugin architecture** (extensions, skills, tools)
- ✅ **Rich UI** (21 TUI components)
- ✅ **Production features** (auth, trust, settings, events)

**Để tận dụng tối đa:**
1. Build **skill library** trong `.pi/skills/`
2. Create **extensions** cho common workflows (git, docker)
3. Implement **session tree** cho parallel tasks
4. Setup **event hooks** cho automation
5. Develop **smart indexer** cho codebase awareness

**Result:** LLM trở thành **full-stack autonomous engineer** capable of:
- Planning & executing complex multi-file changes
- Working on multiple tasks in parallel
- Understanding full codebase context
- Following team conventions automatically
- Self-correcting via test-execute-fix loops
- Integrating với existing tools (git, docker, k8s)

---

**Full potential unlocked = Core SDK + Skills + Extensions + Smart Context + Parallel Sessions**

---

*End of document*
