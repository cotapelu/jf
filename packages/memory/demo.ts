/**
 * Demo: How Agent uses Memory System
 * 
 * This is a STANDALONE demo file - does not modify existing packages.
 * Shows 2 integration patterns:
 * 1. Transform Context - auto inject memory context to LLM
 * 2. Tool Interface - LLM can call memory operations
 */

import {
  createMemoryEngine,
  createLLMToolInterface,
  MemoryInput,
} from "./src/index.js";

// ============================================================================
// MOCK AGENT & LLM - Just for demonstration
// ============================================================================

type Message = {
  role: "system" | "user" | "assistant";
  content: string;
  timestamp: number;
};

type ToolCall = {
  name: string;
  args: Record<string, unknown>;
};

type LLMResponse = {
  content: string;
  toolCalls?: ToolCall[];
};

// Mock LLM client (thay bằng pi-ai trong thực tế)
const mockLLM = async (messages: Message[]): Promise<LLMResponse> => {
  // Trong thực tế, đây sẽ là: openai.chat.completions.create(messages)
  // Ở đây demo đơn giản
  const lastUserMsg = messages.find(m => m.role === "user");
  
  if (lastUserMsg?.content.includes("thích")) {
    return {
      content: "Tôi thấy bạn đang nói về sở thích. Để tôi kiểm tra memory...",
    };
  }
  
  return {
    content: "Tôi đã hiểu. Có gì tôi có thể giúp không?",
  };
};

// ============================================================================
// PATTERN 1: TRANSFORM CONTEXT - Auto inject memory context
// ============================================================================

/**
 * Pattern 1: Agent tự động lấy context từ memory trước khi gọi LLM
 * 
 * Flow:
 * 1. User gửi message
 * 2. Agent lấy context từ memory (buildContext)
 * 3. Inject context vào messages
 * 4. Gọi LLM với context đầy đủ
 */

async function runWithTransformContext() {
  console.log("=".repeat(60));
  console.log("PATTERN 1: TRANSFORM CONTEXT");
  console.log("=".repeat(60));

  // 1. Create memory engine
  const memory = createMemoryEngine();

  // 2. Lưu một số memories (giả sử từ previous conversations)
  console.log("\n--- Step 1: Save some memories ---\n");
  
  memory.createMemory({
    type: "long_term",
    content: { text: "User thích màu xanh da trời" },
    tags: ["preference", "color"],
    weight: 0.8,
  });

  memory.createMemory({
    type: "long_term",
    content: { text: "User làm việc với TypeScript" },
    tags: ["preference", "work"],
    weight: 0.7,
  });

  memory.createMemory({
    type: "short_term",
    content: { text: "User đang hỏi về preferences" },
    tags: ["conversation", "current"],
    weight: 0.5,
  });

  console.log("✓ Saved 3 memories to memory system");

  // 3. Transform context function (như agent sẽ làm)
  const transformContext = async (messages: Message[]): Promise<Message[]> => {
    // Lấy user message cuối
    const lastUserMsg = messages.filter(m => m.role === "user").pop();
    if (!lastUserMsg) return messages;

    // Build context từ memory
    const contextResult = memory.buildContext(lastUserMsg.content, {
      limit: 5,
      types: ["long_term", "short_term"],
    });

    if (!contextResult.ok) {
      console.log("⚠ Memory buildContext failed:", contextResult.error.message);
      return messages;
    }

    // Inject context as system message
    const contextMessage: Message = {
      role: "system",
      content: `## Context từ Memory\n${contextResult.value.text}`,
      timestamp: Date.now(),
    };

    console.log("\n--- Memory Context built ---\n");
    console.log(contextMessage.content.substring(0, 200) + "...");

    return [...messages, contextMessage];
  };

  // 4. Simulate agent flow
  console.log("\n--- Step 2: User asks about preferences ---\n");
  
  const userMessage: Message = {
    role: "user",
    content: "Tôi thích màu gì?",
    timestamp: Date.now(),
  };

  // Flow: User → Transform Context → LLM
  let messages: Message[] = [userMessage];
  messages = await transformContext(messages);

  console.log("\n--- Step 3: Call LLM with context ---\n");
  const llmResponse = await mockLLM(messages);

  console.log("LLM Response:");
  console.log(`  ${llmResponse.content}`);
  console.log("\n→ LLM có context từ memory để trả lời chính xác!\n");
}

// ============================================================================
// PATTERN 2: TOOL INTERFACE - LLM calls memory operations
// ============================================================================

/**
 * Pattern 2: Expose memory as tools cho LLM gọi
 * 
 * Flow:
 * 1. LLM quyết định cần dùng memory
 * 2. LLM gọi tool (create_memory, retrieve_memories, etc)
 * 3. System validate + execute
 * 4. Trả kết quả cho LLM
 */

