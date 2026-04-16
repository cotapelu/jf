# BÁO CÁO CHI TIẾT - packages/agent/

## Tổng quan

Package `packages/agent/` là một thư viện agent-based AI với state management, event-driven architecture, và support cho tool execution, message queuing, và proxy streaming.

**Thống kê:**
- Tổng số file source: 5 files
- Tổng số dòng code: ~1,500+ lines
- Số test files: 4 files
- Dependencies: @mariozechner/pi-ai

---

## 1. Core Types (types.ts)

### 1.1 AgentMessage

```typescript
export interface AgentMessage {
  role: "user" | "assistant" | "toolResult";
  content: Array<TextContent | ImageContent | ThinkingContent | ToolCall>;
  timestamp: number;
  api?: string;
  provider?: string;
  model?: string;
  usage?: Usage;
  stopReason?: StopReason;
  errorMessage?: string;
}
```

**Đặc điểm:**
- Unified message format cho tất cả roles
- Support text, images, thinking, và tool calls
- Metadata: timestamp, api, provider, model
- Usage tracking: input, output, cache read/write tokens
- Error handling với errorMessage

### 1.2 AgentTool

```typescript
export interface AgentTool<TArgs = any> {
  name: string;
  description: string;
  inputSchema: JSONSchema7;
  execute: (args: TArgs, signal?: AbortSignal) => Promise<ToolResult>;
}
```

**Đặc điểm:**
- Generic type cho arguments
- JSON Schema cho input validation
- Async execute với AbortSignal support
- Returns ToolResult

### 1.3 AgentState

```typescript
export interface AgentState {
  systemPrompt: string;
  model: Model<any>;
  thinkingLevel: "off" | "low" | "medium" | "high";
  tools: AgentTool<any>[];
  messages: AgentMessage[];
  isStreaming: boolean;
  streamingMessage?: AgentMessage;
  pendingToolCalls: Set<string>;
  errorMessage?: string;
}
```

**Đặc điểm:**
- Immutable state (read-only)
- Runtime state: isStreaming, streamingMessage, pendingToolCalls
- Error state: errorMessage
- Mutable via setters (copies arrays)

### 1.4 AgentContext

```typescript
export interface AgentContext {
  systemPrompt: string;
  messages: AgentMessage[];
  tools: AgentTool<any>[];
}
```

**Đặc điểm:**
- Snapshot của agent state
- Passed to agent loop
- Used cho context transformation

### 1.5 AgentEvent

```typescript
export type AgentEvent =
  | { type: "agent_start" }
  | { type: "message_start"; message: AgentMessage }
  | { type: "message_update"; message: AgentMessage }
  | { type: "message_end"; message: AgentMessage }
  | { type: "tool_execution_start"; toolCallId: string }
  | { type: "tool_execution_end"; toolCallId: string }
  | { type: "turn_end"; message: AgentMessage }
  | { type: "agent_end"; messages: AgentMessage[] };
```

**Event Types:**
- `agent_start`: Agent bắt đầu processing
- `message_start`: Message mới bắt đầu streaming
- `message_update`: Message content updated
- `message_end`: Message hoàn thành
- `tool_execution_start`: Tool execution bắt đầu
- `tool_execution_end`: Tool execution hoàn thành
- `turn_end`: Turn (user/assistant exchange) hoàn thành
- `agent_end`: Agent hoàn thành (final event)

### 1.6 AgentLoopConfig

```typescript
export interface AgentLoopConfig {
  model: Model<any>;
  reasoning?: "low" | "medium" | "high";
  sessionId?: string;
  onPayload?: SimpleStreamOptions["onPayload"];
  transport?: Transport;
  thinkingBudgets?: ThinkingBudgets;
  maxRetryDelayMs?: number;
  toolExecution?: ToolExecutionMode;
  beforeToolCall?: (context: BeforeToolCallContext, signal?: AbortSignal) => Promise<BeforeToolCallResult | undefined>;
  afterToolCall?: (context: AfterToolCallContext, signal?: AbortSignal) => Promise<AfterToolCallResult | undefined>;
  convertToLlm?: (messages: AgentMessage[]) => Message[] | Promise<Message[]>;
  transformContext?: (messages: AgentMessage[], signal?: AbortSignal) => Promise<AgentMessage[]>;
  getApiKey?: (provider: string) => Promise<string | undefined> | string | undefined;
  getSteeringMessages: () => Promise<AgentMessage[]>;
  getFollowUpMessages: () => Promise<AgentMessage[]>;
}
```

