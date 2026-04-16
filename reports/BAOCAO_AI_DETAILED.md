# BÁO CÁO CHI TIẾT - PACKAGES/AI

## Tổng quan

Package `packages/ai/` là một thư viện TypeScript cung cấp abstraction layer cho nhiều AI providers khác nhau. Nó cung cấp interface thống nhất để tương tác với các API của Anthropic, OpenAI, Google, Mistral, Amazon Bedrock và nhiều provider khác.

**Thống kê**:
- Tổng số file: ~100+ files (bao gồm source, test, scripts)
- Main source files: ~30 files
- Test files: ~60 files
- Scripts: ~5 files
- Tổng dòng code: ~50,000+ dòng

---

## CẤU TRÚC THƯ MỤC

```
packages/ai/
├── src/
│   ├── index.ts (main export)
│   ├── types.ts (type definitions)
│   ├── models.ts (model management)
│   ├── models.generated.ts (auto-generated models)
│   ├── stream.ts (streaming interface)
│   ├── api-registry.ts (provider registry)
│   ├── env-api-keys.ts (API key resolution)
│   ├── oauth.ts (OAuth utilities)
│   ├── cli.ts (CLI tool)
│   ├── bedrock-provider.ts (Bedrock provider)
│   ├── providers/ (provider implementations)
│   │   ├── anthropic.ts
│   │   ├── openai-completions.ts
│   │   ├── openai-responses.ts
│   │   ├── openai-responses-shared.ts
│   │   ├── openai-codex-responses.ts
│   │   ├── google.ts
│   │   ├── google-vertex.ts
│   ├── utils/ (utility functions)
│   │   ├── event-stream.ts
│   │   ├── validation.ts
│   │   ├── json-parse.ts
│   │   ├── overflow.ts
│   │   ├── hash.ts
│   │   ├── sanitize-unicode.ts
│   │   ├── typebox-helpers.ts
│ │   └── oauth/ (OAuth implementations)
├── test/ (test files)
└── scripts/ (generation scripts)
```

---

## PHẦN 1: CORE TYPES (types.ts)

**File**: `packages/ai/src/types.ts` (347 dòng)

### 1.1 Type Definitions

**KnownApi Types**:
```typescript
export type KnownApi =
  | "openai-completions"
  | "mistral-conversations"
  | "openai-responses"
  | "azure-openai-responses"
  | "openai-codex-responses"
  | "anthropic-messages"
  | "bedrock-converse-stream"
  | "google-generative-ai"
  | "google-gemini-cli"
  | "google-vertex";
```

**KnownProvider Types**:
```typescript
export type KnownProvider =
  | "amazon-bedrock"
  | "anthropic"
  | "google"
  | "google-gemini-cli"
  | "google-antigravity"
  | "google-vertex"
  | "openai"
  | "azure-openai-responses"
  | "openai-codex"
  | "github-copilot"
  | "xai"
  | "groq"
  | "cerebras"
  | "openrouter"
  | "vercel-ai-gateway"
  | "zai"
  | "mistral"
  | "minimax"
  | "minimax-cn"
  | "huggingface"
  | "opencode"
  | "opencode-go"
  | "kilo-gateway"
  | "kimi-coding"
  | "nvidia";
```

### 1.2 Message Types

**TextContent**:
```typescript
export interface TextContent {
  type: "text";
  text: string;
  textSignature?: string;
}
```

**ThinkingContent**:
```typescript
export interface ThinkingContent {
  type: "thinking";
  thinking: string;
  thinkingSignature?: string;
  redacted?: boolean;
}
```

**ImageContent**:
```typescript
export interface ImageContent {
  type: "image";
  data: string; // base64 encoded
  mimeType: string;
}
```

**ToolCall**:
```typescript
export interface ToolCall {
  type: "toolCall";
  id: string;
  name: string;
  arguments: Record<string, any>;
  thoughtSignature?: string;
}
```

### 1.3 Message Types

**UserMessage**:
```typescript
export interface UserMessage {
  role: "user";
  content: string | (TextContent | ImageContent)[];
  timestamp: number;
}
```

**AssistantMessage**:
```typescript
export interface AssistantMessage {
  role: "assistant";
  content: (TextContent | ThinkingContent | ToolCall)[];
  api: Api;
  provider: Provider;
  model: string;
  responseId?: string;
  usage: Usage;
  stopReason: StopReason;
  errorMessage?: string;
  timestamp: number;
}
```

**ToolResultMessage**:
```typescript
export interface ToolResultMessage<TDetails = any> {
  role: "toolResult";
  toolCallId: string;
  toolName: string;
  content: (TextContent | ImageContent)[];
  details?: TDetails;
  isError: boolean;
  timestamp: number;
}
```

### 1.4 Usage & Cost

**Usage**:
```typescript
export interface Usage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  totalTokens: number;
  cost: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    total: number;
  };
}
```

### 1.5 Model Interface

**Model**:
```typescript
export interface Model<TApi extends Api> {
  id: string;
  name: string;
  api: TApi;
  provider: Provider;
  baseUrl: string;
  reasoning: boolean;
  input: ("text" | "image")[];
  cost: {
    input: number; // $/million tokens
    output: number;
    cacheRead: number;
    cacheWrite: number;
  };
  contextWindow: number;
  maxTokens: number;
  headers?: Record<string, string>;
  compat?: TApi extends "openai-completions"
    ? OpenAICompletionsCompat
    : TApi extends "openai-responses"
      ? OpenAIResponsesCompat
      : never;
}
```

### 1.6 Stream Options

**StreamOptions**:
```typescript
export interface StreamOptions {
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  apiKey?: string;
  transport?: Transport;
  cacheRetention?: CacheRetention;
  sessionId?: string;
  onPayload?: (payload: unknown, model: Model<Api>) => unknown | undefined | Promise<unknown | undefined>;
  headers?: Record<string, string>;
  maxRetryDelayMs?: number;
  metadata?: Record<string, unknown>;
}
```

**SimpleStreamOptions**:
```typescript
export interface SimpleStreamOptions extends StreamOptions {
  reasoning?: ThinkingLevel;
  thinkingBudgets?: ThinkingBudgets;
}
```

### 1.7 Event Types

**AssistantMessageEvent**:
```typescript
export type AssistantMessageEvent =
  | { type: "start"; partial: AssistantMessage }
  | { type: "text_start"; contentIndex: number; partial: AssistantMessage }
  | { type: "text_delta"; contentIndex: number; delta: string; partial: AssistantMessage }
  | { type: "text_end"; contentIndex: number; content: string; partial: AssistantMessage }
  | { type: "thinking_start"; contentIndex: number; partial: AssistantMessage }
  | { type: "thinking_delta"; contentIndex: number; delta: string; partial: AssistantMessage }
  | { type: "thinking_end"; contentIndex: number; content: string; partial: AssistantMessage }
  | { type: "toolcall_start"; contentIndex: number; partial: AssistantMessage }
  | { type: "toolcall_delta"; contentIndex: number; delta: string; partial: AssistantMessage }
  | { type: "toolcall_end"; contentIndex: number; toolCall: ToolCall; partial: AssistantMessage }
  | { type: "done"; reason: Extract<StopReason, "stop" | "length" | "toolUse">; message: AssistantMessage }
  | { type: "error"; reason: Extract<StopReason, "aborted" | "error">; error: AssistantMessage };
```

---

## PHẦN 2: STREAMING ARCHITECTURE (stream.ts)

**File**: `packages/ai/src/stream.ts` (main streaming interface)

### 2.1 Stream Function Type

```typescript
export type StreamFunction<TApi extends Api = Api, TOptions extends StreamOptions = StreamOptions> = (
  model: Model<TApi>,
  context: Context,
  options?: TOptions,
) => AssistantMessageEventStream;
```

### 2.2 Context Type

```typescript
export interface Context {
  systemPrompt?: string;
  messages: Message[];
  tools?: Tool[];
}
```

### 2.3 Tool Type

```typescript
export interface Tool<TParameters extends TSchema = TSchema> {
  name: string;
  description: string;
  parameters: TParameters;
}
```

