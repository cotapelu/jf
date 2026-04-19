# BÁO CÁO PHÂN TÍCH FLOW - KILO CODEBASE

## Tổng quan

Báo cáo này phân tích chi tiết tất cả các flow trong hệ thống Kilo, từ mức độ nhỏ nhất (hàm) đến lớn nhất (end-to-end). Hệ thống bao gồm 4 packages chính:

- **pi-ai**: AI provider abstraction và streaming
- **pi-agent-core**: Agent orchestration và loop
- **pi-tui**: Terminal UI components
- **coding-agent**: CLI application và integration

---

## PHẦN 1: MICRO-LEVEL FLOWS (Hàm)

### 1.1 Flow: Tool Execution (agent-loop.ts)

**File**: `packages/agent/src/agent-loop.ts:336-631`

**Flow**:
```
executeToolCalls()
  ├─ executeToolCallsSequential() [hoặc executeToolCallsParallel()]
  │   ├─ prepareToolCall()
  │   │   ├─ validateToolArguments()
  │   │   └─ beforeToolCall hook
  │   ├─ executePreparedToolCall()
  │   │   └─ tool.execute() với partial result callback
  │   └─ finalizeExecutedToolCall()
  │       └─ afterToolCall hook
  └─ emitToolCallOutcome()
      └─ Tạo ToolResultMessage
```

**Events emitted**:
- `tool_execution_start`
- `tool_execution_update` (nhiều lần cho partial results)
- `tool_execution_end`
- `message_start` (cho tool result)
- `message_end` (cho tool result)

**Data flow**:
```
AssistantMessage (với toolCalls)
  → ToolCall[]
  → Validated args
  → Tool execution
  → ToolResult
  → ToolResultMessage
  → Context.messages[]
```

---

### 1.2 Flow: Agent Loop (agent-loop.ts)

**File**: `packages/agent/src/agent-loop.ts:155-232`

**Flow**:
```
runLoop()
  ├─ Outer loop (follow-up messages)
  │   └─ Inner loop (tool calls + steering)
  │       ├─ Process pending messages
  │       ├─ streamAssistantResponse()
  │       │   ├─ transformContext() [optional]
  │       │   ├─ convertToLlm()
  │       │   ├─ streamFn() [streamSimple hoặc custom]
  │       │   └─ Emit streaming events
  │       ├─ executeToolCalls()
  │       └─ emit turn_end
  └─ Check follow-up messages
```

**Events emitted**:
- `agent_start`
- `turn_start` (mỗi turn)
- `message_start`, `message_update`, `message_end`
- `tool_execution_start`, `tool_execution_update`, `tool_execution_end`
- `turn_end` (mỗi turn)
- `agent_end`

**Data flow**:
```
AgentContext (messages, tools, systemPrompt)
  → Transform (optional)
  → LLM Context (Message[], Tool[])
  → Stream response
  → AssistantMessage
  → Tool calls (nếu có)
  → Tool results
  → Update context
  → Repeat hoặc end
```

---

### 1.3 Flow: Streaming Response (anthropic.ts)

**File**: `packages/ai/src/providers/anthropic.ts:199-441`

**Flow**:
```
streamAnthropic()
  ├─ Create Anthropic client
  ├─ Build params (messages, tools, thinking config)
  ├─ Call client.messages.stream()
  └─ Process events:
      ├─ message_start → Capture usage
      ├─ content_block_start → Create block
      ├─ content_block_delta → Update content
      ├─ content_block_stop → Finalize block
      └─ message_delta → Update stop_reason, usage
```

**Events pushed to stream**:
- `start` → partial message
- `text_start`, `text_delta`, `text_end`
- `thinking_start`, `thinking_delta`, `thinking_end`
- `toolcall_start`, `toolcall_delta`, `toolcall_end`
- `done` → final message
- `error` → error message

**Data flow**:
```
Context (messages, tools, systemPrompt)
  → Anthropic params
  → API stream
  → Parse events
  → Build AssistantMessage
  → Emit events
  → Return stream
```

---

### 1.4 Flow: Agent Session Prompt (agent-session.ts)

**File**: `packages/coding-agent/src/core/agent-session.ts:938-1075`