async function runWithToolInterface() {
  console.log("=".repeat(60));
  console.log("PATTERN 2: TOOL INTERFACE");
  console.log("=".repeat(60));

  // 1. Create memory + tool interface
  const memory = createMemoryEngine();
  const toolInterface = createLLMToolInterface(memory);

  console.log("\n--- Available Memory Tools ---\n");
  const tools = toolInterface.getTools();
  tools.forEach(tool => {
    console.log(`- ${tool.name}: ${tool.description}`);
  });

  // 2. Simulate LLM calling tools
  
  // Tool 1: LLM muốn lưu preference
  console.log("\n--- Tool Call 1: create_memory ---\n");
  
  const createResult = await toolInterface.executeTool("create_memory", {
    type: "long_term",
    content: { text: "User thích coffee vào buổi sáng" },
    tags: ["preference", "drink"],
    weight: 0.8,
  });

  if (createResult.ok) {
    console.log("✓ Memory created!");
    console.log(`  ID: ${createResult.value.id}`);
    console.log(`  Type: ${createResult.value.type}`);
  } else {
    console.log("✗ Failed:", createResult.error.message);
  }

  // Tool 2: LLM muốn tìm memories
  console.log("\n--- Tool Call 2: retrieve_memories ---\n");
  
  const retrieveResult = await toolInterface.executeTool("retrieve_memories", {
    query: "user preference",
    limit: 5,
  });

  if (retrieveResult.ok) {
    console.log("✓ Retrieved memories:");
    retrieveResult.value.forEach((ranked, i) => {
      console.log(`  ${i + 1}. [${ranked.memory.type}] ${ranked.memory.content.text}`);
      console.log(`     Score: ${ranked.score.toFixed(2)}, Tags: ${ranked.memory.tags.join(", ")}`);
    });
  }

  // Tool 3: LLM muốn xóa
  console.log("\n--- Tool Call 3: get_memory_stats ---\n");
  
  const statsResult = await toolInterface.executeTool("get_memory_stats", {});
  
  if (statsResult.ok) {
    console.log("✓ Memory Stats:");
    console.log(`  Total: ${statsResult.value.totalMemories}`);
    console.log(`  By Type:`, statsResult.value.byType);
  }

  console.log("\n→ LLM có thể chủ động quản lý memory!\n");
}

// ============================================================================
// PATTERN 3: HYBRID - Combine both patterns
// ============================================================================

/**
 * Pattern 3: Hybrid - Dùng cả transform context + tools
 * 
 * - TransformContext: always inject relevant context
 * - ToolInterface: cho phép LLM chủ động create/update/retrieve
 */

async function runHybrid() {
  console.log("=".repeat(60));
  console.log("PATTERN 3: HYBRID (Transform + Tools)");
  console.log("=".repeat(60));

  const memory = createMemoryEngine();
  const toolInterface = createLLMToolInterface(memory);

  // Pre-populate
  memory.createMemory({
    type: "long_term",
    content: { text: "User tên là Minh" },
    tags: ["profile"],
    weight: 0.9,
  });

  // Transform function
  const transformContext = async (msg: string) => {
    const result = memory.buildContext(msg, { limit: 3 });
    return result.ok ? result.value.text : "";
  };

  // Simulate conversation
  console.log("\n--- Turn 1: User introduces themselves ---\n");
  
  // Transform + call
  const context = await transformContext("Xin chào, tôi là Minh");
  console.log("Context injected:", context ? "Yes" : "No");
  
  // LLM decides to save this
  await toolInterface.executeTool("create_memory", {
    type: "long_term",
    content: { text: "User tên là Minh, đang giới thiệu bản thân" },
    tags: ["profile", "intro"],
    weight: 0.7,
  });

  console.log("\n--- Turn 2: User asks about themselves ---\n");
  
  // Transform + call  
  const context2 = await transformContext("Tôi tên gì?");
  console.log("Context for 'Tôi tên gì?':");
  console.log(`  ${context2.substring(0, 150)}...`);

  console.log("\n→ Hybrid: Auto context + LLM can manage memory!\n");
}

// ============================================================================
// RUN ALL DEMOS
// ============================================================================

async function main() {
  await runWithTransformContext();
  await runWithToolInterface();
  await runHybrid();
  
  console.log("=".repeat(60));
  console.log("DEMO COMPLETE!");
  console.log("=".repeat(60));
  console.log("\nSummary:");
  console.log("- Pattern 1: Auto inject memory context (transformContext)");
  console.log("- Pattern 2: LLM calls memory tools (LLM = PROPOSER)");
  console.log("- Pattern 3: Hybrid - combine both");
}

main().catch(console.error);