### 2.4 Streaming Flow

```
streamSimple(model, context, options)
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

---

## PHẦN 3: API REGISTRY (api-registry.ts)

**File**: `packages/ai/src/api-registry.ts` (98 dòng)

### 3.1 Registry Structure

```typescript
const apiProviderRegistry = new Map<string, RegisteredApiProvider>();

interface RegisteredApiProvider {
  provider: ApiProviderInternal;
  sourceId?: string;
}

interface ApiProviderInternal {
  api: Api;
  stream: ApiStreamFunction;
  streamSimple: ApiStreamSimpleFunction;
}
```

### 3.2 Registration Functions

**registerApiProvider**:
```typescript
export function registerApiProvider<TApi extends Api, TOptions extends StreamOptions>(
  provider: ApiProvider<TApi, TOptions>,
  sourceId?: string,
): void
```

**getApiProvider**:
```typescript
export function getApiProvider(api: Api): ApiProviderInternal | undefined
```

**getApiProviders**:
```typescript
export function getApiProviders(): ApiProviderInternal[]
```

**unregisterApiProviders**:
```typescript
export function unregisterApiProviders(sourceId: string): void
```

**clearApiProviders**:
```typescript
export function clearApiProviders(): void
```

### 3.3 Provider Wrapping

```typescript
function wrapStream<TApi extends Api, TOptions extends StreamOptions>(
  api: TApi,
  stream: StreamFunction<TApi, TOptions>,
): ApiStreamFunction {
  return (model, context, options) => {
    if (model.api !== api) {
      throw new Error(`Mismatched api: ${model.api} expected ${api}`);
    }
    return stream(model as Model<TApi>, context, options as TOptions);
  };
}
```

---

## PHẦN 4: PROVIDER IMPLEMENTATIONS

### 4.1 Anthropic Provider (anthropic.ts)

**File**: `packages/ai/src/providers/anthropic.ts` (905 dòng)

**Key Features**:
- Extended thinking support (adaptive and budget-based)
- OAuth token support (Claude Code identity)
- Cache control (short/long/none)
- Tool call streaming
- GitHub Copilot integration

**Stream Function**:
```typescript
export const streamAnthropic: StreamFunction<"anthropic-messages", AnthropicOptions>
```

**Options**:
```typescript
export interface AnthropicOptions extends StreamOptions {
  thinkingEnabled?: boolean;
  thinkingBudgetTokens?: number;
  effort?: AnthropicEffort; // "low" | "medium" | "high" | "max"
  interleavedThinking?: boolean;
  toolChoice?: "auto" | "any" | "none" | { type: "tool"; name: string };
  client?: Anthropic;
}
```

**Adaptive Thinking**:
```typescript
function supportsAdaptiveThinking(modelId: string): boolean {
  return (
    modelId.includes("opus-4-6") ||
    modelId.includes("opus-4.6") ||
    modelId.includes("sonnet-4-6") ||
    modelId.includes("sonnet-4.6")
  );
}
```

**Claude Code Tool Naming**:
```typescript
const claudeCodeTools = [
  "Read", "Write", "Edit", "Bash", "Grep", "Glob",
  "AskUserQuestion", "EnterPlanMode", "ExitPlanMode",
  "KillShell", "NotebookEdit", "Skill", "Task",
  "TaskOutput", "TodoWrite", "WebFetch", "WebSearch",
];
```

**Client Creation**:
```typescript
function createClient(
  model: Model<"anthropic-messages">,
  apiKey: string,
  interleavedThinking: boolean,
  optionsHeaders?: Record<string, string>,
  dynamicHeaders?: Record<string, string>,
): { client: Anthropic; isOAuthToken: boolean }
```

**OAuth Detection**:
```typescript
function isOAuthToken(apiKey: string): boolean {
  return apiKey.includes("sk-ant-oat");
}
```

**Cache Control**:
```typescript
function getCacheControl(
  baseUrl: string,
  cacheRetention?: CacheRetention,
): { retention: CacheRetention; cacheControl?: { type: "ephemeral"; ttl?: "1h" } }
```

---

### 4.2 OpenAI Completions Provider (openai-completions.ts)

**File**: `packages/ai/src/providers/openai-completions.ts` (882 dòng)

**Key Features**:
- OpenAI-compatible API support
- Reasoning effort support
- Tool call streaming
- Compatibility detection
- OpenRouter routing
- Vercel AI Gateway routing

**Stream Function**:
```typescript
export const streamOpenAICompletions: StreamFunction<"openai-completions", OpenAICompletionsOptions>
```

**Options**:
```typescript
export interface OpenAICompletionsOptions extends StreamOptions {
  toolChoice?: "auto" | "none" | "required" | { type: "function"; function: { name: string } };
  reasoningEffort?: "minimal" | "low" | "medium" | "high" | "xhigh";
}
```

**Compatibility Detection**:
```typescript
function detectCompat(model: Model<"openai-completions">): Required<OpenAICompletionsCompat> {
  const provider = model.provider;
  const baseUrl = model.baseUrl;

  const isZai = provider === "zai" || baseUrl.includes("api.z.ai");
  const isNonStandard =
    provider === "cerebras" ||
    baseUrl.includes("cerebras.ai") ||
    provider === "xai" ||
    baseUrl.includes("api.x.ai") ||
    baseUrl.includes("chutes.ai") ||
    baseUrl.includes("deepseek.com") ||
    isZai ||
    provider === "opencode" ||
    provider === "kilo-gateway" ||
    baseUrl.includes("opencode.ai");

  return {
    supportsStore: !isNonStandard,
    supportsDeveloperRole: !isNonStandard,
    supportsReasoningEffort: !isGrok && !isZai,
    reasoningEffortMap,
    supportsUsageInStreaming: true,
    maxTokensField: useMaxTokens ? "max_tokens" : "max_completion_tokens",
    requiresToolResultName: false,
    requiresAssistantAfterToolResult: false,
    requiresThinkingAsText: false,
    thinkingFormat: isZai ? "zai" : "openai",
    openRouterRouting: {},
    vercelGatewayRouting: {},
    zaiToolStream: false,
    supportsStrictMode: true,
  };
}
```

**Tool Call ID Normalization**:
```typescript
const normalizeToolCallId = (id: string): string => {
  // Handle pipe-separated IDs from OpenAI Responses API
  if (id.includes("|")) {
    const [callId] = id.split("|");
    return callId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40);
  }

  if (model.provider === "openai") return id.length > 40 ? id.slice(0, 40) : id;
  return id;
};
```

**OpenRouter Cache Control**:
```typescript
function maybeAddOpenRouterAnthropicCacheControl(
  model: Model<"openai-completions">,
  messages: ChatCompletionMessageParam[],
): void {
  if (model.provider !== "openrouter" || !model.id.startsWith("anthropic/")) return;

  // Find last text part and add cache_control
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role !== "user" && msg.role !== "assistant") continue;

    const content = msg.content;
    if (typeof content === "string") {
      msg.content = [
        Object.assign({ type: "text" as const, text: content }, { cache_control: { type: "ephemeral" } }),
      ];
      return;
    }

    if (!Array.isArray(content)) continue;

    for (let j = content.length - 1; j >= 0; j--) {
      const part = content[j];
      if (part?.type === "text") {
        Object.assign(part, { cache_control: { type: "ephemeral" } });
        return;
      }
    }
  }
}
```

---

### 4.3 OpenAI Responses Provider (openai-responses.ts)

**File**: `packages/ai/src/providers/openai-responses.ts` (251 dòng)

**Key Features**:
- OpenAI Responses API support
- Reasoning effort support
- Service tier pricing
- GitHub Copilot integration

**Stream Function**:
```typescript
export const streamOpenAIResponses: StreamFunction<"openai-responses", OpenAIResponsesOptions>
```

**Options**:
```typescript
export interface OpenAIResponsesOptions extends StreamOptions {
  reasoningEffort?: "minimal" | "low" | "medium" | "high" | "xhigh";
  reasoningSummary?: "auto" | "detailed" | "concise" | null;
  serviceTier?: ResponseCreateParamsStreaming["service_tier"];
}
```

**Service Tier Pricing**:
```typescript
function getServiceTierCostMultiplier(serviceTier: ResponseCreateParamsStreaming["service_tier"] | undefined): number {
  switch (serviceTier) {
    case "flex":
      return 0.5;
    case "priority":
      return 2;
    default:
      return 1;
  }
}
```

**Prompt Cache Retention**:
```typescript
function getPromptCacheRetention(baseUrl: string, cacheRetention: CacheRetention): "24h" | undefined {
  if (cacheRetention !== "long") {
    return undefined;
  }
  if (baseUrl.includes("api.openai.com")) {
    return "24h";
  }
  return undefined;
}
```

---

### 4.4 Google Provider (google.ts)

**File**: `packages/ai/src/providers/google.ts` (476 dòng)

**Key Features**:
- Google Generative AI support
- Thinking level support
- Tool call streaming
- Thought signature retention

**Stream Function**:
```typescript
export const streamGoogle: StreamFunction<"google-generative-ai", GoogleOptions>
```

**Options**:
```typescript
export interface GoogleOptions extends StreamOptions {
  toolChoice?: "auto" | "none" | "any";
  thinking?: {
    enabled: boolean;
    budgetTokens?: number;
    level?: GoogleThinkingLevel;
  };
}
```

**Gemini 3 Thinking Levels**:
```typescript
function getGemini3ThinkingLevel(
  effort: ClampedThinkingLevel,
  model: Model<"google-generative-ai">,
): GoogleThinkingLevel {
  if (isGemini3ProModel(model)) {
    switch (effort) {
      case "minimal":
      case "low":
        return "LOW";
      case "medium":
      case "high":
        return "HIGH";
    }
  }
  switch (effort) {
    case "minimal":
      return "MINIMAL";
    case "low":
      return "LOW";
    case "medium":
      return "MEDIUM";
    case "high":
      return "HIGH";
  }
}
```

**Google Budget Calculation**:
```typescript
function getGoogleBudget(
  model: Model<"google-generative-ai">,
  effort: ClampedThinkingLevel,
  customBudgets?: ThinkingBudgets,
): number {
  if (customBudgets?.[effort] !== undefined) {
    return customBudgets[effort]!;
  }

  if (model.id.includes("2.5-pro")) {
    const budgets: Record<ClampedThinkingLevel, number> = {
      minimal: 128,
      low: 2048,
      medium: 8192,
      high: 32768,
    };
    return budgets[effort];
  }

  if (model.id.includes("2.5-flash")) {
    const budgets: Record<ClampedThinkingLevel, number> = {
      minimal: 128,
      low: 2048,
      medium: 8192,
      high: 24576,
    };
    return budgets[effort];
  }

  return -1;
}
```

---

### 4.5 Google Vertex Provider (google-vertex.ts)

**File**: `packages/ai/src/providers/google-vertex.ts` (542 dòng)

**Key Features**:
- Google Vertex AI support
- ADC (Application Default Credentials) support
- Project/location configuration
- API key support

**Stream Function**:
```typescript
export const streamGoogleVertex: StreamFunction<"google-vertex", GoogleVertexOptions>
```

**Options**:
```typescript
export interface GoogleVertexOptions extends StreamOptions {
  toolChoice?: "auto" | "none" | "any";
  thinking?: {
    enabled: boolean;
    budgetTokens?: number;
    level?: GoogleThinkingLevel;
  };
  project?: string;
  location?: string;
}
```

**API Key Resolution**:
```typescript
function resolveApiKey(options?: GoogleVertexOptions): string | undefined {
  const apiKey = options?.apiKey?.trim() || process.env.GOOGLE_CLOUD_API_KEY?.trim();
  if (!apiKey || isPlaceholderApiKey(apiKey)) {
    return undefined;
  }
  return apiKey;
}