**Flow**:
```
prompt()
  ├─ Handle extension commands (/command)
  ├─ Emit input event (extension interception)
  ├─ Expand skill commands (/skill:name)
  ├─ Expand prompt templates (/template)
  ├─ Check streaming → queue via steer() hoặc followUp()
  ├─ Validate model và API key
  ├─ Check compaction (nếu cần)
  ├─ Build messages:
  │   ├─ User message
  │   ├─ Pending "nextTurn" messages
  │   └─ Custom messages from extensions
  ├─ Emit before_agent_start (extension)
  ├─ Apply extension-modified system prompt
  └─ agent.prompt()
```

**Data flow**:
```
User input (text + images)
  → Extension command check
  → Input event (transform/handle)
  → Skill/template expansion
  → Message array construction
  → Extension before_agent_start
  → System prompt modification
  → Agent.prompt()
```

---

### 1.5 Flow: Agent State Management (agent.ts)

**File**: `packages/agent/src/agent.ts:434-538`

**Flow**:
```
runWithLifecycle()
  ├─ Create AbortController
  ├─ Set isStreaming = true
  ├─ Execute (runPromptMessages hoặc runContinuation)
  ├─ Handle failure (nếu có)
  └─ finishRun()

processEvents()
  ├─ Update internal state based on event type
  │   ├─ message_start → set streamingMessage
  │   ├─ message_update → update streamingMessage
  │   ├─ message_end → push to messages, clear streamingMessage
  │   ├─ tool_execution_start → add to pendingToolCalls
  │   ├─ tool_execution_end → remove from pendingToolCalls
  │   └─ turn_end → set errorMessage (nếu error)
  └─ Await all listeners
```

**Data flow**:
```
AgentEvent[]
  → Update _state
  → Await listeners (async)
  → Continue processing
```

---

## PHẦN 2: MESO-LEVEL FLOWS (Component/Module)

### 2.1 Flow: Agent Package (pi-agent-core)

**Architecture**:
```
Agent (stateful wrapper)
  ├─ AgentLoop (execution logic)
  │   ├─ streamAssistantResponse()
  │   └─ executeToolCalls()
  ├─ Event system (listeners)
  └─ Queue management (steering, follow-up)
```

**Complete flow**:
```
User calls agent.prompt()
  → Agent.runWithLifecycle()
  → AgentLoop.runAgentLoop()
  → AgentLoop.runLoop()
  ├─ Loop iterations:
  │   ├─ streamAssistantResponse()
  │   │   ├─ transformContext() [optional]
  │   │   ├─ convertToLlm()
  │   │   ├─ streamFn() [pi-ai]
  │   │   └─ Emit events
  │   ├─ executeToolCalls()
  │   │   ├─ prepareToolCall()
  │   │   ├─ executePreparedToolCall()
  │   │   └─ finalizeExecutedToolCall()
  │   └─ Check queues (steering, follow-up)
  └─ Agent.processEvents()
      → Update state
      → Notify listeners
```

**Key integration points**:
- `convertToLlm()`: Transform AgentMessage[] → Message[] (LLM format)
- `streamFn`: Delegate to pi-ai for actual streaming
- `beforeToolCall`/`afterToolCall`: Extension hooks
- Event listeners: Notify external systems (TUI, extensions)

---

### 2.2 Flow: AI Package (pi-ai)

**Architecture**:
```
streamSimple (main entry)
  ├─ API Registry (provider selection)
  ├─ Provider implementations
  │   ├─ Anthropic (streamAnthropic)
  │   ├─ OpenAI (streamOpenAI)
  │   └─ Others
  └─ Event stream (AssistantMessageEventStream)
```

**Complete flow**:
```
Agent calls streamSimple()
  → API Registry resolves provider
  → Provider's stream function (e.g., streamAnthropic)
  ├─ Create provider client
  ├─ Build provider-specific params
  ├─ Call provider API
  ├─ Parse streaming response
  ├─ Build AssistantMessage incrementally
  └─ Push events to stream
      → start, text_*, thinking_*, toolcall_*, done/error
```

**Key integration points**:
- `Context`: Input format (systemPrompt, messages, tools)
- `AssistantMessageEventStream`: Output format (event-based)
- Provider abstraction: Multiple providers, unified interface
- Cost calculation: Automatic token counting and cost estimation

---

### 2.3 Flow: Agent Session (coding-agent)

**Architecture**:
```
AgentSession (orchestrator)
  ├─ Agent (pi-agent-core)
  ├─ SessionManager (persistence)
  ├─ SettingsManager (configuration)
  ├─ ExtensionRunner (extensions)
  ├─ ModelRegistry (auth & models)
  └─ ResourceLoader (skills, prompts, context)
```