**Đặc điểm:**
- Configuration cho agent loop
- Tool execution hooks (before/after)
- Context transformation hooks
- Message conversion hooks
- Queue management hooks

### 1.7 ToolExecutionMode

```typescript
export type ToolExecutionMode = "parallel" | "sequential";
```

**Modes:**
- `parallel`: Execute all tools concurrently
- `sequential`: Execute tools one at a time

### 1.8 StreamFn

```typescript
export type StreamFn = (
  model: Model<any>,
  context: Context,
  options: SimpleStreamOptions
) => EventStream<AssistantMessageEvent, AssistantMessage>;
```

**Đặc điểm:**
- Generic stream function interface
- Takes model, context, và options
- Returns EventStream

---

## 2. Agent Loop (agent-loop.ts)

### 2.1 Purpose

Low-level agent loop implementation. Handles:
- Message processing
- Tool execution
- Event emission
- Queue management
- Context transformation

### 2.2 Key Functions

#### runAgentLoop

```typescript
export function runAgentLoop(
  initialMessages: AgentMessage[],
  context: AgentContext,
  config: AgentLoopConfig,
  emitEvent: (event: AgentEvent) => void,
  signal: AbortSignal,
  streamFn: StreamFn
): Promise<void>
```

**Flow:**
1. Emit `agent_start`
2. Process initial messages
3. Loop:
   - Get steering messages
   - Transform context
   - Convert to LLM format
   - Stream response
   - Execute tools
   - Emit events
   - Get follow-up messages
   - Repeat until no more messages
4. Emit `agent_end`

#### runAgentLoopContinue

```typescript
export function runAgentLoopContinue(
  context: AgentContext,
  config: AgentLoopConfig,
  emitEvent: (event: AgentEvent) => void,
  signal: AbortSignal,
  streamFn: StreamFn
): Promise<void>
```

**Flow:**
1. Check last message role
2. If assistant:
   - Drain steering queue
   - Drain follow-up queue
   - If no messages, throw error
3. Run agent loop with queued messages

### 2.3 Tool Execution

**Parallel Execution:**
```typescript
const toolPromises = toolCalls.map((toolCall) =>
  executeTool(toolCall, signal)
);
await Promise.all(toolPromises);
```

**Sequential Execution:**
```typescript
for (const toolCall of toolCalls) {
  const result = await executeTool(toolCall, signal);
  // Add result to context
}
```

**Tool Execution Hooks:**
- `beforeToolCall`: Called before tool execution
- `afterToolCall`: Called after tool execution

### 2.4 Context Transformation

```typescript
if (config.transformContext) {
  context.messages = await config.transformContext(context.messages, signal);
}
```

**Use Cases:**
- Filter messages
- Add system context
- Modify messages
- Apply transformations

### 2.5 Message Conversion

```typescript
const llmMessages = config.convertToLlm
  ? await config.convertToLlm(context.messages)
  : defaultConvertToLlm(context.messages);
```

**Default Conversion:**
```typescript
function defaultConvertToLlm(messages: AgentMessage[]): Message[] {
  return messages.filter(
    (message) =>
      message.role === "user" ||
      message.role === "assistant" ||
      message.role === "toolResult"
  );
}
```

---

## 3. Agent Class (agent.ts - 539 lines)

### 3.1 Purpose

Stateful wrapper around agent loop. Provides:
- State management
- Event subscription
- Message queuing
- Lifecycle management
- Abort control

### 3.2 Constructor Options