function isPlaceholderApiKey(apiKey: string): boolean {
  return /^<[^>]+>$/.test(apiKey);
}
```

**Project/Location Resolution**:
```typescript
function resolveProject(options?: GoogleVertexOptions): string {
  const project = options?.project || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;
  if (!project) {
    throw new Error(
      "Vertex AI requires a project ID. Set GOOGLE_CLOUD_PROJECT/GCLOUD_PROJECT or pass project in options.",
    );
  }
  return project;
}

function resolveLocation(options?: GoogleVertexOptions): string {
  const location = options?.location || process.env.GOOGLE_CLOUD_LOCATION;
  if (!location) {
    throw new Error("Vertex AI requires a location. Set GOOGLE_CLOUD_LOCATION or pass location in options.");
  }
  return location;
}
```

---

### 4.6 Mistral Provider (mistral.ts)

**File**: `packages/ai/src/providers/mistral.ts` (585 dòng)

**Key Features**:
- Mistral AI support
- Thinking mode support
- Tool call streaming
- Tool call ID normalization

**Stream Function**:
```typescript
export const streamMistral: StreamFunction<"mistral-conversations", MistralOptions>
```

**Options**:
```typescript
export interface MistralOptions extends StreamOptions {
  toolChoice?: "auto" | "none" | "any" | "required" | { type: "function"; function: { name: string } };
  promptMode?: "reasoning";
}
```

**Tool Call ID Normalization**:
```typescript
function createMistralToolCallIdNormalizer(): (id: string) => string {
  const idMap = new Map<string, string>();
  const reverseMap = new Map<string, string>();

  return (id: string): string => {
    const existing = idMap.get(id);
    if (existing) return existing;

    let attempt = 0;
    while (true) {
      const candidate = deriveMistralToolCallId(id, attempt);
      const owner = reverseMap.get(candidate);
      if (!owner || owner === id) {
        idMap.set(id, candidate);
        reverseMap.set(candidate, id);
        return candidate;
      }
      attempt++;
    }
  };
}
```

**Error Formatting**:
```typescript
function formatMistralError(error: unknown): string {
  if (error instanceof Error) {
    const sdkError = error as Error & { statusCode?: unknown; body?: unknown };
    const statusCode = typeof sdkError.statusCode === "number" ? sdkError.statusCode : undefined;
    const bodyText = typeof sdkError.body === "string" ? sdkError.body.trim() : undefined;
    if (statusCode !== undefined && bodyText) {
      return `Mistral API error (${statusCode}): ${truncateErrorText(bodyText, MAX_MISTRAL_ERROR_BODY_CHARS)}`;
    }
    if (statusCode !== undefined) return `Mistral API error (${statusCode}): ${error.message}`;
    return error.message;
  }
  return safeJsonStringify(error);
}
```

---

### 4.7 Amazon Bedrock Provider (amazon-bedrock.ts)

**File**: `packages/ai/src/providers/amazon-bedrock.ts` (not read yet, but referenced)

**Key Features**:
- AWS Bedrock Converse Stream API support
- Multiple model support (Anthropic, Google, Meta, Mistral, etc.)
- AWS credential support
- Region configuration

---

## PHẦN 5: UTILITY FUNCTIONS

### 5.1 Event Stream (event-stream.ts)

**File**: `packages/ai/src/utils/event-stream.ts` (87 dòng)

**EventStream Class**:
```typescript
export class EventStream<T, R = T> implements AsyncIterable<T> {
  private queue: T[] = [];
  private waiting: ((value: IteratorResult<T>) => void)[] = [];
  private done = false;
  private finalResultPromise: Promise<R>;
  private resolveFinalResult!: (result: R) => void;

  constructor(
    private isComplete: (event: T) => boolean,
    private extractResult: (event: T) => R,
  ) {
    this.finalResultPromise = new Promise((resolve) => {
      this.resolveFinalResult = resolve;
    });
  }