**Complete flow**:
```
User calls session.prompt()
  ├─ Handle extension commands
  ├─ Emit input event (extensions)
  ├─ Expand skills/templates
  ├─ Validate model & auth
  ├─ Check compaction
  ├─ Build messages
  ├─ Emit before_agent_start (extensions)
  ├─ Apply system prompt modifications
  ├─ agent.prompt()
  ├─ waitForRetry() (auto-retry logic)
  └─ Event handling:
      ├─ _handleAgentEvent()
      ├─ _emitExtensionEvent()
      ├─ Session persistence
      ├─ Auto-compaction check
      └─ Auto-retry check
```

**Key integration points**:
- Agent orchestration: Wraps pi-agent-core Agent
- Session persistence: Saves messages to disk
- Extension system: Hooks into agent lifecycle
- Model management: API key resolution, model cycling
- Compaction: Context management for long sessions

---

### 2.4 Flow: Extension System (coding-agent)

**Architecture**:
```
ExtensionRunner
  ├─ Extension loading
  ├─ Event emission
  ├─ Command registration
  ├─ Tool registration
  └─ UI context
```

**Complete flow**:
```
Extension loaded
  → ExtensionRunner created
  → Bind to AgentSession
  ├─ Register commands
  ├─ Register tools
  └─ Subscribe to events

Agent lifecycle events
  → ExtensionRunner.emit()
  → Extension handlers called
  → Return results (optional)
  → Modify behavior (optional)
```

**Extension events**:
- `agent_start`, `agent_end`
- `turn_start`, `turn_end`
- `message_start`, `message_update`, `message_end`
- `tool_execution_start`, `tool_execution_update`, `tool_execution_end`
- `input` (user input interception)
- `tool_call`, `tool_result` (tool call/result interception)
- `before_agent_start` (modify system prompt)
- `model_select`, `session_start`, `session_shutdown`

---

## PHẦN 3: MACRO-LEVEL FLOWS (Package-level)

### 3.1 Flow: coding-agent → pi-agent-core → pi-ai

**Architecture**:
```
coding-agent (CLI)
  ├─ AgentSession (orchestration)
  ├─ InteractiveMode (TUI)
  └─ Extensions

pi-agent-core (Agent logic)
  ├─ Agent (state management)
  └─ AgentLoop (execution)

pi-ai (AI providers)
  ├─ streamSimple (unified interface)
  └─ Provider implementations
```

**Complete flow**:
```
User input in CLI
  → InteractiveMode captures input
  → AgentSession.prompt()
  ├─ Extension command handling
  ├─ Skill/template expansion
  ├─ Model & auth validation
  ├─ Message construction
  └─ Agent.prompt()
      → Agent.runWithLifecycle()
      → AgentLoop.runAgentLoop()
      → AgentLoop.runLoop()
          ├─ streamAssistantResponse()
          │   ├─ convertToLlm()
          │   └─ streamSimple()
          │       → Provider stream function
          │       → API call
          │       → Parse events
          │       → Build AssistantMessage
          │       → Return stream
          └─ executeToolCalls()
              ├─ Tool execution
              └─ Tool results

Events flow back:
  → Agent.processEvents()
  → AgentSession._handleAgentEvent()
  ├─ Session persistence
  ├─ Extension events
  ├─ Auto-compaction
  └─ Auto-retry

TUI updates:
  → Subscribe to AgentSession events
  → Render messages
  → Update UI
```

**Data transformations**:
1. User input → AgentMessage (user role)
2. AgentMessage[] → Message[] (LLM format)
3. LLM response → AssistantMessage (streaming)
4. Tool calls → ToolResultMessage
5. All messages → Session entries (persistence)

---

### 3.2 Flow: TUI Integration (pi-tui)

**Architecture**:
```
pi-tui (Terminal UI)
  ├─ TUI (main class)
  ├─ Terminal (interface)
  ├─ Keys (keyboard handling)
  └─ Components (rendering)

coding-agent (InteractiveMode)
  ├─ AgentSession
  ├─ Event subscription
  └─ UI updates
```