```typescript
export interface AgentOptions {
  initialState?: Partial<AgentState>;
  convertToLlm?: (messages: AgentMessage[]) => Message[] | Promise<Message[]>;
  transformContext?: (messages: AgentMessage[], signal?: AbortSignal) => Promise<AgentMessage[]>;
  streamFn?: StreamFn;
  getApiKey?: (provider: string) => Promise<string | undefined> | string | undefined;
  onPayload?: SimpleStreamOptions["onPayload"];
  beforeToolCall?: (context: BeforeToolCallContext, signal?: AbortSignal) => Promise<BeforeToolCallResult | undefined>;
  afterToolCall?: (context: AfterToolCallContext, signal?: AbortSignal) => Promise<AfterToolCallResult | undefined>;
  steeringMode?: QueueMode;
  followUpMode?: QueueMode;
  sessionId?: string;
  thinkingBudgets?: ThinkingBudgets;
  transport?: Transport;
  maxRetryDelayMs?: number;
  toolExecution?: ToolExecutionMode;
}
```

### 3.3 State Management

**Mutable State:**
```typescript
type MutableAgentState = Omit<AgentState, "isStreaming" | "streamingMessage" | "pendingToolCalls" | "errorMessage"> & {
  isStreaming: boolean;
  streamingMessage?: AgentMessage;
  pendingToolCalls: Set<string>;
  errorMessage?: string;
};
```

**State Access:**
```typescript
get state(): AgentState {
  return this._state;
}
```

**State Mutators:**
```typescript
// Copies arrays on assignment
set tools(nextTools: AgentTool<any>[]) {
  tools = nextTools.slice();
}

set messages(nextMessages: AgentMessage[]) {
  messages = nextMessages.slice();
}
```

### 3.4 Event Subscription

```typescript
subscribe(listener: (event: AgentEvent, signal: AbortSignal) => Promise<void> | void): () => void
```

**Features:**
- Subscribe to all agent events
- Listeners receive active abort signal
- Listeners are awaited in subscription order
- Returns unsubscribe function

**Listener Lifecycle:**
1. Event emitted
2. All listeners called (in order)
3. Listeners awaited
4. Run considered idle after all listeners settle

### 3.5 Message Queuing

**Queue Modes:**
```typescript
type QueueMode = "all" | "one-at-a-time";
```

**Steering Queue:**
```typescript
steer(message: AgentMessage): void
clearSteeringQueue(): void
```

**Follow-up Queue:**
```typescript
followUp(message: AgentMessage): void
clearFollowUpQueue(): void
```

**Queue Behavior:**
- `all`: Drain all messages at once
- `one-at-a-time`: Drain one message per turn

**Queue Usage:**
```typescript
// Steering: Inject after current assistant turn
agent.steer({ role: "user", content: "Correction" });

// Follow-up: Run after agent would stop
agent.followUp({ role: "user", content: "Next question" });
```

### 3.6 Lifecycle Methods

#### prompt

```typescript
async prompt(message: AgentMessage | AgentMessage[]): Promise<void>
async prompt(input: string, images?: ImageContent[]): Promise<void>
```

**Behavior:**
- Start new prompt from text, message, or batch
- Throws if already processing
- Normalizes input to AgentMessage[]
- Runs agent loop

**Input Normalization:**
```typescript
private normalizePromptInput(
  input: string | AgentMessage | AgentMessage[],
  images?: ImageContent[]
): AgentMessage[] {
  if (Array.isArray(input)) return input;
  if (typeof input !== "string") return [input];
  
  const content: Array<TextContent | ImageContent> = [
    { type: "text", text: input }
  ];
  if (images && images.length > 0) {
    content.push(...images);
  }
  return [{ role: "user", content, timestamp: Date.now() }];
}
```

#### continue

```typescript
async continue(): Promise<void>
```

**Behavior:**
- Continue from current transcript
- Last message must be user or tool-result
- If last message is assistant:
  - Drain steering queue
  - Drain follow-up queue
  - If no messages, throw error