  push(event: T): void
  end(result?: R): void
  async *[Symbol.asyncIterator](): AsyncIterator<T>
  result(): Promise<R>
}
```

**AssistantMessageEventStream**:
```typescript
export class AssistantMessageEventStream extends EventStream<AssistantMessageEvent, AssistantMessage> {
  constructor() {
    super(
      (event) => event.type === "done" || event.type === "error",
      (event) => {
        if (event.type === "done") {
          return event.message;
        } else if (event.type === "error") {
          return event.error;
        }
        throw new Error("Unexpected event type for final result");
      },
    );
  }
}
```

---

### 5.2 Validation (validation.ts)

**File**: `packages/ai/src/utils/validation.ts` (93 dòng)

**validateToolCall**:
```typescript
export function validateToolCall(tools: Tool[], toolCall: ToolCall): any {
  const tool = tools.find((t) => t.name === toolCall.name);
  if (!tool) {
    throw new Error(`Tool "${toolCall.name}" not found`);
  }
  return validateToolArguments(tool, toolCall);
}
```

**validateToolArguments**:
```typescript
export function validateToolArguments(tool: Tool, toolCall: ToolCall): any {
  if (!ajv || !canUseRuntimeCodegen()) {
    return toolCall.arguments;
  }

  const validate = ajv.compile(tool.parameters);
  const args = structuredClone(toolCall.arguments);

  if (validate(args)) {
    return args;
  }

  const errors =
    validate.errors
      ?.map((err: any) => {
        const path = err.instancePath ? err.instancePath.substring(1) : err.params.missingProperty || "root";
        return `  - ${path}: ${err.message}`;
      })
      .join("\n") || "Unknown validation error";

  const errorMessage = `Validation failed for tool "${toolCall.name}":\n${errors}\n\nReceived arguments:\n${JSON.stringify(toolCall.arguments, null, 2)}`;

  throw new Error(errorMessage);
}
```

**CSP Detection**:
```typescript
const isBrowserExtension = typeof globalThis !== "undefined" && (globalThis as any).chrome?.runtime?.id !== undefined;

function canUseRuntimeCodegen(): boolean {
  if (isBrowserExtension) {
    return false;
  }

  try {
    new Function("return true;");
    return true;
  } catch {
    return false;
  }
}
```

---

### 5.3 JSON Parse (json-parse.ts)

**File**: `packages/ai/src/utils/json-parse.ts` (not read yet, but referenced)

**Purpose**: Parse streaming JSON for tool call arguments

---

### 5.4 Overflow Detection (overflow.ts)

**File**: `packages/ai/src/utils/overflow.ts` (138 dòng)

**Overflow Patterns**:
```typescript
const OVERFLOW_PATTERNS = [
  /prompt is too long/i, // Anthropic token overflow
  /request_too_large/i, // Anthropic request byte-size overflow (HTTP 413)
  /input is too long for requested model/i, // Amazon Bedrock
  /exceeds the context window/i, // OpenAI (Completions & Responses API)
  /input token count.*exceeds the maximum/i, // Google (Gemini)
  /maximum prompt length is \d+/i, // xAI (Grok)
  /reduce the length of the messages/i, // Groq
  /maximum context length is \d+ tokens/i, // OpenRouter (all backends)
  /exceeds the limit of \d+/i, // GitHub Copilot
  /exceeds the available context size/i, // llama.cpp server
  /greater than the context length/i, // LM Studio
  /context window exceeds limit/i, // MiniMax
  /exceeded model token limit/i, // Kimi For Coding
  /too large for model with \d+ maximum context length/i, // Mistral
  /model_context_window_exceeded/i, // z.ai non-standard finish_reason surfaced as error text
  /prompt too long; exceeded (?:max )?context length/i, // Ollama explicit overflow error
  /context[_ ]length[_ ]exceeded/i, // Generic fallback
  /too many tokens/i, // Generic fallback
  /token limit exceeded/i, // Generic fallback
  /^4(?:00|13)\s*(?:status code)?\s*\(no body\)/i, // Cerebras: 400/413 with no body
];
```

**Non-Overflow Patterns**:
```typescript
const NON_OVERFLOW_PATTERNS = [
  /^(Throttling error|Service unavailable):/i, // AWS Bedrock non-overflow errors
  /rate limit/i, // Generic rate limiting
  /too many requests/i, // Generic HTTP 429 style
];
```

**isContextOverflow**:
```typescript
export function isContextOverflow(message: AssistantMessage, contextWindow?: number): boolean {
  // Case 1: Check error message patterns
  if (message.stopReason === "error" && message.errorMessage) {
    const isNonOverflow = NON_OVERFLOW_PATTERNS.some((p) => p.test(message.errorMessage!));
    if (!isNonOverflow && OVERFLOW_PATTERNS.some((p) => p.test(message.errorMessage!))) {
      return true;
    }
  }

  // Case 2: Silent overflow (z.ai style)
  if (contextWindow && message.stopReason === "stop") {
    const inputTokens = message.usage.input + message.usage.cacheRead;
    if (inputTokens > contextWindow) {
      return true;
    }
  }

  return false;
}
```

---

### 5.5 Hash (hash.ts)

**File**: `packages/ai/src/utils/hash.ts` (13 dòng)

**shortHash**:
```typescript
export function shortHash(str: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(36) + (h1 >>> 0).toString(36);
}
```

---

### 5.6 Sanitize Unicode (sanitize-unicode.ts)

**File**: `packages/ai/src/utils/sanitize-unicode.ts` (not read yet, but referenced)

**Purpose**: Sanitize Unicode surrogates for API compatibility

---

### 5.7 TypeBox Helpers (typebox-helpers.ts)

**File**: `packages/ai/src/utils/typebox-helpers.ts` (not read yet, but referenced)

**Purpose**: TypeBox schema generation helpers

---

## PHẦN 6: API KEY RESOLUTION (env-api-keys.ts)

**File**: `packages/ai/src/env-api-keys.ts` (135 dòng)

### 6.1 Environment Variable Mapping

```typescript
const envMap: Record<string, string> = {
  openai: "OPENAI_API_KEY",
  "azure-openai-responses": "AZURE_OPENAI_API_KEY",
  google: "GEMINI_API_KEY",
  groq: "GROQ_API_KEY",
  cerebras: "CEREBRAS_API_KEY",
  xai: "XAI_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  "vercel-ai-gateway": "AI_GATEWAY_API_KEY",
  zai: "ZAI_API_KEY",
  mistral: "MISTRAL_API_KEY",
  minimax: "MINIMAX_API_KEY",
  "minimax-cn": "MINIMAX_CN_API_KEY",
  huggingface: "HF_TOKEN",
  opencode: "OPENCODE_API_KEY",
  "opencode-go": "OPENCODE_API_KEY",
  "kilo-gateway": "KILO_GATEWAY_API_KEY",
  "kimi-coding": "KIMI_API_KEY",
  nvidia: "NVIDIA_API_KEY",
};
```

### 6.2 Special Cases

**GitHub Copilot**:
```typescript
if (provider === "github-copilot") {
  return process.env.COPILOT_GITHUB_TOKEN || process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
}
```

**Anthropic**:
```typescript
if (provider === "anthropic") {
  return process.env.ANTHROPIC_OAUTH_TOKEN || process.env.ANTHROPIC_API_KEY;
}
```

**Google Vertex**:
```typescript
if (provider === "google-vertex") {
  if (process.env.GOOGLE_CLOUD_API_KEY) {
    return process.env.GOOGLE_CLOUD_API_KEY;
  }

  const hasCredentials = hasVertexAdcCredentials();
  const hasProject = !!(process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT);
  const hasLocation = !!process.env.GOOGLE_CLOUD_LOCATION;

  if (hasCredentials && hasProject && hasLocation) {
    return "<authenticated>";
  }
}
```

**Amazon Bedrock**:
```typescript
if (provider === "amazon-bedrock") {
  if (
    process.env.AWS_PROFILE ||
    (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) ||
    process.env.AWS_BEARER_TOKEN_BEDROCK ||
    process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI ||
    process.env.AWS_CONTAINER_CREDENTIALS_FULL_URI ||
    process.env.AWS_WEB_IDENTITY_TOKEN_FILE
  ) {
    return "<authenticated>";
  }
}
```

### 6.3 Vertex ADC Detection

```typescript
function hasVertexAdcCredentials(): boolean {
  if (cachedVertexAdcCredentialsExists === null) {
    if (!_existsSync || !_homedir || !_join) {
      const isNode = typeof process !== "undefined" && (process.versions?.node || process.versions?.bun);
      if (!isNode) {
        cachedVertexAdcCredentialsExists = false;
      }
      return false;
    }

    const gacPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (gacPath) {
      cachedVertexAdcCredentialsExists = _existsSync(gacPath);
    } else {
      cachedVertexAdcCredentialsExists = _existsSync(
        _join(_homedir(), ".config", "gcloud", "application_default_credentials.json"),
      );
    }
  }
  return cachedVertexAdcCredentialsExists;
}
```

---

## PHẦN 7: MODEL MANAGEMENT (models.ts)

**File**: `packages/ai/src/models.ts` (not read yet, but referenced)

**Purpose**: Model metadata, cost calculation, thinking support detection

---

## PHẦN 8: BUILT-IN PROVIDER REGISTRATION (register-builtins.ts)

**File**: `packages/ai/src/providers/register-builtins.ts` (459 dòng)

### 8.1 Lazy Loading

```typescript
function createLazyStream<TApi extends Api, TOptions extends StreamOptions, TSimpleOptions extends SimpleStreamOptions>(
  loadModule: () => Promise<LazyProviderModule<TApi, TOptions, TSimpleOptions>>,
): StreamFunction<TApi, TOptions> {
  return (model, context, options) => {
    const outer = new AssistantMessageEventStream();

    loadModule()
      .then((module) => {
        const inner = module.stream(model, context, options);
        forwardStream(outer, inner);
      })
      .catch((error) => {
        const message = createLazyLoadErrorMessage(model, error);
        outer.push({ type: "error", reason: "error", error: message });
        outer.end(message);
      });

    return outer;
  };
}
```

### 8.2 Provider Modules

**Anthropic**:
```typescript
function loadAnthropicProviderModule(): Promise<
  LazyProviderModule<"anthropic-messages", AnthropicOptions, SimpleStreamOptions>
