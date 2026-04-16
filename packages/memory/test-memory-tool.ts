#!/usr/bin/env tsx
/**
 * Comprehensive test of memory tool to find bugs
 * Tests all operations with various edge cases
 */

import { createSQLiteStore, createMemoryEngine, createLLMToolInterface } from "./src/index.js";
import { rmSync } from "node:fs";

const TEST_DB = "/tmp/test-memory-tool.db";

// Clean up before test
try {
  rmSync(TEST_DB);
} catch {}

console.log("🧪 Testing Memory Tool...\n");

// Test 1: Basic save operation
console.log("Test 1: Basic save operation");
try {
  const store = createSQLiteStore(TEST_DB);
  const engine = createMemoryEngine(store);
  
  const result = engine.save({
    content: "User uses 4 spaces for indentation",
    type: "preference",
    tags: ["style", "python"],
    weight: 0.8,
  });
  
  if (result.ok) {
    console.log("✅ Save succeeded, ID:", result.value.id);
  } else {
    console.log("❌ Save failed:", result.error);
  }
} catch (e) {
  console.log("❌ Exception:", (e as Error).message);
}

// Test 2: Save with missing optional fields
console.log("\nTest 2: Save with missing optional fields");
try {
  const store = createSQLiteStore(TEST_DB);
  const engine = createMemoryEngine(store);
  
  const result = engine.save({
    content: "Project uses PostgreSQL",
    type: "project",
  });
  
  if (result.ok) {
    console.log("✅ Save succeeded with defaults, ID:", result.value.id);
    console.log("   Weight:", result.value.weight);
    console.log("   Tags:", result.value.tags);
  } else {
    console.log("❌ Save failed:", result.error);
  }
} catch (e) {
  console.log("❌ Exception:", (e as Error).message);
}

// Test 3: Find operation
console.log("\nTest 3: Find operation");
try {
  const store = createSQLiteStore(TEST_DB);
  const engine = createMemoryEngine(store);
  
  const result = engine.find("indentation");
  
  if (result.ok) {
    console.log("✅ Find succeeded, found:", result.value.total, "memories");
    if (result.value.memories.length > 0) {
      console.log("   First result:", result.value.memories[0].content);
    }
  } else {
    console.log("❌ Find failed:", result.error);
  }
} catch (e) {
  console.log("❌ Exception:", (e as Error).message);
}

// Test 4: Find with filters
console.log("\nTest 4: Find with type filter");
try {
  const store = createSQLiteStore(TEST_DB);
  const engine = createMemoryEngine(store);
  
  const result = engine.find("spaces", { type: "preference" });
  
  if (result.ok) {
    console.log("✅ Find with filter succeeded, found:", result.value.total, "memories");
  } else {
    console.log("❌ Find failed:", result.error);
  }
} catch (e) {
  console.log("❌ Exception:", (e as Error).message);
}

// Test 5: Get operation
console.log("\nTest 5: Get operation by ID");
try {
  const store = createSQLiteStore(TEST_DB);
  const engine = createMemoryEngine(store);
  
  // First save a memory to get its ID
  const saveResult = engine.save({
    content: "Test memory for get",
    type: "note",
  });
  
  if (saveResult.ok) {
    const getResult = engine.get(saveResult.value.id);
    
    if (getResult.ok) {
      if (getResult.value) {
        console.log("✅ Get succeeded, content:", getResult.value.content);
      } else {
        console.log("❌ Get returned null");
      }
    } else {
      console.log("❌ Get failed:", getResult.error);
    }
  }
} catch (e) {
  console.log("❌ Exception:", (e as Error).message);
}

// Test 6: Update operation
console.log("\nTest 6: Update operation");
try {
  const store = createSQLiteStore(TEST_DB);
  const engine = createMemoryEngine(store);
  
  // Save first
  const saveResult = engine.save({
    content: "Original content",
    type: "note",
  });
  
  if (saveResult.ok) {
    const updateResult = engine.update(saveResult.value.id, {
      content: "Updated content",
      weight: 0.9,
    });
    
    if (updateResult.ok) {
      if (updateResult.value) {
        console.log("✅ Update succeeded, new content:", updateResult.value.content);
        console.log("   New weight:", updateResult.value.weight);
      } else {
        console.log("❌ Update returned null (memory not found)");
      }
    } else {
      console.log("❌ Update failed:", updateResult.error);
    }
  }
} catch (e) {
  console.log("❌ Exception:", (e as Error).message);
}

