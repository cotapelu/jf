#!/usr/bin/env tsx
/**
 * Edge case tests for memory tool
 * Tests scenarios that might cause bugs
 */

import { createSQLiteStore, createMemoryEngine, createLLMToolInterface } from "./src/index.js";
import { rmSync } from "node:fs";

const TEST_DB = "/tmp/test-memory-edge-cases.db";

// Clean up before test
try {
  rmSync(TEST_DB);
} catch {}

console.log("🧪 Testing Memory Tool Edge Cases...\n");

// Test 1: Save with very long content
console.log("Test 1: Save with very long content (10000 chars)");
try {
  const store = createSQLiteStore(TEST_DB);
  const engine = createMemoryEngine(store);
  
  const longContent = "a".repeat(10000);
  const result = engine.save({
    content: longContent,
    type: "note",
  });
  
  if (result.ok) {
    console.log("✅ Long content saved successfully");
    const getRes = engine.get(result.value.id);
    if (getRes.ok && getRes.value?.content.length === 10000) {
      console.log("✅ Long content retrieved correctly");
    }
  } else {
    console.log("❌ Long content save failed:", result.error);
  }
} catch (e) {
  console.log("❌ Exception:", (e as Error).message);
}

// Test 2: Save with content exceeding max length
console.log("\nTest 2: Save with content > 10000 chars (should fail validation)");
try {
  const store = createSQLiteStore(TEST_DB);
  const engine = createMemoryEngine(store);
  
  const tooLongContent = "a".repeat(10001);
  const result = engine.save({
    content: tooLongContent,
    type: "note",
  });
  
  if (!result.ok) {
    console.log("✅ Correctly rejected content > 10000 chars");
  } else {
    console.log("⚠️  Content > 10000 chars was accepted (validation issue?)");
  }
} catch (e) {
  console.log("✅ Exception caught:", (e as Error).message);
}

// Test 3: Save with special characters
console.log("\nTest 3: Save with special characters");
try {
  const store = createSQLiteStore(TEST_DB);
  const engine = createMemoryEngine(store);
  
  const specialContent = "Test @#$%^&*() {}[]|\\:;\"'<>,.?/~`!";
  const result = engine.save({
    content: specialContent,
    type: "note",
    tags: ["special", "chars"],
  });
  
  if (result.ok) {
    console.log("✅ Special characters saved");
    const findRes = engine.find("@#$%");
    if (findRes.ok && findRes.value.total > 0) {
      console.log("✅ Special characters searchable");
    } else {
      console.log("⚠️  Special characters not found in search");
    }
  } else {
    console.log("❌ Special characters save failed:", result.error);
  }
} catch (e) {
  console.log("❌ Exception:", (e as Error).message);
}

// Test 4: Save with unicode content
console.log("\nTest 4: Save with unicode content");
try {
  const store = createSQLiteStore(TEST_DB);
  const engine = createMemoryEngine(store);
  
  const unicodeContent = "你好世界 🌍 مرحبا بالعالم שלום עולם";
  const result = engine.save({
    content: unicodeContent,
    type: "note",
  });
  
  if (result.ok) {
    console.log("✅ Unicode content saved");
    const findRes = engine.find("你好");
    if (findRes.ok && findRes.value.total > 0) {
      console.log("✅ Unicode searchable");
    } else {
      console.log("⚠️  Unicode not found in search");
    }
  } else {
    console.log("❌ Unicode save failed:", result.error);
  }
} catch (e) {
  console.log("❌ Exception:", (e as Error).message);
}

// Test 5: Save with empty tags array
console.log("\nTest 5: Save with empty tags array");
try {
  const store = createSQLiteStore(TEST_DB);
  const engine = createMemoryEngine(store);
  
  const result = engine.save({
    content: "Test with empty tags",
    type: "note",
    tags: [],
  });
  
  if (result.ok) {
    console.log("✅ Empty tags array saved");
    console.log("   Tags:", result.value.tags);
  } else {
    console.log("❌ Empty tags save failed:", result.error);
  }
} catch (e) {
  console.log("❌ Exception:", (e as Error).message);
}

// Test 6: Save with too many tags
console.log("\nTest 6: Save with > 20 tags (should fail validation)");
try {
  const store = createSQLiteStore(TEST_DB);
  const engine = createMemoryEngine(store);
  
  const manyTags = Array.from({ length: 25 }, (_, i) => `tag${i}`);
  const result = engine.save({
    content: "Test with many tags",
    type: "note",
    tags: manyTags,
  });
  
  if (!result.ok) {
    console.log("✅ Correctly rejected > 20 tags");
  } else {
    console.log("⚠️  > 20 tags was accepted (validation issue?)");
  }
} catch (e) {
  console.log("✅ Exception caught:", (e as Error).message);
}

