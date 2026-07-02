#!/usr/bin/env node
/**
 * Tests for codebase.search capability
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, writeFile, unlink, readdir, rm, mkdtemp } from "fs/promises";
import * as path from "path";
import { fileURLToPath } from "url";
import { relative, join } from "path";
import os from "os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function writeTempFile(content: string, ext = "ts"): Promise<string> {
  const timestamp = Date.now();
  const dir = path.join(__dirname, "temp");
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `test-${timestamp}.${ext}`);
  await writeFile(file, content, "utf-8");
  return file;
}

const searchModule = await import("../capabilities/search.ts");

// Type for details
interface SearchDetails {
  total: number;
  matches: Array<{ file: string; line: number; column: number; text: string }>;
}

describe("codebase.search", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "codebase-search-"));
  });

  afterEach(async () => {
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it("should find matches in a file", async () => {
    const file = join(tempDir, "sample.ts");
    await writeFile(file, "const x = 1;\nconst y = 2;\nconst z = x + y;", "utf-8");
    const ctx = { cwd: tempDir };

    const result = await searchModule.execute({ query: "const" }, ctx as { cwd: string });
    expect(result.isError).toBe(false);
    expect(result.details.total).toBe(3);
    expect(result.details.matches.length).toBe(3);
    // Each match should have file, line, column, text
    result.details.matches.forEach((m: any) => {
      expect(m.file).toContain("sample.ts");
      expect(typeof m.line).toBe("number");
      expect(typeof m.column).toBe("number");
      expect(typeof m.text).toBe("string");
    });
  });

  it("should be case-insensitive by default", async () => {
    const file = join(tempDir, "sample.ts");
    await writeFile(file, "CONST X = 1;\nconst y = 2;", "utf-8");
    const ctx = { cwd: tempDir };

    const result = await searchModule.execute({ query: "const" }, ctx as { cwd: string });
    expect(result.details.total).toBe(2);
  });

  it("should respect caseSensitive flag", async () => {
    const file = join(tempDir, "sample.ts");
    await writeFile(file, "CONST X = 1;\nconst y = 2;", "utf-8");
    const ctx = { cwd: tempDir };

    const result = await searchModule.execute({ query: "const", caseSensitive: true }, ctx as { cwd: string });
    expect(result.details.total).toBe(1); // only lowercase const
  });

  it("should respect maxResults", async () => {
    const file = join(tempDir, "sample.ts");
    await writeFile(file, "line1\nline2\nline3\nline4\nline5", "utf-8");
    const ctx = { cwd: tempDir };

    const result = await searchModule.execute({ query: "line", maxResults: 2 }, ctx as { cwd: string });
    expect(result.details.total).toBe(2);
  });

  it("should return no matches when none found", async () => {
    const file = join(tempDir, "sample.ts");
    await writeFile(file, "const x = 1;", "utf-8");
    const ctx = { cwd: tempDir };

    const result = await searchModule.execute({ query: "nonexistent" }, ctx as { cwd: string });
    expect(result.details.total).toBe(0);
    expect(result.content[0].text).toContain("No matches");
  });

  // New tests to increase coverage
  it("should traverse subdirectories", async () => {
    // Create nested structure: subdir with a ts file
    const subdir = join(tempDir, "sub");
    await mkdir(subdir, { recursive: true });
    const file1 = join(tempDir, "root.ts");
    const file2 = join(subdir, "nested.ts");
    await writeFile(file1, "const a = 1;", "utf-8");
    await writeFile(file2, "const b = 2;", "utf-8");
    const ctx = { cwd: tempDir };

    const result = await searchModule.execute({ query: "const" }, ctx as { cwd: string });
    expect(result.isError).toBe(false);
    expect(result.details.total).toBe(2);
    const files = result.details.matches.map((m: any) => m.file);
    expect(files).toContain("root.ts");
    expect(files).toContain(join("sub", "nested.ts"));
  });

  it("should skip non-code files (e.g., .txt)", async () => {
    const tsFile = join(tempDir, "app.ts");
    const txtFile = join(tempDir, "readme.txt");
    await writeFile(tsFile, "const x = 1;", "utf-8");
    await writeFile(txtFile, "const y = 2;", "utf-8"); // 'const' in txt but should be skipped
    const ctx = { cwd: tempDir };

    const result = await searchModule.execute({ query: "const" }, ctx as { cwd: string });
    expect(result.details.total).toBe(1);
    expect(result.details.matches[0].file).toBe("app.ts");
  });

  it("should filter by filePattern extension", async () => {
    // Create .ts and .js files
    const tsFile = join(tempDir, "app.ts");
    const jsFile = join(tempDir, "lib.js");
    await writeFile(tsFile, "const x = 1;", "utf-8");
    await writeFile(jsFile, "var y = 2;", "utf-8");
    const ctx = { cwd: tempDir };

    const result = await searchModule.execute({ query: "const", filePattern: ".ts" }, ctx as { cwd: string });
    expect(result.details.total).toBe(1);
    expect(result.details.matches[0].file).toBe("app.ts");
  });

  it("should filter by filePattern partial path", async () => {
    const file1 = join(tempDir, "src_app.ts");
    const file2 = join(tempDir, "test_app.ts");
    const file3 = join(tempDir, "other.ts");
    await writeFile(file1, "const a = 1;", "utf-8");
    await writeFile(file2, "const b = 2;", "utf-8");
    await writeFile(file3, "const c = 3;", "utf-8");
    const ctx = { cwd: tempDir };

    const result = await searchModule.execute({ query: "const", filePattern: "src" }, ctx as { cwd: string });
    expect(result.details.total).toBe(1);
    expect(result.details.matches[0].file).toBe("src_app.ts");
  });

  it("should respect early exit when maxResults reached during scanning", async () => {
    const file = join(tempDir, "many.ts");
    // Generate 200 lines each with the word 'target'
    const lines = Array(200).fill("target");
    await writeFile(file, lines.join("\n"), "utf-8");
    const ctx = { cwd: tempDir };

    const result = await searchModule.execute({ query: "target", maxResults: 50 }, ctx as { cwd: string });
    expect(result.details.total).toBe(50);
  });

  it("should handle empty query with error", async () => {
    const file = join(tempDir, "sample.ts");
    await writeFile(file, "const x = 1;", "utf-8");
    const ctx = { cwd: tempDir };

    const result = await searchModule.execute({ query: "" }, ctx as { cwd: string });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Query is required");
  });
});
