import { createSQLiteStore, createMemoryEngine } from "./src/index.js";
import { rmSync } from "node:fs";

const TEST_DB = "/tmp/test-code-symbol.db";
try { rmSync(TEST_DB); } catch {}

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
  console.log("Saved memory:");
  console.log("  ID:", result.value.id);
  console.log("  symbol_type:", result.value.symbol_type);
  console.log("  file_path:", result.value.file_path);
  console.log("  line_start:", result.value.line_start);
  console.log("  line_end:", result.value.line_end);
  console.log("  language:", result.value.language);
  console.log("  signature:", result.value.signature);
  console.log("  metadata:", result.value.metadata);
  
  // Get it back
  const getRes = engine.get(result.value.id);
  if (getRes.ok && getRes.value) {
    console.log("\nRetrieved memory:");
    console.log("  symbol_type:", getRes.value.symbol_type);
    console.log("  file_path:", getRes.value.file_path);
    console.log("  line_start:", getRes.value.line_start);
    console.log("  line_end:", getRes.value.line_end);
    console.log("  language:", getRes.value.language);
    console.log("  signature:", getRes.value.signature);
  }
}