> {
  anthropicProviderModulePromise ||= import("./anthropic.js").then((module) => {
    const provider = module as AnthropicProviderModule;
    return {
      stream: provider.streamAnthropic,
      streamSimple: provider.streamSimpleAnthropic,
    };
  });
  return anthropicProviderModulePromise;
}
```

**OpenAI Completions**:
```typescript
function loadOpenAICompletionsProviderModule(): Promise<
  LazyProviderModule<"openai-completions", OpenAICompletionsOptions, SimpleStreamOptions>
> {
  openAICompletionsProviderModulePromise ||= import("./openai-completions.js").then((module) => {
    const provider = module as OpenAICompletionsProviderModule;
    return {
      stream: provider.streamOpenAICompletions,
      streamSimple: provider.streamSimpleOpenAICompletions,
    };
  });
  return openAICompletionsProviderModulePromise;
}
```

### 8.3 Registration

```typescript
export function registerBuiltInApiProviders(): void {
  registerApiProvider({
    api: "anthropic-messages",
    stream: streamAnthropic,
    streamSimple: streamSimpleAnthropic,
  });

  registerApiProvider({
    api: "openai-completions",
    stream: streamOpenAICompletions,
    streamSimple: streamSimpleOpenAICompletions,
  });

  registerApiProvider({
    api: "mistral-conversations",
    stream: streamMistral,
    streamSimple: streamSimpleMistral,
  });

  // ... more providers
}
```

---

## PHẦN 9: OAUTH SUPPORT (oauth.ts)

**File**: `packages/ai/src/oauth.ts` (not read yet, but referenced)

**Purpose**: OAuth authentication for providers like Anthropic, GitHub Copilot

---

## PHẦN 10: CLI TOOL (cli.ts)

**File**: `packages/ai/src/cli.ts` (133 dòng)

### 10.1 Commands

**login**:
```typescript
async function login(providerId: OAuthProviderId): Promise<void> {
  const provider = getOAuthProvider(providerId);
  if (!provider) {
    console.error(`Unknown provider: ${providerId}`);
    process.exit(1);
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const promptFn = (msg: string) => prompt(rl, `${msg} `);

  try {
    const credentials = await provider.login({
      onAuth: (info) => {
        console.log(`\nOpen this URL in your browser:\n${info.url}`);
        if (info.instructions) console.log(info.instructions);
        console.log();
      },
      onPrompt: async (p) => {
        return await promptFn(`${p.message}${p.placeholder ? ` (${p.placeholder})` : ""}:`);
      },
      onProgress: (msg) => console.log(msg),
    });

    const auth = loadAuth();
    auth[providerId] = { type: "oauth", ...credentials };
    saveAuth(auth);

    console.log(`\nCredentials saved to ${AUTH_FILE}`);
  } finally {
    rl.close();
  }
}
```

**list**:
```typescript
if (command === "list") {
  console.log("Available OAuth providers:\n");
  for (const p of PROVIDERS) {
    console.log(`  ${p.id.padEnd(20)} ${p.name}`);
  }
  return;
}
```

---

## PHẦN 11: STREAMING FLOW

### 11.1 Complete Streaming Flow

```
User calls streamSimple(model, context, options)
  ↓
API Registry resolves provider based on model.api
  ↓
Provider's streamSimple function is called
  ↓
Provider creates client and builds params
  ↓
Provider calls provider API
  ↓
Provider receives streaming response
  ↓
Provider parses events and builds AssistantMessage
  ↓
Provider pushes events to AssistantMessageEventStream
  ├─ start: partial message
  ├─ text_start: start text block
  ├─ text_delta: text chunk
  ├─ text_end: end text block
  ├─ thinking_start: start thinking block
  ├─ thinking_delta: thinking chunk
  ├─ thinking_end: end thinking block
  ├─ toolcall_start: start tool call
  ├─ toolcall_delta: tool call chunk
  ├─ toolcall_end: end tool call
  ├─ done: successful completion
  └─ error: error occurred
  ↓
Consumer iterates over stream
  ↓
Events are processed and displayed
```

### 11.2 Event Protocol

**Start Event**:
```typescript
{ type: "start"; partial: AssistantMessage }
```

**Text Events**:
```typescript
{ type: "text_start"; contentIndex: number; partial: AssistantMessage }
{ type: "text_delta"; contentIndex: number; delta: string; partial: AssistantMessage }
{ type: "text_end"; contentIndex: number; content: string; partial: AssistantMessage }
```

**Thinking Events**:
```typescript
{ type: "thinking_start"; contentIndex: number; partial: AssistantMessage }
{ type: "thinking_delta"; contentIndex: number; delta: string; partial: AssistantMessage }
{ type: "thinking_end"; contentIndex: number; content: string; partial: AssistantMessage }
```

**Tool Call Events**:
```typescript
{ type: "toolcall_start"; contentIndex: number; partial: AssistantMessage }
{ type: "toolcall_delta"; contentIndex: number; delta: string; partial: AssistantMessage }
{ type: "toolcall_end"; contentIndex: number; toolCall: ToolCall; partial: AssistantMessage }
```

**Completion Events**:
```typescript
{ type: "done"; reason: "stop" | "length" | "toolUse"; message: AssistantMessage }
{ type: "error"; reason: "aborted" | "error"; error: AssistantMessage }
```

---

## PHẦN 12: ERROR HANDLING

### 12.1 Error Detection

**Context Overflow Detection**:
```typescript
export function isContextOverflow(message: AssistantMessage, contextWindow?: number): boolean
```

**Patterns Detected**:
- Anthropic: "prompt is too long: X tokens > Y maximum"
- OpenAI: "exceeds the context window"
- Google: "input token count exceeds the maximum"
- xAI: "maximum prompt length is X but request contains Y tokens"
- Groq: "reduce the length of the messages"
- OpenRouter: "maximum context length is X tokens"
- GitHub Copilot: "prompt token count of X exceeds the limit of Y"
- MiniMax: "context window exceeds limit"
- Kimi For Coding: "exceeded model token limit"
- Cerebras: 400/413 status code
- Mistral: "too large for model with Y maximum context length"
- z.ai: silent overflow (usage.input > contextWindow)
- Ollama: "prompt too long; exceeded max context length"

### 12.2 Error Propagation

**Provider Error → Stream Error**:
```typescript
catch (error) {
  for (const block of output.content) delete (block as any).index;
  output.stopReason = options?.signal?.aborted ? "aborted" : "error";
  output.errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
  stream.push({ type: "error", reason: output.stopReason, error: output });
  stream.end();
}
```

---

## PHẦN 13: COMPATIBILITY LAYERS

### 13.1 OpenAI Compat

**OpenAICompletionsCompat**:
```typescript
export interface OpenAICompletionsCompat {
  supportsStore?: boolean;
  supportsDeveloperRole?: boolean;
  supportsReasoningEffort?: boolean;
  reasoningEffortMap?: Partial<Record<ThinkingLevel, string>>;
  supportsUsageInStreaming?: boolean;
  maxTokensField?: "max_completion_tokens" | "max_tokens";
  requiresToolResultName?: boolean;
  requiresAssistantAfterToolResult?: boolean;
  requiresThinkingAsText?: boolean;
  thinkingFormat?: "openai" | "openrouter" | "zai" | "qwen" | "qwen-chat-template";
  openRouterRouting?: OpenRouterRouting;
  vercelGatewayRouting?: VercelGatewayRouting;
  zaiToolStream?: boolean;
  supportsStrictMode?: boolean;
}
```

### 13.2 Auto-Detection

**Provider-Based Detection**:
```typescript
const isZai = provider === "zai" || baseUrl.includes("api.z.ai");
const isNonStandard =
  provider === "cerebras" ||
  baseUrl.includes("cerebras.ai") ||
  provider === "xai" ||
  baseUrl.includes("api.x.ai") ||
  baseUrl.includes("chutes.ai") ||
  baseUrl.includes("deepseek.com") ||
  isZai ||
  provider === "opencode" ||
  provider === "kilo-gateway" ||
  baseUrl.includes("opencode.ai");
```

**URL-Based Detection**:
```typescript
const useMaxTokens = baseUrl.includes("chutes.ai");
const isGrok = provider === "xai" || baseUrl.includes("api.x.ai");
const isGroq = provider === "groq" || baseUrl.includes("groq.com");
```

---

## PHẦN 14: THINKING SUPPORT

### 14.1 Thinking Levels

```typescript
export type ThinkingLevel = "minimal" | "low" | "medium" | "high" | "xhigh";
```

### 14.2 Thinking Budgets

```typescript
export interface ThinkingBudgets {
  minimal?: number;
  low?: number;
  medium?: number;
  high?: number;
}
```

### 14.3 Adaptive Thinking (Anthropic)

**Opus 4.6 & Sonnet 4.6**:
```typescript
if (supportsAdaptiveThinking(model.id)) {
  const effort = mapThinkingLevelToEffort(options.reasoning, model.id);
  return streamAnthropic(model, context, {
    ...base,
    thinkingEnabled: true,
    effort,
  } satisfies AnthropicOptions);
}
```

**Older Models**:
```typescript
const adjusted = adjustMaxTokensForThinking(
  base.maxTokens || 0,
  model.maxTokens,
  options.reasoning,
  options.thinkingBudgets,
);

return streamAnthropic(model, context, {
  ...base,
  maxTokens: adjusted.maxTokens,
  thinkingEnabled: true,
  thinkingBudgetTokens: adjusted.thinkingBudget,
} satisfies AnthropicOptions);
```

### 14.4 Google Thinking

**Gemini 3 Pro/Flash**:
```typescript
if (isGemini3ProModel(model) || isGemini3FlashModel(model)) {
  return streamGoogle(model, context, {
    ...base,
    thinking: {
      enabled: true,
      level: getGemini3ThinkingLevel(effort, model),
    },
  } satisfies GoogleOptions);
}
```

**Gemini 2.5 Pro/Flash**:
```typescript
return streamGoogle(model, context, {
  ...base,
  thinking: {
    enabled: true,
    budgetTokens: getGoogleBudget(googleModel, effort, options.thinkingBudgets),
  },
} satisfies GoogleOptions);
```

---

## PHẦN 15: TOOL CALL HANDLING

### 15.1 Tool Call Streaming

**Anthropic**:
```typescript
if (event.type === "content_block_delta") {
  if (event.delta.type === "input_json_delta") {
    const index = blocks.findIndex((b) => b.index === event.index);
    const block = blocks[index];
    if (block && block.type === "toolCall") {
      block.partialJson += event.delta.partial_json;
      block.arguments = parseStreamingJson(block.partialJson);
      stream.push({
        type: "toolcall_delta",
        contentIndex: index,
        delta: event.delta.partial_json,
        partial: output,
      });
    }
  }
}
```

**OpenAI Completions**:
```typescript
if (choice?.delta?.tool_calls) {
  for (const toolCall of choice.delta.tool_calls) {
    if (
      !currentBlock ||
      currentBlock.type !== "toolCall" ||
      (toolCall.id && currentBlock.id !== toolCall.id)
    ) {
      finishCurrentBlock(currentBlock);
      currentBlock = {
        type: "toolCall",
        id: toolCall.id || "",
        name: toolCall.function?.name || "",
        arguments: {},
        partialArgs: "",
      };
      output.content.push(currentBlock);
      stream.push({ type: "toolcall_start", contentIndex: blockIndex(), partial: output });
    }

    if (currentBlock.type === "toolCall") {
      if (toolCall.id) currentBlock.id = toolCall.id;
      if (toolCall.function?.name) currentBlock.name = toolCall.function.name;
      let delta = "";
      if (toolCall.function?.arguments) {
        delta = toolCall.function.arguments;
        currentBlock.partialArgs += toolCall.function.arguments;
        currentBlock.arguments = parseStreamingJson(currentBlock.partialArgs);
      }
      stream.push({
        type: "toolcall_delta",
        contentIndex: blockIndex(),
        delta,
        partial: output,
      });
    }
  }
}
```

### 15.2 Tool Result Handling

**Anthropic**:
```typescript
} else if (msg.role === "toolResult") {
  const toolResults: ContentBlockParam[] = [];

  toolResults.push({
    type: "tool_result",
    tool_use_id: msg.toolCallId,
    content: convertContentBlocks(msg.content),
    is_error: msg.isError,
  });

  // Look ahead for consecutive toolResult messages
  let j = i + 1;
  while (j < transformedMessages.length && transformedMessages[j].role === "toolResult") {
    const nextMsg = transformedMessages[j] as ToolResultMessage;
    toolResults.push({
      type: "tool_result",
      tool_use_id: nextMsg.toolCallId,
      content: convertContentBlocks(nextMsg.content),
      is_error: nextMsg.isError,
    });
    j++;
  }

  i = j - 1;

  params.push({
    role: "user",
    content: toolResults,
  });
}
```

**OpenAI Completions**:
```typescript
} else if (msg.role === "toolResult") {
  const imageBlocks: Array<{ type: "image_url"; image_url: { url: string } }> = [];
  let j = i;

  for (; j < transformedMessages.length && transformedMessages[j].role === "toolResult"; j++) {
    const toolMsg = transformedMessages[j] as ToolResultMessage;

    const textResult = toolMsg.content
      .filter((c) => c.type === "text")
      .map((c) => (c as any).text)
      .join("\n");
    const hasImages = toolMsg.content.some((c) => c.type === "image");

    const toolResultMsg: ChatCompletionToolMessageParam = {
      role: "tool",
      content: sanitizeSurrogates(hasText ? textResult : "(see attached image)"),
      tool_call_id: toolMsg.toolCallId,
    };
    if (compat.requiresToolResultName && toolMsg.toolName) {
      (toolResultMsg as any).name = toolMsg.toolName;
    }
    params.push(toolResultMsg);

    if (hasImages && model.input.includes("image")) {
      for (const block of toolMsg.content) {
        if (block.type === "image") {
          imageBlocks.push({
            type: "image_url",
            image_url: {
              url: `data:${(block as any).mimeType};base64,${(block as any).data}`,
            },
          });
        }
      }
    }
  }

  i = j - 1;

  if (imageBlocks.length > 0) {
    if (compat.requiresAssistantAfterToolResult) {
      params.push({
        role: "assistant",
        content: "I have processed the tool results.",
      });
    }

    params.push({
      role: "user",
      content: [
        {
          type: "text",
          text: "Attached image(s) from tool result:",
        },
        ...imageBlocks,
      ],
    });
    lastRole = "user";
  } else {
    lastRole = "toolResult";
  }
}
```

---

## PHẦN 16: CACHE CONTROL

### 16.1 Cache Retention

**Anthropic**:
```typescript
function resolveCacheRetention(cacheRetention?: CacheRetention): CacheRetention {
  if (cacheRetention) {
    return cacheRetention;
  }
  if (typeof process !== "undefined" && process.env.PI_CACHE_RETENTION === "long") {
    return "long";
  }
  return "short";
}