**Flow:**
1. Check if already processing
2. Check last message role
3. If assistant, drain queues
4. Run continuation

#### reset

```typescript
reset(): void
```

**Behavior:**
- Clear transcript state
- Clear runtime state
- Clear queued messages

### 3.7 Abort Control

```typescript
get signal(): AbortSignal | undefined
abort(): void
waitForIdle(): Promise<void>
```

**Features:**
- Get active abort signal
- Abort current run
- Wait for idle (after listeners settle)

### 3.8 Event Processing

```typescript
private async processEvents(event: AgentEvent): Promise<void>
```

**State Updates:**
```typescript
switch (event.type) {
  case "message_start":
    this._state.streamingMessage = event.message;
    break;
  
  case "message_update":
    this._state.streamingMessage = event.message;
    break;
  
  case "message_end":
    this._state.streamingMessage = undefined;
    this._state.messages.push(event.message);
    break;
  
  case "tool_execution_start":
    this._state.pendingToolCalls.add(event.toolCallId);
    break;
  
  case "tool_execution_end":
    this._state.pendingToolCalls.delete(event.toolCallId);
    break;
  
  case "turn_end":
    if (event.message.errorMessage) {
      this._state.errorMessage = event.message.errorMessage;
    }
    break;
  
  case "agent_end":
    this._state.streamingMessage = undefined;
    break;
}
```

**Listener Invocation:**
```typescript
const signal = this.activeRun?.abortController.signal;
for (const listener of this.listeners) {
  await listener(event, signal);
}
```

### 3.9 Run Management

**Active Run:**
```typescript
type ActiveRun = {
  promise: Promise<void>;
  resolve: () => void;
  abortController: AbortController;
};
```

**Run Lifecycle:**
1. Create AbortController
2. Set streaming state
3. Execute with signal
4. Handle errors
5. Finish run

**Error Handling:**
```typescript
private async handleRunFailure(error: unknown, aborted: boolean): Promise<void> {
  const failureMessage = {
    role: "assistant",
    content: [{ type: "text", text: "" }],
    api: this._state.model.api,
    provider: this._state.model.provider,
    model: this._state.model.id,
    usage: EMPTY_USAGE,
    stopReason: aborted ? "aborted" : "error",
    errorMessage: error instanceof Error ? error.message : String(error),
    timestamp: Date.now(),
  };
  this._state.messages.push(failureMessage);
  this._state.errorMessage = failureMessage.errorMessage;
  await this.processEvents({ type: "agent_end", messages: [failureMessage] });
}
```

---

## 4. Proxy Streaming (proxy.ts - 340 lines)

### 4.1 Purpose

Proxy stream function cho apps that route LLM calls through a server. Server manages auth và proxies requests to LLM providers.

### 4.2 Proxy Event Types

```typescript
export type ProxyAssistantMessageEvent =
  | { type: "start" }
  | { type: "text_start"; contentIndex: number }
  | { type: "text_delta"; contentIndex: number; delta: string }
  | { type: "text_end"; contentIndex: number; contentSignature?: string }
  | { type: "thinking_start"; contentIndex: number }
  | { type: "thinking_delta"; contentIndex: number; delta: string }
  | { type: "thinking_end"; contentIndex: number; contentSignature?: string }
  | { type: "toolcall_start"; contentIndex: number; id: string; toolName: string }
  | { type: "toolcall_delta"; contentIndex: number; delta: string }
  | { type: "toolcall_end"; contentIndex: number }
  | { type: "done"; reason: StopReason; usage: Usage }
  | { type: "error"; reason: StopReason; errorMessage?: string; usage: Usage };
```

**Đặc điểm:**
- Stripped partial field to reduce bandwidth
- Content index for multi-content messages
- Delta events for streaming
- Signature for content hashing

### 4.3 Proxy Stream Options

```typescript
export interface ProxyStreamOptions extends SimpleStreamOptions {
  authToken: string;
  proxyUrl: string;
}
```

### 4.4 streamProxy Function