// Test 7: Save with invalid type
console.log("\nTest 7: Save with invalid type");
try {
  const store = createSQLiteStore(TEST_DB);
  const engine = createMemoryEngine(store);
  
  // @ts-ignore - testing invalid type
  const result = engine.save({
    content: "Test invalid type",
    type: "invalid_type",
  });
  
  if (!result.ok) {
    console.log("✅ Correctly rejected invalid type");
  } else {
    console.log("❌ Invalid type was accepted");
  }
} catch (e) {
  console.log("✅ Exception caught:", (e as Error).message);
}

// Test 8: Save with weight out of range
console.log("\nTest 8: Save with weight > 1.0");
try {
  const store = createSQLiteStore(TEST_DB);
  const engine = createMemoryEngine(store);
  
  // @ts-ignore - testing invalid weight
  const result = engine.save({
    content: "Test invalid weight",
    type: "note",
    weight: 1.5,
  });
  
  if (result.ok) {
    console.log("⚠️  Weight > 1.0 was accepted (should be 0-1)");
  } else {
    console.log("✅ Correctly rejected weight > 1.0");
  }
} catch (e) {
  console.log("✅ Exception caught:", (e as Error).message);
}

// Test 9: Find with limit 0
console.log("\nTest 9: Find with limit 0");
try {
  const store = createSQLiteStore(TEST_DB);
  const engine = createMemoryEngine(store);
  
  const result = engine.find("test", { limit: 0 });
  
  if (result.ok) {
    console.log("✅ Find with limit 0 handled");
    console.log("   Returned:", result.value.memories.length, "memories");
  } else {
    console.log("❌ Find with limit 0 failed:", result.error);
  }
} catch (e) {
  console.log("❌ Exception:", (e as Error).message);
}

// Test 10: Find with limit > 100
console.log("\nTest 10: Find with limit > 100");
try {
  const store = createSQLiteStore(TEST_DB);
  const engine = createMemoryEngine(store);
  
  // @ts-ignore - testing invalid limit
  const result = engine.find("test", { limit: 150 });
  
  if (result.ok) {
    console.log("⚠️  Limit > 100 was accepted (should be 1-100)");
  } else {
    console.log("✅ Correctly rejected limit > 100");
  }
} catch (e) {
  console.log("✅ Exception caught:", (e as Error).message);
}

// Test 11: Concurrent saves
console.log("\nTest 11: Concurrent saves (100 parallel saves)");
try {
  const store = createSQLiteStore(TEST_DB);
  const engine = createMemoryEngine(store);
  
  const promises = Array.from({ length: 100 }, (_, i) => 
    engine.save({
      content: `Concurrent test ${i}`,
      type: "note",
    })
  );
  
  const results = await Promise.all(promises);
  const successCount = results.filter(r => r.ok).length;
  const failCount = results.filter(r => !r.ok).length;
  
  console.log(`✅ Concurrent saves: ${successCount} succeeded, ${failCount} failed`);
  
  if (failCount > 0) {
    console.log("   First error:", results.find(r => !r.ok)?.error);
  }
} catch (e) {
  console.log("❌ Exception:", (e as Error).message);
}

// Test 12: Update with all fields null/undefined
console.log("\nTest 12: Update with no fields provided");
try {
  const store = createSQLiteStore(TEST_DB);
  const engine = createMemoryEngine(store);
  
  // Save first
  const saveRes = engine.save({ content: "To update", type: "note" });
  if (saveRes.ok) {
    // @ts-ignore - testing empty update
    const updateRes = engine.update(saveRes.value.id, {});
    
    if (updateRes.ok) {
      console.log("✅ Empty update handled");
      if (updateRes.value) {
        console.log("   Content unchanged:", updateRes.value.content);
      }
    } else {
      console.log("❌ Empty update failed:", updateRes.error);
    }
  }
} catch (e) {
  console.log("❌ Exception:", (e as Error).message);
}

// Test 13: Delete and try to get
console.log("\nTest 13: Delete and immediately get");
try {
  const store = createSQLiteStore(TEST_DB);
  const engine = createMemoryEngine(store);
  
  const saveRes = engine.save({ content: "To delete", type: "note" });
  if (saveRes.ok) {
    const id = saveRes.value.id;
    engine.delete(id);
    const getRes = engine.get(id);
    
    if (getRes.ok && !getRes.value) {
      console.log("✅ Get after delete returns null correctly");
    } else {
      console.log("❌ Get after delete should return null");
    }
  }
} catch (e) {
  console.log("❌ Exception:", (e as Error).message);
}

// Test 14: Multiple deletes of same ID
console.log("\nTest 14: Multiple deletes of same ID");
try {
  const store = createSQLiteStore(TEST_DB);
  const engine = createMemoryEngine(store);
  
  const saveRes = engine.save({ content: "Multi delete test", type: "note" });
  if (saveRes.ok) {
    const id = saveRes.value.id;
    const del1 = engine.delete(id);
    const del2 = engine.delete(id);
    
    if (del1.ok && del1.value && del2.ok && !del2.value) {
      console.log("✅ First delete returns true, second returns false");
    } else {
      console.log("❌ Delete behavior unexpected");
    }
  }
} catch (e) {
  console.log("❌ Exception:", (e as Error).message);
}