function getCacheControl(
  baseUrl: string,
  cacheRetention?: CacheRetention,
): { retention: CacheRetention; cacheControl?: { type: "ephemeral"; ttl?: "1h" } } {
  const retention = resolveCacheRetention(cacheRetention);
  if (retention === "none") {
    return { retention };
  }
  const ttl = retention === "long" && baseUrl.includes("api.anthropic.com") ? "1h" : undefined;
  return {
    retention,
    cacheControl: { type: "ephemeral", ...(ttl && { ttl }) },
  };
}
```

**OpenAI Responses**:
```typescript
function getPromptCacheRetention(baseUrl: string, cacheRetention: CacheRetention): "24h" | undefined {
  if (cacheRetention !== "long") {
    return undefined;
  }
  if (baseUrl.includes("api.openai.com")) {
    return "24h";
  }
  return undefined;
}
```

### 16.2 Cache Control Application

**Anthropic**:
```typescript
// Add cache_control to the last user message to cache conversation history
if (cacheControl && params.length > 0) {
  const lastMessage = params[params.length - 1];
  if (lastMessage.role === "user") {
    if (Array.isArray(lastMessage.content)) {
      const lastBlock = lastMessage.content[lastMessage.content.length - 1];
      if (
        lastBlock &&
        (lastBlock.type === "text" || lastBlock.type === "image" || lastBlock.type === "tool_result")
      ) {
        (lastBlock as any).cache_control = cacheControl;
      }
    } else if (typeof lastMessage.content === "string") {
      lastMessage.content = [
        {
          type: "text",
          text: lastMessage.content,
          cache_control: cacheControl,
        },
      ] as any;
    }
  }
}
```

---

## PHẦN 17: STOP REASON MAPPING

### 17.1 Anthropic Stop Reasons

```typescript
function mapStopReason(reason: Anthropic.Messages.StopReason | string): StopReason {
  switch (reason) {
    case "end_turn":
      return "stop";
    case "max_tokens":
      return "length";
    case "tool_use":
      return "toolUse";
    case "refusal":
      return "error";
    case "pause_turn":
      return "stop";
    case "stop_sequence":
      return "stop";
    case "sensitive":
      return "error";
    default:
      throw new Error(`Unhandled stop reason: ${reason}`);
  }
}
```

### 17.2 OpenAI Completions Stop Reasons

```typescript
function mapStopReason(reason: ChatCompletionChunk.Choice["finish_reason"] | string): {
  stopReason: StopReason;
  errorMessage?: string;
} {
  if (reason === null) return { stopReason: "stop" };
  switch (reason) {
    case "stop":
    case "end":
      return { stopReason: "stop" };
    case "length":
      return { stopReason: "length" };
    case "function_call":
    case "tool_calls":
      return { stopReason: "toolUse" };
    case "content_filter":
      return { stopReason: "error", errorMessage: "Provider finish_reason: content_filter" };
    case "network_error":
      return { stopReason: "error", errorMessage: "Provider finish_reason: network_error" };
    default:
      return {
        stopReason: "error",
        errorMessage: `Provider finish_reason: ${reason}`,
      };
  }
}
```

---

## PH�N 18: COST CALCULATION

### 18.1 Usage Tracking

**Anthropic**:
```typescript
if (event.type === "message_start") {
  output.usage.input = event.message.usage.input_tokens || 0;
  output.usage.output = event.message.usage.output_tokens || 0;
  output.usage.cacheRead = event.message.usage.cache_read_input_tokens || 0;
  output.usage.cacheWrite = event.message.usage.cache_creation_input_tokens || 0;
  output.usage.totalTokens =
    output.usage.input + output.usage.output + output.usage.cacheRead + output.usage.cacheWrite;
  calculateCost(model, output.usage);
}
```

**OpenAI Completions**:
```typescript
function parseChunkUsage(
  rawUsage: {
    prompt_tokens?: number;
    completion_tokens?: number;
    prompt_tokens_details?: { cached_tokens?: number; cache_write_tokens?: number };
    completion_tokens_details?: { reasoning_tokens?: number };
  },
  model: Model<"openai-completions">,
): AssistantMessage["usage"] {
  const promptTokens = rawUsage.prompt_tokens || 0;
  const reportedCachedTokens = rawUsage.prompt_tokens_details?.cached_tokens || 0;
  const cacheWriteTokens = rawUsage.prompt_tokens_details?.cache_write_tokens || 0;
  const reasoningTokens = rawUsage.completion_tokens_details?.reasoning_tokens || 0;

  const cacheReadTokens =
    cacheWriteTokens > 0 ? Math.max(0, reportedCachedTokens - cacheWriteTokens) : reportedCachedTokens;

  const input = Math.max(0, promptTokens - cacheReadTokens - cacheWriteTokens);
  const outputTokens = (rawUsage.completion_tokens || 0) + reasoningTokens;
  const usage: AssistantMessage["usage"] = {
    input,
    output: outputTokens,
    cacheRead: cacheReadTokens,
    cacheWrite: cacheWriteTokens,
    totalTokens: input + outputTokens + cacheReadTokens + cacheWriteTokens,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  };
  calculateCost(model, usage);
  return usage;
}
```

---

## PHẦN 19: TRANSPORT OPTIONS

### 19.1 Transport Types

```typescript
export type Transport = "sse" | "websocket" | "auto";
```

### 19.2 Transport Usage

**Anthropic**: Uses SSE (Server-Sent Events)
**OpenAI**: Uses SSE
**Google**: Uses SSE
**Mistral**: Uses SSE
**Bedrock**: Uses SSE

---

## PHẦN 20: METADATA SUPPORT

### 20.1 Metadata Options

```typescript
export interface StreamOptions {
  metadata?: Record<string, unknown>;
}
```

### 20.2 Anthropic Metadata

```typescript
if (options?.metadata) {
  const userId = options.metadata.user_id;
  if (typeof userId === "string") {
    params.metadata = { user_id: userId };
  }
}
```

---

## PH�N 21: PAYLOAD INSPECTION

### 21.1 onPayload Callback

```typescript
export interface StreamOptions {
  onPayload?: (payload: unknown, model: Model<Api>) => unknown | undefined | Promise<unknown | undefined>;
}
```

**Usage**:
```typescript
let params = buildParams(model, context, isOAuth, options);
const nextParams = await options?.onPayload?.(params, model);
if (nextParams !== undefined) {
  params = nextParams as MessageCreateParamsStreaming;
}
```

---

## PH�N 22: SESSION SUPPORT

### 22.1 Session ID

```typescript
export interface StreamOptions {
  sessionId?: string;
}
```

**Usage**:
```typescript
// Anthropic
params.sessionId = options?.sessionId;