```typescript
export function streamProxy(
  model: Model<any>,
  context: Context,
  options: ProxyStreamOptions
): ProxyMessageEventStream
```

**Flow:**
1. Initialize partial message
2. Setup abort handler
3. Fetch from proxy server
4. Parse SSE events
5. Process proxy events
6. Reconstruct partial message
7. Emit standard events

**Request Format:**
```typescript
{
  model,
  context,
  options: {
    temperature,
    maxTokens,
    reasoning,
  }
}
```

**Response Format:**
```
data: {"type":"start"}
data: {"type":"text_start","contentIndex":0}
data: {"type":"text_delta","contentIndex":0,"delta":"Hello"}
data: {"type":"text_end","contentIndex":0}
data: {"type":"done","reason":"stop","usage":{...}}
```

### 4.5 Event Processing

**Text Events:**
```typescript
case "text_start":
  partial.content[contentIndex] = { type: "text", text: "" };
  return { type: "text_start", contentIndex, partial };

case "text_delta":
  content.text += delta;
  return { type: "text_delta", contentIndex, delta, partial };

case "text_end":
  content.textSignature = contentSignature;
  return { type: "text_end", contentIndex, content, partial };
```

**Thinking Events:**
```typescript
case "thinking_start":
  partial.content[contentIndex] = { type: "thinking", thinking: "" };
  return { type: "thinking_start", contentIndex, partial };

case "thinking_delta":
  content.thinking += delta;
  return { type: "thinking_delta", contentIndex, delta, partial };

case "thinking_end":
  content.thinkingSignature = contentSignature;
  return { type: "thinking_end", contentIndex, content, partial };
```

**Tool Call Events:**
```typescript
case "toolcall_start":
  partial.content[contentIndex] = {
    type: "toolCall",
    id,
    name: toolName,
    arguments: {},
    partialJson: "",
  };
  return { type: "toolcall_start", contentIndex, partial };

case "toolcall_delta":
  (content as any).partialJson += delta;
  content.arguments = parseStreamingJson((content as any).partialJson) || {};
  return { type: "toolcall_delta", contentIndex, delta, partial };

case "toolcall_end":
  delete (content as any).partialJson;
  return { type: "toolcall_end", contentIndex, toolCall: content, partial };
```

**Completion Events:**
```typescript
case "done":
  partial.stopReason = reason;
  partial.usage = usage;
  return { type: "done", reason, message: partial };

case "error":
  partial.stopReason = reason;
  partial.errorMessage = errorMessage;
  partial.usage = usage;
  return { type: "error", reason, error: partial };
```

### 4.6 Error Handling

**Proxy Errors:**
```typescript
if (!response.ok) {
  let errorMessage = `Proxy error: ${response.status} ${response.statusText}`;
  try {
    const errorData = await response.json() as { error?: string };
    if (errorData.error) {
      errorMessage = `Proxy error: ${errorData.error}`;
    }
  } catch {
    // Couldn't parse error response
  }
  throw new Error(errorMessage);
}
```

**Abort Handling:**
```typescript
const abortHandler = () => {
  if (reader) {
    reader.cancel("Request aborted by user").catch(() => {});
  }
};

if (options.signal) {
  options.signal.addEventListener("abort", abortHandler);
}
```

---

## 5. Index (index.ts)

**Exports:**
```typescript
// Core Agent
export * from "./agent.js";

// Loop functions
export * from "./agent-loop.js";

// Proxy utilities
export * from "./proxy.js";

// Types
export * from "./types.js";
```

---

## 6. Architecture Patterns

### 6.1 Event-Driven Architecture

**Event Flow:**
```
Agent Loop → Emit Event → Listeners → Await → Next Event
```

**Event Types:**
- Lifecycle: agent_start, agent_end
- Message: message_start, message_update, message_end
- Tool: tool_execution_start, tool_execution_end
- Turn: turn_end

**Listener Behavior:**
- Called in subscription order
- Received active abort signal
- Awaited before next event
- Can modify state via agent API