**Complete flow**:
```
TUI initialization
  → Create Terminal
  → Setup key bindings
  → Create components
  → Start render loop

User interaction
  → Key press captured
  → Key handler called
  ├─ Input mode: Capture text
  ├─ Command mode: Execute command
  └─ Navigation: Move cursor

Agent events
  → AgentSession emits events
  → InteractiveMode subscribes
  → Update UI state
  → Trigger re-render
  → Display to user

Streaming updates
  → message_start: Show placeholder
  → message_update: Update content incrementally
  → message_end: Finalize display
  → tool_execution_start: Show tool call
  → tool_execution_update: Show progress
  → tool_execution_end: Show result
```

---

## PHẦN 4: SYSTEM-LEVEL FLOWS (End-to-End)

### 4.1 Flow: Complete User Interaction

**Scenario**: User types "Create a hello world function in Python"

```
1. User Input
   ├─ TUI captures keystrokes
   ├─ Display in input field
   └─ User presses Enter

2. Input Processing
   ├─ InteractiveMode receives input
   ├─ AgentSession.prompt(text)
   ├─ Check for extension commands (none)
   ├─ Emit input event (extensions)
   ├─ Expand skills/templates (none)
   ├─ Validate model & auth (OK)
   ├─ Check compaction (not needed)
   └─ Build user message

3. Agent Execution
   ├─ Agent.prompt(userMessage)
   ├─ Agent.runWithLifecycle()
   ├─ AgentLoop.runAgentLoop()
   ├─ Emit agent_start, turn_start
   ├─ Emit message_start, message_end (user message)

4. LLM Request
   ├─ streamAssistantResponse()
   ├─ convertToLlm() → Message[]
   ├─ streamSimple()
   ├─ Provider: Anthropic
   ├─ Build API params
   ├─ Call API
   └─ Stream response

5. Streaming Response
   ├─ message_start: Show "Thinking..."
   ├─ thinking_start: Show thinking block
   ├─ thinking_delta: Update thinking
   ├─ thinking_end: Finalize thinking
   ├─ text_start: Start response
   ├─ text_delta: "I'll create a hello world function..."
   ├─ text_end: Complete text
   ├─ toolcall_start: Show write tool call
   ├─ toolcall_delta: Show file path
   └─ toolcall_end: Complete tool call

6. Tool Execution
   ├─ executeToolCalls()
   ├─ prepareToolCall(write)
   ├─ beforeToolCall hook (extensions)
   ├─ executePreparedToolCall()
   │   ├─ Write file to disk
   │   └─ Emit partial results
   ├─ afterToolCall hook (extensions)
   └─ emitToolCallOutcome()

7. Tool Result
   ├─ Create ToolResultMessage
   ├─ Emit message_start, message_end
   ├─ Add to context
   └─ Continue loop

8. Final Response
   ├─ LLM receives tool result
   ├─ Generate final response
   ├─ Stream text deltas
   ├─ Complete message
   └─ Emit turn_end, agent_end

9. Session Persistence
   ├─ Save user message
   ├─ Save assistant message
   ├─ Save tool result
   └─ Write to session file

10. UI Update
    ├─ Display all messages
    ├─ Show tool execution
    ├─ Update footer (tokens, cost)
    └─ Ready for next input
```

---

### 4.2 Flow: Extension Command Execution

**Scenario**: User types "/model"

```
1. User Input
   ├─ TUI captures "/model"
   └─ User presses Enter

2. Command Detection
   ├─ AgentSession.prompt("/model")
   ├─ Detects "/" prefix
   ├─ _tryExecuteExtensionCommand()
   └─ Parse command: "model"

3. Command Lookup
   ├─ ExtensionRunner.getCommand("model")
   ├─ Find registered command
   └─ Get command handler

4. Command Execution
   ├─ Create command context
   ├─ Call command.handler("", ctx)
   ├─ Command shows model selector
   ├─ User selects model
   └─ Command calls ctx.setModel()

5. Model Change
   ├─ AgentSession.setModel()
   ├─ Validate auth
   ├─ Update agent.state.model
   ├─ Append ModelChangeEntry
   ├─ Save to settings
   ├─ Emit model_select event
   └─ Rebuild system prompt

6. UI Update
   ├─ Display model selector
   ├─ Show selected model
   ├─ Update footer
    └─ Ready for next input
```

---

### 4.3 Flow: Session Compaction

**Scenario**: Session exceeds context threshold