// Test 15: Tool call with missing op field
console.log("\nTest 15: Tool call with missing op field");
try {
  const store = createSQLiteStore(TEST_DB);
  const engine = createMemoryEngine(store);
  const tools = createLLMToolInterface(engine);
  
  // @ts-ignore - testing missing op
  const result = await tools.executeTool("memory", {});
  
  if (!result.ok) {
    console.log("✅ Missing op correctly rejected:", result.error);
  } else {
    console.log("❌ Missing op was accepted");
  }
} catch (e) {
  console.log("✅ Exception caught:", (e as Error).message);
}

// Test 16: Tool call with unknown op
console.log("\nTest 16: Tool call with unknown op");
try {
  const store = createSQLiteStore(TEST_DB);
  const engine = createMemoryEngine(store);
  const tools = createLLMToolInterface(engine);
  
  // @ts-ignore - testing unknown op
  const result = await tools.executeTool("memory", { op: "unknown" });
  
  if (!result.ok) {
    console.log("✅ Unknown op correctly rejected:", result.error);
  } else {
    console.log("❌ Unknown op was accepted");
  }
} catch (e) {
  console.log("✅ Exception caught:", (e as Error).message);
}

// Test 17: Save code symbol memory
console.log("\nTest 17: Save code symbol memory");
try {
  const store = createSQLiteStore(TEST_DB);
  const engine = createMemoryEngine(store);
  
  const result = engine.save({
    content: "Function definition",
    type: "code_symbol",
    symbol_type: "function",
    file_path: "/test/file.ts",
    line_start: 10,
    line_end: 25,
    language: "typescript",
    signature: "function myFunc(arg: string): void",
  });
  
  if (result.ok) {
    console.log("✅ Code symbol saved");
    console.log("   File:", result.value.metadata?.file_path);
    console.log("   Lines:", result.value.metadata?.line_start, "-", result.value.metadata?.line_end);
  } else {
    console.log("❌ Code symbol save failed:", result.error);
  }
} catch (e) {
  console.log("❌ Exception:", (e as Error).message);
}

// Test 18: Metadata with nested objects
console.log("\nTest 18: Metadata with nested objects");
try {
  const store = createSQLiteStore(TEST_DB);
  const engine = createMemoryEngine(store);
  
  const result = engine.save({
    content: "Test nested metadata",
    type: "note",
    metadata: {
      nested: {
        level1: {
          level2: "deep value",
        },
      },
      array: [1, 2, 3],
    },
  });
  
  if (result.ok) {
    console.log("✅ Nested metadata saved");
    const getRes = engine.get(result.value.id);
    if (getRes.ok && getRes.value) {
      console.log("   Nested structure preserved:", JSON.stringify(getRes.value.metadata)?.substring(0, 50));
    }
  } else {
    console.log("❌ Nested metadata save failed:", result.error);
  }
} catch (e) {
  console.log("❌ Exception:", (e as Error).message);
}

// Test 19: Auto-expire memory
console.log("\nTest 19: Auto-expire memory");
try {
  const store = createSQLiteStore(TEST_DB);
  const engine = createMemoryEngine(store);
  
  const result = engine.save({
    content: "Will expire",
    type: "note",
    expires_at: Date.now() + 100, // Expire in 100ms
  });
  
  if (result.ok) {
    console.log("✅ Expiring memory saved");
    
    // Wait for expiration
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const getRes = engine.get(result.value.id);
    if (getRes.ok && !getRes.value) {
      console.log("✅ Expired memory automatically deleted on get");
    } else {
      console.log("⚠️  Expired memory still accessible");
    }
  }
} catch (e) {
  console.log("❌ Exception:", (e as Error).message);
}

// Test 20: Stats after many operations
console.log("\nTest 20: Stats accuracy after many operations");
try {
  const store = createSQLiteStore(TEST_DB);
  const engine = createMemoryEngine(store);
  
  // Clear first
  store.clear();
  
  // Add various memories
  engine.save({ content: "Pref 1", type: "preference" });
  engine.save({ content: "Pref 2", type: "preference" });
  engine.save({ content: "Project 1", type: "project" });
  engine.save({ content: "Note 1", type: "note", tags: ["tag1"] });
  engine.save({ content: "Note 2", type: "note", tags: ["tag1", "tag2"] });
  
  const stats = engine.stats();
  if (stats.ok) {
    console.log("✅ Stats after operations:");
    console.log("   Total:", stats.value.total, "(expected: 5)");
    console.log("   By type:", stats.value.byType);
    console.log("   By tags:", stats.value.byTags);
    
    if (stats.value.total === 5) {
      console.log("✅ Stats accurate");
    } else {
      console.log("❌ Stats inaccurate");
    }
  }
} catch (e) {
  console.log("❌ Exception:", (e as Error).message);
}

console.log("\n✅ All edge case tests completed!");
console.log("\n📝 Summary: Check for any ❌ or ⚠️ warnings above");