### 6.2 State Management

**Immutable State Pattern:**
```typescript
get state(): AgentState {
  return this._state; // Read-only view
}
```

**Mutable Internal State:**
```typescript
private _state: MutableAgentState;
```

**State Updates:**
- Via event processing
- Via state mutators (copy-on-write)
- Via queue operations

### 6.3 Queue Management

**Queue Types:**
- Steering: Inject during current turn
- Follow-up: Run after agent stops

**Queue Modes:**
- `all`: Drain all at once
- `one-at-a-time`: Drain one per turn

**Queue Lifecycle:**
1. Enqueue message
2. Agent loop drains queue
3. Message processed
4. Repeat until empty

### 6.4 Abort Control

**Abort Signal Flow:**
```
Agent.abort() → AbortController.abort() → Signal.aborted → Stream/Tools Abort
```

**Abort Handling:**
- Stream checks signal periodically
- Tools receive signal in execute()
- Listeners receive signal
- Error message with stopReason: "aborted"

### 6.5 Tool Execution

**Execution Modes:**
- Parallel: `Promise.all(toolPromises)`
- Sequential: `for (const toolCall of toolCalls)`

**Tool Hooks:**
- `beforeToolCall`: Pre-execution hook
- `afterToolCall`: Post-execution hook

**Tool Result:**
```typescript
interface ToolResult {
  content: Array<TextContent | ImageContent>;
  isError?: boolean;
}
```

---

## 7. Testing

### 7.1 Test Coverage

**Test Files:**
- `test/agent-loop.test.ts`: Agent loop tests
- `test/agent.test.ts`: Agent class tests
- `test/e2e.test.ts`: End-to-end tests
- `test/utils/`: Test utilities

### 7.2 Agent Tests

**State Management:**
```typescript
it("should create an agent instance with default state")
it("should create an agent instance with custom initial state")
it("should update state with mutators")
```

**Event Subscription:**
```typescript
it("should subscribe to events")
it("should await async subscribers before prompt resolves")
it("waitForIdle should wait for async subscribers")
it("should pass the active abort signal to subscribers")
```

**Message Queuing:**
```typescript
it("should support steering message queue")
it("should support follow-up message queue")
```

**Lifecycle:**
```typescript
it("should handle abort controller")
it("should throw when prompt() called while streaming")
it("should throw when continue() called while streaming")
```

**Continuation:**
```typescript
it("continue() should process queued follow-up messages after an assistant turn")
it("continue() should keep one-at-a-time steering semantics from assistant tail")
```

**Configuration:**
```typescript
it("forwards sessionId to streamFn options")
```

### 7.3 Mock Stream

```typescript
class MockAssistantStream extends EventStream<AssistantMessageEvent, AssistantMessage> {
  constructor() {
    super(
      (event) => event.type === "done" || event.type === "error",
      (event) => {
        if (event.type === "done") return event.message;
        if (event.type === "error") return event.error;
        throw new Error("Unexpected event type");
      },
    );
  }
}
```

---

## 8. Dependencies

### 8.1 External Dependencies

**@mariozechner/pi-ai:**
- `EventStream`: Stream abstraction
- `AssistantMessageEvent`: Event types
- `AssistantMessage`: Message type
- `Model`: Model type
- `Context`: Context type
- `SimpleStreamOptions`: Stream options
- `parseStreamingJson`: JSON parsing utility
- `streamSimple`: Default stream function

### 8.2 Internal Dependencies

**None** - Package is self-contained

---

## 9. Configuration

### 9.1 Package Configuration

**package.json:**
```json
{
  "name": "@kilo/agent",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts"
}
```

### 9.2 Build Configuration

**tsconfig.build.json:**
- TypeScript build configuration
- Output to `dist/`
- Declaration generation

### 9.3 Test Configuration

**vitest.config.ts:**
- Vitest configuration
- Test environment setup

---

## 10. Use Cases

### 10.1 Basic Agent