```
1. Context Check
   ├─ Agent completes turn
   ├─ _checkCompaction()
   ├─ Calculate context tokens
   ├─ Check against threshold
   └─ Compaction needed

2. Compaction Start
   ├─ Emit compaction_start event
   ├─ Create AbortController
   ├─ Find cut point
   └─ Prepare compaction

3. Branch Summary
   ├─ collectEntriesForBranchSummary()
   ├─ generateBranchSummary()
   ├─ LLM call for summary
   └─ Get summary text

4. Compaction
   ├─ compact()
   ├─ Remove old messages
   ├─ Add CompactionEntry
   ├─ Add BranchSummaryEntry
   └─ Update session

5. Persistence
   ├─ Save compacted session
   ├─ Update session file
   └─ Emit compaction_end event

6. UI Update
   ├─ Show compaction in progress
   ├─ Display summary
   ├─ Update message count
   └─ Continue with reduced context
```

---

### 4.4 Flow: Auto-Retry on Error

**Scenario**: LLM returns rate limit error

```
1. Error Detection
   ├─ Agent completes turn
   ├─ _checkCompaction()
   ├─ Check last assistant message
   ├─ Detect error: rate limit
   └─ _isRetryableError() → true

2. Retry Setup
   ├─ Create retry promise
   ├─ Get retry settings
   ├─ Calculate delay (exponential backoff)
   └─ Emit auto_retry_start event

3. Wait Period
   ├─ Sleep for delay
   ├─ Check abort signal
   └─ Continue if not aborted

4. Retry Execution
   ├─ agent.continue()
   ├─ AgentLoop.runAgentLoopContinue()
   ├─ Reuse last message
   ├─ Call LLM again
   └─ Get new response

5. Success Handling
   ├─ Response successful
   ├─ Reset retry counter
   ├─ Emit auto_retry_end (success)
   └─ Continue normally

6. Failure Handling
   ├─ Max retries reached
   ├─ Stop retrying
   ├─ Emit auto_retry_end (failure)
   └─ Show error to user
```

---

### 4.5 Flow: Tool Call with Extension Interception

**Scenario**: Extension intercepts bash tool call

```
1. Tool Call Generated
   ├─ LLM generates tool call
   ├─ AssistantMessage with toolCall
   └─ AgentLoop processes

2. Tool Call Preparation
   ├─ prepareToolCall()
   ├─ Validate arguments
   ├─ beforeToolCall hook
   └─ Extension intercepts

3. Extension Interception
   ├─ ExtensionRunner.emitToolCall()
   ├─ Extension handler called
   ├─ Handler checks command
   ├─ Handler returns { block: true, reason: "..." }
   └─ Tool execution blocked

4. Error Result
   ├─ Immediate outcome
   ├─ Create error result
   ├─ emitToolCallOutcome()
   └─ Return to LLM

5. LLM Response
   ├─ Receives error result
   ├─ Adjusts behavior
   ├─ Tries alternative
   └─ Continues execution
```

---

## PHẦN 5: DATA FLOW DIAGRAMS

### 5.1 Message Flow Through System

```
User Input
    ↓
AgentSession.prompt()
    ↓
[Extension Command Check]
    ↓ (if not command)
[Input Event - Extensions]
    ↓
[Skill/Template Expansion]
    ↓
AgentMessage (user role)
    ↓
Agent.prompt()
    ↓
AgentLoop.runAgentLoop()
    ↓
[Transform Context - optional]
    ↓
convertToLlm()
    ↓
Message[] (LLM format)
    ↓
streamSimple()
    ↓
Provider API Call
    ↓
Streaming Response
    ↓
AssistantMessage (streaming)
    ↓
[Tool Calls?]
    ↓ (if yes)
executeToolCalls()
    ↓
ToolResultMessage[]
    ↓
[Add to Context]
    ↓
[Repeat or End]
    ↓
Session Persistence
```

---

### 5.2 Event Flow Through System

```
AgentLoop emits events
    ↓
Agent.processEvents()
    ↓
Update Agent State
    ↓
Notify Listeners
    ↓
AgentSession._handleAgentEvent()
    ↓
├─ Session Persistence
├─ Extension Events
├─ Auto-compaction
└─ Auto-retry
    ↓
AgentSession._emit()
    ↓
Notify External Listeners
    ↓
InteractiveMode (TUI)
    ↓
Update UI
    ↓
Render to Terminal
```

---

### 5.3 Tool Execution Flow

