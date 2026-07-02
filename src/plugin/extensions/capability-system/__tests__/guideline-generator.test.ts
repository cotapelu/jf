#!/usr/bin/env node
/**
 * Tests for guideline-generator.ts - increasing coverage using public API
 */

import { describe, it, expect } from "vitest";
import generateCapabilityGuidelines, { extractMinimalParams, getExampleValue } from "../guideline-generator";

describe("guideline-generator", () => {
  describe('generateCapabilityGuidelines', () => {
    it('includes parameters and examples sections', () => {
      const schema = {
        type: "object",
        properties: {
          file: { type: "string", description: "File path" }
        },
        required: ["file"]
      };
      const guidelines = generateCapabilityGuidelines("test.id", schema);
      expect(guidelines.some(l => l.includes("Parameters:"))).toBe(true);
      expect(guidelines.some(l => l.includes("Examples:"))).toBe(true);
    });

    it('handles non-object input schema gracefully', () => {
      const guidelines = generateCapabilityGuidelines("test.id", { type: "string" });
      expect(guidelines.some(l => l.includes("(No structured parameters)"))).toBe(true);
    });

    it('includes returns section when outputSchema provided', () => {
      const input = { type: "object", properties: {} };
      const output = {
        type: "object",
        properties: {
          success: { type: "boolean", description: "Success flag" }
        }
      };
      const guidelines = generateCapabilityGuidelines("test.id", input, output);
      expect(guidelines.some(l => l.includes("Returns:"))).toBe(true);
      expect(guidelines.some(l => l.includes("`success`"))).toBe(true);
    });

    it('merges custom guidelines at the top', () => {
      const schema = { type: "object", properties: { a: { type: "number" } }, required: ["a"] };
      const custom = ["Custom intro", "Important note"];
      const guidelines = generateCapabilityGuidelines("test.id", schema, undefined, custom);
      expect(guidelines[0]).toBe("Custom intro");
      expect(guidelines[1]).toBe("Important note");
    });

    it('formats union types correctly in parameter descriptions', () => {
      const schema = {
        type: "object",
        properties: {
          mode: { type: ["string", "null"], description: "Mode" }
        },
        required: []
      };
      const guidelines = generateCapabilityGuidelines("test.id", schema);
      expect(guidelines.some(l => l.includes("string | null"))).toBe(true);
    });
  });

  describe('extractMinimalParams', () => {
    it('extracts required fields with example values', () => {
      const schema = {
        type: "object",
        properties: {
          path: { type: "string" },
          count: { type: "number" }
        },
        required: ["path"]
      };
      const result = extractMinimalParams(schema);
      expect(result).toEqual({ path: "example" });
    });

    it('returns empty object for schema without properties', () => {
      expect(extractMinimalParams({ type: "object" })).toEqual({});
    });
  });

  describe('getExampleValue', () => {
    it('uses prop.example and prop.default', () => {
      expect(getExampleValue({ type: "string", example: "hi" })).toBe("hi");
      expect(getExampleValue({ type: "number", default: 42 })).toBe(42);
    });

    it('provides context-aware string examples', () => {
      expect(getExampleValue({ type: 'string', description: 'File path' })).toBe('src/example.test.ts');
      expect(getExampleValue({ type: 'string', description: 'Path to file' })).toBe('src/example.test.ts');
      expect(getExampleValue({ type: 'string', description: 'branch' })).toBe('main');
      expect(getExampleValue({ type: 'string', description: 'Website URL' })).toBe('https://example.com');
      expect(getExampleValue({ type: 'string', description: 'Email address' })).toBe('user@example.com');
      expect(getExampleValue({ type: 'string', description: 'Working directory' })).toBe('./src');
      expect(getExampleValue({ type: 'string', description: 'Commit hash' })).toBe('HEAD');
      expect(getExampleValue({ type: 'string', description: 'name' })).toBe('example');
      expect(getExampleValue({ type: 'string' })).toBe('example');
    });

    it('provides boolean examples based on description', () => {
      expect(getExampleValue({ type: 'boolean', description: 'enable verbose' })).toBe(true);
      expect(getExampleValue({ type: 'boolean', description: 'watch mode' })).toBe(true);
      expect(getExampleValue({ type: 'boolean', description: 'dry run' })).toBe(false);
      expect(getExampleValue({ type: 'boolean', description: 'quiet' })).toBe(false);
      expect(getExampleValue({ type: 'boolean' })).toBe(false);
    });

    it('provides array examples', () => {
      expect(getExampleValue({ type: "array", items: { type: "string", enum: ["a", "b"] } })).toEqual(["a"]);
      expect(getExampleValue({ type: "array", items: { type: "number" } })).toEqual([0]);
      expect(getExampleValue({ type: "array" })).toEqual([]);
    });

    it('provides object examples with populated properties', () => {
      const prop = { type: "object", properties: { x: { type: "number" }, y: { type: "string", default: "hi" } } };
      expect(getExampleValue(prop)).toEqual({ x: 0, y: "hi" });
    });
  });
});