```typescript
import { Agent } from "@kilo/agent";

const agent = new Agent({
  initialState: {
    systemPrompt: "You are a helpful assistant.",
    model: getModel("openai", "gpt-4o-mini"),
  },
});

// Subscribe to events
agent.subscribe((event, signal) => {
  console.log("Event:", event.type);
});

// Prompt
await agent.prompt("Hello, world!");

// Continue
await agent.continue();
```

### 10.2 Tool Execution

```typescript
const agent = new Agent({
  initialState: {
    tools: [
      {
        name: "search",
        description: "Search the web",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string" },
          },
        },
        execute: async (args, signal) => {
          const results = await search(args.query, signal);
          return { content: [{ type: "text", text: results }] };
        },
      },
    ],
  },
  toolExecution: "parallel", // or "sequential"
});
```

### 10.3 Message Queuing

```typescript
// Steering: Inject during current turn
agent.steer({
  role: "user",
  content: "Correction: Actually, I meant...",
});

// Follow-up: Run after agent stops
agent.followUp({
  role: "user",
  content: "Next question: What about...",
});

// Queue modes
agent.steeringMode = "all"; // or "one-at-a-time"
agent.followUpMode = "one-at-a-time";
```

### 10.4 Proxy Streaming

```typescript
import { streamProxy } from "@kilo/agent";

const agent = new Agent({
  streamFn: (model, context, options) =>
    streamProxy(model, context, {
      ...options,
      authToken: await getAuthToken(),
      proxyUrl: "https://genai.example.com",
    }),
});
```

### 10.5 Context Transformation

```typescript
const agent = new Agent({
  transformContext: async (messages, signal) => {
    // Filter messages
    const filtered = messages.filter((m) => m.role !== "system");
    
    // Add system context
    return [
      { role: "system", content: "You are helpful.", timestamp: Date.now() },
      ...filtered,
    ];
  },
});
```

### 10.6 Tool Hooks

```typescript
const agent = new Agent({
  beforeToolCall: async (context, signal) => {
    console.log("About to call:", context.toolCall.name);
    // Can modify tool call or cancel
    return { modifiedToolCall: context.toolCall };
  },
  
  afterToolCall: async (context, signal) => {
    console.log("Tool result:", context.result);
    // Can modify result or add metadata
    return { modifiedResult: context.result };
  },
});
```

---

## 11. Best Practices

### 11.1 State Management

**Do:**
- Use state getters for read access
- Use state setters for updates (copies arrays)
- Subscribe to events for state changes

**Don't:**
- Modify state directly
- Assume state is immutable
- Ignore streaming state

### 11.2 Event Handling

**Do:**
- Subscribe early (before prompt)
- Handle all event types
- Use signal for abort handling
- Await async operations carefully

**Don't:**
- Block listeners excessively
- Ignore abort signal
- Modify state during events (use agent API)

### 11.3 Tool Execution

**Do:**
- Implement proper error handling
- Respect abort signal
- Return structured results
- Use JSON Schema for validation

**Don't:**
- Ignore abort signal
- Throw unhandled errors
- Return unstructured data
- Skip validation

### 11.4 Message Queuing

**Do:**
- Use steering for corrections
- Use follow-up for next questions
- Choose appropriate queue mode
- Clear queues when needed

**Don't:**
- Queue too many messages
- Mix steering and follow-up incorrectly
- Forget to clear queues
- Ignore queue mode

---

## 12. Performance Considerations

### 12.1 Event Listener Performance

**Async Listeners:**
- Listeners are awaited sequentially
- Slow listeners block next event
- Consider offloading heavy work

**Recommendation:**
```typescript
agent.subscribe(async (event, signal) => {
  // Quick processing
  if (event.type === "message_update") {
    // Fast path
    return;
  }
  
  // Heavy work - offload
  if (event.type === "message_end") {
    queueMicrotask(() => processMessage(event.message));
  }
});
```

### 12.2 State Updates

**Copy-on-Write:**
- State setters copy arrays
- Large arrays can be expensive
- Consider batching updates

