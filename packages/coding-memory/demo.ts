/**
 * Demo: Coding Memory in Action
 *
 * Shows how a coding agent uses memory to remember:
 * - User preferences
 * - Project facts
 * - Commands
 * - Bug solutions
 */

import {
  createSQLiteStore,
  createMemoryEngine,
  createLLMToolInterface,
  type MemoryInput,
} from "./src/index.js";

// Simulate a coding agent session
async function demo() {
  console.log("=".repeat(60));
  console.log("CODING MEMORY DEMO");
  console.log("=".repeat(60));

  // Create a persistent store (in production: ~/.pi/agent/memory.db)
  const store = createSQLiteStore(":memory:"); // Use file path for persistence
  const engine = createMemoryEngine(store);
  const tools = createLLMToolInterface(engine);

  console.log("\n--- SESSION 1: User shares info ---\n");

  // Agent "learns" about user and project
  console.log("User: 'I use 4 spaces for Python indentation'");
  const save1 = engine.save({
    content: "User uses 4 spaces for indentation",
    type: "preference",
    tags: ["style", "python"],
    weight: 0.8,
  });
  console.log(`Agent saved: ${save1.ok ? "✓" : "✗"} ${save1.ok ? save1.value.id : save1.error}`);

  console.log("\nUser: 'Project backend uses PostgreSQL 14 on port 5432'");
  engine.save({
    content: "PostgreSQL 14 on port 5432",
    type: "project",
    tags: ["database", "postgres"],
    weight: 0.9,
  });

  console.log("\nUser: 'Test command: npm run test:cov -- --ui'");
  engine.save({
    content: "npm run test:cov -- --ui",
    type: "command",
    tags: ["test", "npm"],
    weight: 0.7,
  });

  console.log("\n--- Show memory stats ---\n");
  const stats = engine.stats();
  console.log(`Total memories: ${stats.value.total}`);
  console.log(`By type:`, stats.value.byType);
  console.log(`By tags:`, stats.value.byTags);

  console.log("\n--- SESSION 2 (new): Agent recalls info ---\n");

  // Simulate new session - agent recalls everything
  console.log("User: 'How should I format my Python code?'");
  console.log("Agent: Let me check memory...");

  const find1 = engine.find("indentation style");
  if (find1.value.memories.length > 0) {
    console.log(`  Found: "${find1.value.memories[0].content}"`);
    console.log(`  (Type: ${find1.value.memories[0].type}, Tags: ${find1.value.memories[0].tags.join(", ")})`);
  }

  console.log("\nUser: 'What database does the project use?'");
  const find2 = engine.find("database");
  if (find2.value.memories.length > 0) {
    console.log(`  Found: "${find2.value.memories[0].content}"`);
  }

  console.log("\nUser: 'Run the tests'");
  console.log("Agent: I remember the test command...");
  const find3 = engine.find("test command");
  if (find3.value.memories.length > 0) {
    console.log(`  Command: "${find3.value.memories[0].content}"`);
  }

  console.log("\n--- MEMORY TOOLS (for LLM) ---\n");
  console.log("Available tools:");
  tools.getTools().forEach((tool) => {
    console.log(`  • ${tool.name}: ${tool.description}`);
  });

  console.log("\n--- SYSTEM PROMPT FOR LLM ---\n");
  console.log(tools.generateSystemPrompt());

  console.log("\n" + "=".repeat(60));
  console.log("DEMO COMPLETE!");
  console.log("=".repeat(60));
  console.log("\nKey takeaways:");
  console.log("1. Agent proactively saves user preferences");
  console.log("2. Agent recalls info in new sessions");
  console.log("3. Memory persists across sessions (file-based)");
  console.log("4. LLM uses tools: memory_save, memory_find, memory_forget, memory_stats");
  console.log("5. No context bloat - only fetch when needed");
}

demo().catch(console.error);