// OpenAI Responses
params.prompt_cache_key = cacheRetention === "none" ? undefined : options?.sessionId;
```

---

## PH�N 23: RETRY DELAY CAP

### 23.1 maxRetryDelayMs

```typescript
export interface StreamOptions {
  maxRetryDelayMs?: number;
}
```

**Purpose**: Cap provider-requested retry delays to prevent long waits

---

## PHẦN 24: HEADER MANAGEMENT

### 24.1 Header Merging

**Anthropic**:
```typescript
function mergeHeaders(...headerSources: (Record<string, string> | undefined)[]): Record<string, string> {
  const merged: Record<string, string> = {};
  for (const headers of headerSources) {
    if (headers) {
      Object.assign(merged, headers);
    }
  }
  return merged;
}
```

**Usage**:
```typescript
const client = new Anthropic({
  apiKey,
  baseUrl: model.baseUrl,
  dangerouslyAllowBrowser: true,
  defaultHeaders: mergeHeaders(
    {
      accept: "application/json",
      "anthropic-dangerous-direct-browser-access": "true",
      "anthropic-beta": betaFeatures.join(","),
    },
    model.headers,
    dynamicHeaders,
    optionsHeaders,
  ),
});
```

---

## PH�N 25: IMAGE SUPPORT

### 25.1 Image Content

```typescript
export interface ImageContent {
  type: "image";
  data: string; // base64 encoded
  mimeType: string;
}
```

### 25.2 Image Conversion

**Anthropic**:
```typescript
function convertContentBlocks(content: (TextContent | ImageContent)[]):
  | string
  | Array<
      | { type: "text"; text: string }
      | {
          type: "image";
          source: {
            type: "base64";
            media_type: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
            data: string;
          };
        }
    >