// Test 7: Delete operation
console.log("\nTest 7: Delete operation");
try {
  const store = createSQLiteStore(TEST_DB);
  const engine = createMemoryEngine(store);
  
  // Save first
  const saveResult = engine.save({
    content: "To be deleted",
    type: "note",
  });
  
  if (saveResult.ok) {
    const deleteId = saveResult.value.id;
    const deleteResult = engine.delete(deleteId);
    
    if (deleteResult.ok) {
      console.log("✅ Delete succeeded, deleted:", deleteResult.value);
      
      // Try to get it again
      const getResult = engine.get(deleteId);
      if (getResult.ok && !getResult.value) {
        console.log("✅ Memory confirmed deleted");
      }
    } else {
      console.log("❌ Delete failed:", deleteResult.error);
    }
  }
} catch (e) {
  console.log("❌ Exception:", (e as Error).message);
}

// Test 8: Stats operation
console.log("\nTest 8: Stats operation");
try {
  const store = createSQLiteStore(TEST_DB);
  const engine = createMemoryEngine(store);
  
  const result = engine.stats();
  
  if (result.ok) {
    console.log("✅ Stats succeeded:");
    console.log("   Total:", result.value.total);
    console.log("   By type:", result.value.byType);
    console.log("   Avg weight:", result.value.averageWeight);
  } else {
    console.log("❌ Stats failed:", result.error);
  }
} catch (e) {
  console.log("❌ Exception:", (e as Error).message);
}

// Test 9: Empty query
console.log("\nTest 9: Empty query");
try {
  const store = createSQLiteStore(TEST_DB);
  const engine = createMemoryEngine(store);
  
  const result = engine.find("");
  
  if (result.ok) {
    console.log("✅ Empty query handled, found:", result.value.total, "memories");
  } else {
    console.log("❌ Empty query failed:", result.error);
  }
} catch (e) {
  console.log("❌ Exception:", (e as Error).message);
}

// Test 10: Non-existent ID
console.log("\nTest 10: Get non-existent ID");
try {
  const store = createSQLiteStore(TEST_DB);
  const engine = createMemoryEngine(store);
  
  const result = engine.get("non_existent_id_12345");
  
  if (result.ok) {
    if (!result.value) {
      console.log("✅ Non-existent ID returns null correctly");
    } else {
      console.log("❌ Non-existent ID should return null");
    }
  } else {
    console.log("❌ Get failed:", result.error);
  }
} catch (e) {
  console.log("❌ Exception:", (e as Error).message);
}

// Test 11: Update non-existent ID
console.log("\nTest 11: Update non-existent ID");
try {
  const store = createSQLiteStore(TEST_DB);
  const engine = createMemoryEngine(store);
  
  const result = engine.update("non_existent_id_12345", {
    content: "Should fail gracefully",
  });
  
  if (result.ok) {
    if (!result.value) {
      console.log("✅ Update non-existent returns null correctly");
    } else {
      console.log("❌ Update non-existent should return null");
    }
  } else {
    console.log("❌ Update failed:", result.error);
  }
} catch (e) {
  console.log("❌ Exception:", (e as Error).message);
}

// Test 12: Save with expired memory
console.log("\nTest 12: Save with expired memory");
try {
  const store = createSQLiteStore(TEST_DB);
  const engine = createMemoryEngine(store);
  
  const result = engine.save({
    content: "Expired memory",
    type: "note",
    expires_at: Date.now() - 1000, // Already expired
  });
  
  if (result.ok) {
    console.log("✅ Expired memory saved, ID:", result.value.id);
    
    // Try to get it
    const getResult = engine.get(result.value.id);
    if (getResult.ok && !getResult.value) {
      console.log("✅ Expired memory automatically deleted on get");
    } else if (getResult.ok && getResult.value) {
      console.log("⚠️  Expired memory still accessible (bug?)");
    }
  } else {
    console.log("❌ Save failed:", result.error);
  }
} catch (e) {
  console.log("❌ Exception:", (e as Error).message);
}

// Test 13: Tags filtering
console.log("\nTest 13: Tags filtering");
try {
  const store = createSQLiteStore(TEST_DB);
  const engine = createMemoryEngine(store);
  
  // Save with multiple tags
  engine.save({
    content: "Memory with tag A and B",
    type: "note",
    tags: ["tagA", "tagB"],
  });
  
  // Find with one tag
  const result = engine.find("memory", { tags: ["tagA"] });
  
  if (result.ok) {
    console.log("✅ Tag filter succeeded, found:", result.value.total, "memories");
  } else {
    console.log("❌ Tag filter failed:", result.error);
  }
} catch (e) {
  console.log("❌ Exception:", (e as Error).message);
}