```
AssistantMessage with toolCalls
    ↓
executeToolCalls()
    ↓
[Sequential or Parallel?]
    ↓
For each toolCall:
    ↓
prepareToolCall()
    ├─ Find tool
    ├─ Validate args
    └─ beforeToolCall hook
    ↓
executePreparedToolCall()
    ├─ tool.execute()
    ├─ Partial results
    └─ Emit updates
    ↓
finalizeExecutedToolCall()
    └─ afterToolCall hook
    ↓
emitToolCallOutcome()
    ↓
ToolResultMessage
    ↓
Add to Context
```

---

## PHẦN 6: INTEGRATION POINTS

### 6.1 coding-agent → pi-agent-core

**Integration points**:
1. **Agent instantiation**: `new Agent(options)`
2. **Event subscription**: `agent.subscribe(listener)`
3. **Prompt execution**: `agent.prompt(messages)`
4. **Queue management**: `agent.steer()`, `agent.followUp()`
5. **State access**: `agent.state`
6. **Abort control**: `agent.abort()`, `agent.waitForIdle()`

**Data flow**:
- coding-agent provides: tools, system prompt, model, hooks
- pi-agent-core provides: execution logic, events, state management

---

### 6.2 pi-agent-core → pi-ai

**Integration points**:
1. **Stream function**: `streamFn` parameter
2. **Context transformation**: `convertToLlm()`
3. **Model configuration**: `Model` type
4. **API key resolution**: `getApiKey()`
5. **Event streaming**: `AssistantMessageEventStream`

**Data flow**:
- pi-agent-core provides: AgentContext, AgentLoopConfig
- pi-ai provides: streaming response, AssistantMessage

---

### 6.3 coding-agent → pi-tui

**Integration points**:
1. **Event subscription**: `session.subscribe(listener)`
2. **UI updates**: Render messages, tool execution
3. **Input handling**: Capture user input
4. **Key bindings**: Handle keyboard shortcuts
5. **Terminal control**: Manage screen, cursor

**Data flow**:
- coding-agent provides: events, state
- pi-tui provides: UI rendering, input capture

---

### 6.4 Extension System Integration

**Integration points**:
1. **AgentSession**: ExtensionRunner binding
2. **Agent**: beforeToolCall, afterToolCall hooks
3. **Events**: All agent events forwarded to extensions
4. **Commands**: Extension command registration
5. **Tools**: Extension tool registration
6. **UI**: Extension UI context

**Data flow**:
- Extensions provide: handlers, tools, commands
- System provides: events, context, API

---

## PHẦN 7: FLOW PATTERNS

### 7.1 Event-Driven Pattern

**Description**: System uses event-driven architecture throughout

**Flow**:
```
Action occurs
    ↓
Emit event
    ↓
Event queue processes
    ↓
Listeners notified
    ↓
Listeners react
    ↓
State updated
    ↓
Side effects occur
```

**Examples**:
- Agent lifecycle events (agent_start, agent_end)
- Message events (message_start, message_update, message_end)
- Tool execution events (tool_execution_start, tool_execution_update, tool_execution_end)
- Extension events (all agent events forwarded)

---

### 7.2 Streaming Pattern

**Description**: LLM responses are streamed incrementally

**Flow**:
```
Start streaming
    ↓
Emit start event
    ↓
For each chunk:
    ↓
Emit delta event
    ↓
Update partial message
    ↓
Notify listeners
    ↓
End streaming
    ↓
Emit done event
    ↓
Return final message
```

**Examples**:
- Text streaming (text_start, text_delta, text_end)
- Thinking streaming (thinking_start, thinking_delta, thinking_end)
- Tool call streaming (toolcall_start, toolcall_delta, toolcall_end)

---

### 7.3 Loop Pattern

**Description**: Agent uses nested loops for execution

**Flow**:
```
Outer loop (follow-up messages)
    ↓
Inner loop (tool calls + steering)
    ↓
Process pending messages
    ↓
Stream assistant response
    ↓
Execute tool calls (if any)
    ↓
Check for more tool calls
    ↓ (if yes)
Repeat inner loop
    ↓ (if no)
Check for follow-up messages
    ↓ (if yes)
Repeat outer loop
    ↓ (if no)
Exit
```

**Examples**:
- AgentLoop.runLoop()
- Tool execution (sequential or parallel)

---

### 7.4 Hook Pattern

**Description**: Extensions can hook into execution points

**Flow**:
```
Execution point reached
    ↓
Call hook (if registered)
    ↓
Hook executes
    ↓
Hook returns result
    ↓
Modify behavior (optional)
    ↓
Continue execution
```

