#!/usr/bin/env node
/**
 * Tests for codebase.search capability
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, writeFile, unlink, readdir, rm, mkdtemp } from "fs/promises";
import * as fs from "fs"; // for mkdirSync fallback
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

  // --- filePattern tests (increase branch coverage in shouldProcess) ---

  it("should filter by filePattern extension .ts", async () => {
    // Create .ts and .js files with matches
    await writeFile(join(tempDir, "a.ts"), "const a = 1;", "utf-8");
    await writeFile(join(tempDir, "b.js"), "const b = 2;", "utf-8");
    const ctx = { cwd: tempDir };

    const result = await searchModule.execute({ query: "const", filePattern: ".ts" }, ctx as { cwd: string });
    expect(result.details.total).toBe(1);
    expect(result.details.matches[0].file).toContain("a.ts");
  });

  it("should filter by filePattern partial path (case-insensitive)", async () => {
    const srcDir = join(tempDir, "src");
    const libDir = join(tempDir, "lib");
    await mkdir(srcDir);
    await mkdir(libDir);
    await writeFile(join(srcDir, "file.ts"), "const x = 1;", "utf-8");
    await writeFile(join(libDir, "file.ts"), "const y = 2;", "utf-8");
    const ctx = { cwd: tempDir };

    const result = await searchModule.execute({ query: "const", filePattern: "src" }, ctx as { cwd: string });
    expect(result.details.total).toBe(1);
    expect(result.details.matches[0].file).toContain("src");
  });

  it("should ignore non-code extensions per CODE_EXTENSIONS", async () => {
    await writeFile(join(tempDir, "sample.txt"), "const z = 3;", "utf-8");
    const ctx = { cwd: tempDir };

    const result = await searchModule.execute({ query: "const" }, ctx as { cwd: string });
    expect(result.details.total).toBe(0);
  });

  it("should respect case-insensitive filePattern (uppercase pattern vs lowercase path)", async () => {
    const srcDir = join(tempDir, "Src");
    await mkdir(srcDir);
    await writeFile(join(srcDir, "File.ts"), "const a = 1;", "utf-8"); // capital S
    const ctx = { cwd: tempDir };

    const result = await searchModule.execute({ query: "const", filePattern: "src" }, ctx as { cwd: string });
    expect(result.details.total).toBe(1);
  });

  it("should match filePattern starting with '.' against extension", async () => {
    await writeFile(join(tempDir, "mod.ts"), "const m = 1;", "utf-8");
    await writeFile(join(tempDir, "mod.js"), "const m = 2;", "utf-8");
    const ctx = { cwd: tempDir };

    const result = await searchModule.execute({ query: "const", filePattern: ".ts" }, ctx as { cwd: string });
    expect(result.details.total).toBe(1);
    expect(result.details.matches[0].file).toContain(".ts");
  });
});