// Test 14: LLM Tool Interface
console.log("\nTest 14: LLM Tool Interface");
try {
  const store = createSQLiteStore(TEST_DB);
  const engine = createMemoryEngine(store);
  const tools = createLLMToolInterface(engine);
  
  // Get tools
  const toolDefs = tools.getTools();
  console.log("✅ Got tool definitions:", toolDefs.length, "tools");
  
  // Execute save
  const saveResult = await tools.executeTool("memory", {
    op: {
      op: "save",
      content: "Tool test memory",
      type: "note",
    },
  });
  
  if (saveResult.ok) {
    console.log("✅ Tool save succeeded");
  } else {
    console.log("❌ Tool save failed:", saveResult.error);
  }
  
  // Execute find
  const findResult = await tools.executeTool("memory", {
    op: {
      op: "find",
      query: "tool test",
    },
  });
  
  if (findResult.ok) {
    console.log("✅ Tool find succeeded, found:", (findResult.value as any).total, "memories");
  } else {
    console.log("❌ Tool find failed:", findResult.error);
  }
  
  // Format result
  const formatted = tools.formatToolResult(saveResult);
  console.log("✅ Formatted result:", formatted.substring(0, 100));
  
  // System prompt
  const prompt = tools.generateSystemPrompt();
  console.log("✅ System prompt generated, length:", prompt.length, "chars");
} catch (e) {
  console.log("❌ Exception:", (e as Error).message);
}

// Test 15: List operation
console.log("\nTest 15: List operation");
try {
  const store = createSQLiteStore(TEST_DB);
  
  const result = store.list({ limit: 5 });
  
  console.log("✅ List succeeded, returned:", result.length, "memories");
  if (result.length > 0) {
    console.log("   First memory ID:", result[0].id);
    console.log("   First memory type:", result[0].type);
  }
} catch (e) {
  console.log("❌ Exception:", (e as Error).message);
}

// Test 16: Export/Import
console.log("\nTest 16: Export/Import");
try {
  const store = createSQLiteStore(TEST_DB);
  
  // Export
  const exported = store.exportJSON();
  console.log("✅ Export succeeded, size:", exported.length, "bytes");
  
  // Import to new store
  const TEST_DB2 = "/tmp/test-memory-tool2.db";
  try { rmSync(TEST_DB2); } catch {}
  
  const store2 = createSQLiteStore(TEST_DB2);
  const importResult = store2.importJSON(exported);
  
  if (importResult.ok) {
    console.log("✅ Import succeeded, imported:", importResult.value, "memories");
  } else {
    console.log("❌ Import failed:", importResult.error);
  }
} catch (e) {
  console.log("❌ Exception:", (e as Error).message);
}

// Test 17: Transaction
console.log("\nTest 17: Transaction");
try {
  const store = createSQLiteStore(TEST_DB);
  
  const result = store.transaction((s) => {
    s.save({ content: "Tx memory 1", type: "note" });
    s.save({ content: "Tx memory 2", type: "note" });
    return "success";
  });
  
  if (result.ok) {
    console.log("✅ Transaction succeeded:", result.value);
  } else {
    console.log("❌ Transaction failed:", result.error);
  }
} catch (e) {
  console.log("❌ Exception:", (e as Error).message);
}

// Test 18: Delete by file path
console.log("\nTest 18: Delete by file path");
try {
  const store = createSQLiteStore(TEST_DB);
  
  // Save a code symbol memory
  const saveResult = store.save({
    content: "Function definition",
    type: "code_symbol",
    file_path: "/test/file.ts",
    metadata: { symbol_type: "function" },
  });
  
  if (saveResult.ok) {
    const deleteResult = store.deleteByFilePath("/test/file.ts");
    
    if (deleteResult.ok) {
      console.log("✅ Delete by path succeeded, deleted:", deleteResult.value, "memories");
    } else {
      console.log("❌ Delete by path failed:", deleteResult.error);
    }
  }
} catch (e) {
  console.log("❌ Exception:", (e as Error).message);
}

// Test 19: Expunge
console.log("\nTest 19: Expunge");
try {
  const store = createSQLiteStore(TEST_DB);
  
  const result = store.expunge();
  
  if (result.ok) {
    console.log("✅ Expunge succeeded, deleted:", result.value, "expired memories");
  } else {
    console.log("❌ Expunge failed:", result.error);
  }
} catch (e) {
  console.log("❌ Exception:", (e as Error).message);
}

// Test 20: Clear
console.log("\nTest 20: Clear");
try {
  const store = createSQLiteStore(TEST_DB);
  
  store.clear();
  
  const stats = store.stats();
  if (stats.ok && stats.value.total === 0) {
    console.log("✅ Clear succeeded, total memories:", stats.value.total);
  } else {
    console.log("❌ Clear failed or memories remain");
  }
} catch (e) {
  console.log("❌ Exception:", (e as Error).message);
}

console.log("\n✅ All tests completed!");
console.log("\n📝 Summary: Check for any ❌ errors above");