**Recommendation:**
```typescript
// Batch updates
const newMessages = [...agent.state.messages, newMessage];
agent.state.messages = newMessages;
```

### 12.3 Tool Execution

**Parallel vs Sequential:**
- Parallel: Faster, but more concurrent load
- Sequential: Slower, but more predictable

**Recommendation:**
```typescript
// Use parallel for independent tools
agent.toolExecution = "parallel";

// Use sequential for dependent tools
agent.toolExecution = "sequential";
```

### 12.4 Proxy Streaming

**Bandwidth:**
- Stripped events reduce bandwidth
- Consider compression for large responses
- Cache frequently used contexts

---

## 13. Error Handling

### 13.1 Agent Errors

**Error Types:**
- `abort`: User aborted
- `error`: Stream/tool error

**Error Message:**
```typescript
{
  role: "assistant",
  content: [{ type: "text", text: "" }],
  stopReason: "error",
  errorMessage: "Error message",
  timestamp: Date.now(),
}
```

### 13.2 Tool Errors

**Error Handling:**
```typescript
execute: async (args, signal) => {
  try {
    const result = await doWork(args, signal);
    return { content: [{ type: "text", text: result }] };
  } catch (error) {
    return {
      content: [{ type: "text", text: String(error) }],
      isError: true,
    };
  }
}
```

### 13.3 Proxy Errors

**Error Handling:**
```typescript
if (!response.ok) {
  let errorMessage = `Proxy error: ${response.status} ${response.statusText}`;
  try {
    const errorData = await response.json() as { error?: string };
    if (errorData.error) {
      errorMessage = `Proxy error: ${errorData.error}`;
    }
  } catch {
    // Couldn't parse error response
  }
  throw new Error(errorMessage);
}
```

---

## 14. Debugging

### 14.1 Event Logging

**Log All Events:**
```typescript
agent.subscribe((event, signal) => {
  console.log("Event:", event.type, event);
});
```

### 14.2 State Inspection

**Inspect State:**
```typescript
console.log("State:", agent.state);
console.log("Streaming:", agent.state.isStreaming);
console.log("Pending Tools:", agent.state.pendingToolCalls);
```

### 14.3 Queue Inspection

**Inspect Queues:**
```typescript
console.log("Has Queued:", agent.hasQueuedMessages());
console.log("Steering Mode:", agent.steeringMode);
console.log("Follow-up Mode:", agent.followUpMode);
```

### 14.4 Abort Signal

**Check Abort:**
```typescript
agent.subscribe((event, signal) => {
  if (signal.aborted) {
    console.log("Aborted!");
  }
});
```

---

## 15. Future Enhancements

### 15.1 Potential Improvements

**Features:**
- Tool result caching
- Message deduplication
- Context compression
- Streaming tool results
- Multi-turn tool execution

**Performance:**
- Event listener batching
- State update batching
- Tool execution pooling
- Proxy connection pooling

**Developer Experience:**
- Better error messages
- More debugging tools
- Performance metrics
- Built-in logging

---

## 16. Summary

**Package `packages/agent/` là một thư viện agent-based AI với:**

**Strengths:**
- ✅ Clean event-driven architecture
- ✅ Flexible state management
- ✅ Comprehensive tool execution
- ✅ Message queuing system
- ✅ Abort control
- ✅ Proxy streaming support
- ✅ Context transformation hooks
- ✅ Tool execution hooks
- ✅ Good test coverage
- ✅ TypeScript support

**Architecture:**
- Event-driven lifecycle
- Immutable state pattern
- Queue-based message flow
- Hook-based extensibility
- Stream-based communication

**Use Cases:**
- AI assistants
- Tool-using agents
- Multi-turn conversations
- Context-aware applications
- Proxy-based deployments

**Total Lines of Code:** ~1,500+ lines
**Files:** 5 source files
**Test Files:** 4 test files
**Dependencies:** @mariozechner/pi-ai

---

**Report Generated:** 2026-04-16
**Package:** packages/agent/
**Status:** ✅ Complete Analysis