**Examples**:
- beforeToolCall: Intercept before tool execution
- afterToolCall: Modify tool result
- before_agent_start: Modify system prompt
- input: Intercept user input

---

### 7.5 Queue Pattern

**Description**: Messages can be queued for later processing

**Flow**:
```
Queue message
    ↓
Add to queue
    ↓
Emit queue_update event
    ↓
Wait for appropriate time
    ↓
Drain queue
    ↓
Process messages
    ↓
Clear queue
```

**Examples**:
- Steering queue: Inject before next LLM call
- Follow-up queue: Process after agent would stop
- Bash messages: Queue for display

---

## PHẦN 8: ERROR FLOWS

### 8.1 Tool Execution Error

**Flow**:
```
Tool execution fails
    ↓
Catch error
    ↓
Create error result
    ↓
emitToolCallOutcome()
    ↓
ToolResultMessage with isError=true
    ↓
Add to context
    ↓
LLM receives error
    ↓
LLM adjusts behavior
```

---

### 8.2 LLM API Error

**Flow**:
```
API call fails
    ↓
Catch error
    ↓
Create error message
    ↓
Emit error event
    ↓
Agent receives error
    ↓
Check if retryable
    ↓ (if yes)
Auto-retry
    ↓ (if no)
Show error to user
```

---

### 8.3 Validation Error

**Flow**:
```
Tool call validation fails
    ↓
Immediate error outcome
    ↓
Block tool execution
    ↓
Return error result
    ↓
LLM receives error
    ↓
LLM tries again
```

---

## PHẦN 9: PERFORMANCE FLOWS

### 9.1 Parallel Tool Execution

**Flow**:
```
Multiple tool calls
    ↓
Prepare all calls
    ↓
Execute in parallel
    ↓
Wait for all to complete
    ↓
Collect results
    ↓
Return all results
```

**Benefits**:
- Faster execution for independent tools
- Better resource utilization

---

### 9.2 Streaming Updates

**Flow**:
```
Tool execution starts
    ↓
Emit partial results
    ↓
Update UI incrementally
    ↓
User sees progress
    ↓
Tool completes
    ↓
Final result shown
```

**Benefits**:
- Better user experience
- Immediate feedback
- Perceived faster execution

---

### 9.3 Context Compaction

**Flow**:
```
Context exceeds threshold
    ↓
Generate summary
    ↓
Remove old messages
    ↓
Add summary entry
    ↓
Continue with reduced context
```

**Benefits**:
- Manage long sessions
- Reduce token usage
- Lower costs

---

## PHẦN 10: SECURITY FLOWS

### 10.1 Tool Call Validation

**Flow**:
```
Tool call received
    ↓
Validate arguments
    ↓
Check against schema
    ↓
Prepare arguments
    ↓
Execute tool
```

**Security measures**:
- Schema validation
- Type checking
- Argument sanitization

---

### 10.2 API Key Management

**Flow**:
```
Model selected
    ↓
Check for API key
    ↓
Resolve from registry
    ↓
Validate key
    ↓
Use for API call
```

**Security measures**:
- Secure storage
- OAuth support
- Key rotation

---

### 10.3 Abort Control

**Flow**:
```
User requests abort
    ↓
Set abort signal
    ↓
Check signal in loops
    ↓
Stop execution
    ↓
Clean up resources
    ↓
Return to idle
```

**Security measures**:
- Graceful shutdown
- Resource cleanup
- State consistency

---

## KẾT LUẬN

Hệ thống Kilo có kiến trúc flow phức tạp nhưng được tổ chức tốt:

1. **Micro-level**: Các hàm individual có trách nhiệm rõ ràng
2. **Meso-level**: Components được tích hợp chặt chẽ qua events
3. **Macro-level**: Packages có trách nhiệm phân tán rõ ràng
4. **System-level**: End-to-end flows mượt mà và hiệu quả

**Điểm mạnh**:
- Event-driven architecture cho phép mở rộng dễ dàng
- Streaming pattern cung cấp UX tốt
- Hook pattern cho phép extensions tùy biến
- Queue pattern hỗ trợ interaction phức tạp

**Điểm cần cải thiện**:
- Documentation cho flows cần chi tiết hơn
- Error handling có thể thống nhất hơn
- Performance monitoring cần được thêm
- Security flows cần được audit kỹ hơn