```

**OpenAI Completions**:
```typescript
const content: ChatCompletionContentPart[] = msg.content.map((item): ChatCompletionContentPart => {
  if (item.type === "text") {
    return {
      type: "text",
      text: sanitizeSurrogates(item.text),
    } satisfies ChatCompletionContentPartText;
  } else {
    return {
      type: "image_url",
      image_url: {
        url: `data:${item.mimeType};base64,${item.data}`,
      },
    } satisfies ChatCompletionContentPartImage;
  }
});
```

---

## PH�N 26: UNICODE HANDLING

### 26.1 Surrogate Sanitization

**Purpose**: Sanitize Unicode surrogates for API compatibility

**Usage**:
```typescript
return sanitizeSurrogates(content.map((c) => (c as TextContent).text).join("\n"));
```

---

## PH�N 27: MODEL GENERATED DATA (models.generated.ts)

**File**: `packages/ai/src/models.generated.ts` (auto-generated, ~1903+ lines)

**Purpose**: Auto-generated model definitions with metadata

**Structure**:
```typescript
export const MODELS = {
  "amazon-bedrock": {
    "amazon.nova-2-lite-v1:0": {
      id: "amazon.nova-2-lite-v1:0",
      name: "Nova 2 Lite",
      api: "bedrock-converse-stream",
      provider: "amazon-bedrock",
      baseUrl: "https://bedrock-runtime.us-east-1.amazonaws.com",
      reasoning: false,
      input: ["text", "image"],
      cost: { input: 0.33, output: 2.75, cacheRead: 0, cacheWrite:0 },
      contextWindow: 128000,
      maxTokens: 4096,
    } satisfies Model<"bedrock-converse-stream">,
    // ... more models
  },
  "anthropic": {
    "claude-3-5-haiku-20241022": {
      id: "claude-3-5-haiku-20241022",
      name: "Claude Haiku 3.5",
      api: "anthropic-messages",
      provider: "anthropic",
      baseUrl: "https://api.anthropic.com",
      reasoning: false,
      input: ["text", "image"],
      cost: { input: 0.8, output: 4, cacheRead: 0.08, cacheWrite: 1 },
      contextWindow: 200000,
      maxTokens: 8192,
    } satisfies Model<"anthropic-messages">,
    // ... more models
  },
  // ... more providers
};
```

---

## PHẦN 28: KEY DESIGN PATTERNS

### 28.1 Provider Abstraction

**Pattern**: Each provider implements the same `StreamFunction` interface

**Benefits**:
- Unified interface for all providers
- Easy to add new providers
- Provider-specific options via generics

### 28.2 Event-Driven Streaming

**Pattern**: Push events to stream as they arrive

**Benefits**:
- Real-time updates
- Incremental message building
- Consumer can process events as they arrive

### 28.3 Lazy Loading

**Pattern**: Load provider modules on first use

**Benefits**:
- Faster initial load time
- Only load providers that are used
- Smaller bundle size

### 28.4 Compatibility Detection

**Pattern**: Auto-detect provider capabilities from URL/provider

**Benefits**:
- No manual configuration needed
- Works with custom providers
- Handles provider quirks automatically

### 28.5 Error Recovery

**Pattern**: Encode errors in stream, don't throw

**Benefits**:
- Consistent error handling
- Consumer can handle errors gracefully
- No uncaught exceptions

---

## PHẦN 29: TESTING

**Test Files**: ~60 test files covering:
- Provider-specific tests
- Cross-provider compatibility
- Overflow detection
- Tool call handling
- Streaming behavior
- OAuth authentication
- Model compatibility
- Error scenarios

---

## PHẦN 30: DEPENDENCIES

**External Dependencies**:
- `@anthropic-ai/sdk` - Anthropic API client
- `openai` - OpenAI API client
- `@mistralai/mistralai` - Mistral API client
- `@google/genai` - Google API client
- `@sinclair/typebox` - Schema validation
- `ajv` - JSON Schema validation
- `ajv-formats` - AJV format plugins

**Internal Dependencies**:
- All providers depend on core types and utilities
- Utils are shared across providers
- Registry manages provider registration

---

## PHẦN 31: SECURITY CONSIDERATIONS

### 31.1 API Key Handling

- API keys are resolved from environment variables
- OAuth tokens are supported for specific providers
- No hardcoded credentials

### 31.2 Input Validation

- Tool arguments are validated against schemas
- Type coercion is applied where possible
- Validation errors are formatted clearly

### 31.3 Error Information

- Error messages are sanitized before display
- Sensitive information is not exposed
- Stack traces are included in error messages

### 31.4 Browser Compatibility

- CSP restrictions are detected
- Runtime code generation is disabled in browser extensions
- Fallback validation when AJV unavailable

---

## PHẦN 32: PERFORMANCE CONSIDERATIONS

### 32.1 Lazy Loading

- Provider modules are loaded on first use
- Reduces initial bundle size
- Only loads what's needed

### 32.2 Streaming

- Responses are streamed incrementally
- No waiting for complete response
- Real-time updates to UI

### 32.3 Caching

- Prompt caching is supported where available
- Cache retention can be configured
- Reduces costs for repeated prompts

### 32.4 Token Counting

- Tokens are counted accurately
- Costs are calculated automatically
- Usage is tracked per request

---

## PHẦN 33: EXTENSIBILITY

### 33.1 Adding New Providers

1. Create provider file in `src/providers/`
2. Implement `StreamFunction` for the provider
3. Register provider in `register-builtins.ts`
4. Add model definitions to `models.generated.ts`

### 33.2 Custom Models

- Models can be added via settings.json
- Custom providers can be registered
- Model metadata includes cost, context window, etc.

### 33.3 Custom Options

- Provider-specific options via generics
- Compatibility overrides via `compat` field
- Custom headers via `headers` option

---

## KẾT LUẬN

Package `packages/ai/` là một thư viện well-designed với:

**Điểm mạnh**:
1. **Abstraction layer mạnh mẽ**: Interface thống nhất cho nhiều providers
2. **Streaming architecture**: Event-driven, real-time updates
3. **Provider diversity**: Hỗ trợ nhiều AI providers
4. **Lazy loading**: Tối ưu hiệu năng bundle
5. **Compatibility layer**: Tự động detect provider capabilities
6. **Error handling**: Xử lý lỗi nhất quán
7. **Type safety**: TypeScript với strict typing
8. **Testing**: Bao phủ nhiều test cases

**Điểm cần cải thiện**:
1. Documentation cần chi tiết hơn cho một số providers
2. Error messages có thể rõ ràng hơn
3. Một số providers có thể cần thêm test coverage
4. Performance monitoring cần được thêm
5. Debugging tools cho streaming events

**Architecture**:
- Core types → Provider implementations → Utility functions
- Event-driven streaming throughout
- Registry pattern for provider management
- Lazy loading for performance
- Compatibility layer for provider quirks
- Validation layer for tool arguments
- Overflow detection for context management
