import { describe, it, expect } from "vitest";
import { parseArgs, requireArgs, getArg } from "../extensions/utils/command-args";

describe("parseArgs", () => {
  it("splits input into action and args", () => {
    const result = parseArgs("add file.txt");
    expect(result.action).toBe("add");
    expect(result.args).toEqual(["file.txt"]);
  });

  it("handles multiple args", () => {
    const result = parseArgs("create name value");
    expect(result.action).toBe("create");
    expect(result.args).toEqual(["name", "value"]);
  });

  it("returns empty action and args for empty string", () => {
    const result = parseArgs("");
    expect(result.action).toBe("");
    expect(result.args).toEqual([]);
  });

  it("trims whitespace", () => {
    const result = parseArgs("  action   arg1   arg2  ");
    expect(result.action).toBe("action");
    expect(result.args).toEqual(["arg1", "arg2"]);
  });

  it("handles single word with no args", () => {
    const result = parseArgs("status");
    expect(result.action).toBe("status");
    expect(result.args).toEqual([]);
  });
});

describe("requireArgs", () => {
  it("throws if fewer args than required", () => {
    const parsed = { action: "add", args: [] };
    expect(() => requireArgs(parsed, 1)).toThrow("need at least 1 argument(s)");
  });

  it("throws with custom usage", () => {
    const parsed = { action: "test", args: [] };
    expect(() => requireArgs(parsed, 1, "Usage: test <name>")).toThrow("Usage: test <name>");
  });

  it("does not throw if enough args", () => {
    const parsed = { action: "add", args: ["file"] };
    expect(() => requireArgs(parsed, 1)).not.toThrow();
  });
});

describe("getArg", () => {
  it("returns argument at index", () => {
    const parsed = { action: "add", args: ["file.txt"] };
    expect(getArg(parsed, 0)).toBe("file.txt");
  });

  it("returns undefined if index out of range and no default", () => {
    const parsed = { action: "add", args: ["file.txt"] };
    expect(getArg(parsed, 1)).toBeUndefined();
  });

  it("returns default if index out of range", () => {
    const parsed = { action: "add", args: ["file.txt"] };
    expect(getArg(parsed, 1, "default")).toBe("default");
  });
});
