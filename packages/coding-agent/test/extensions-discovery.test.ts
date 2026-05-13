import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { discoverAndLoadExtensions } from "../src/core/extensions/loader.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("extensions discovery", () => {
	let tempDir: string;
	let extensionsDir: string;

	beforeEach(() => {
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-ext-test-"));
		extensionsDir = path.join(tempDir, "extensions");
		fs.mkdirSync(extensionsDir);
	});

	afterEach(() => {
		fs.rmSync(tempDir, { recursive: true, force: true });
	});

	const extensionCode = `
		export default function(pi) {
			pi.registerCommand("test", { handler: async () => {} });
		}
	`;

	const extensionCodeWithTool = (toolName: string) => `
		import { Type } from "@sinclair/typebox";
		export default function(pi) {
			pi.registerTool({
				name: "${toolName}",
				label: "${toolName}",
				description: "Test tool",
				parameters: Type.Object({}),
				execute: async () => ({ content: [{ type: "text", text: "ok" }] }),
			});
		}
	`;

	it("discovers direct .ts files in extensions/", async () => {
		fs.writeFileSync(path.join(extensionsDir, "foo.js"), extensionCode);
		fs.writeFileSync(path.join(extensionsDir, "bar.js"), extensionCode);

		const result = await discoverAndLoadExtensions([], tempDir, tempDir);

		expect(result.errors).toHaveLength(0);
		expect(result.extensions).toHaveLength(2);
		expect(result.extensions.map((e) => path.basename(e.path)).sort()).toEqual(["bar.js", "foo.js"]);
	});

	it("discovers direct .js files in extensions/", async () => {
		fs.writeFileSync(path.join(extensionsDir, "foo.js"), extensionCode);

		const result = await discoverAndLoadExtensions([], tempDir, tempDir);

		expect(result.errors).toHaveLength(0);
		expect(result.extensions).toHaveLength(1);
		expect(path.basename(result.extensions[0].path)).toBe("foo.js");
	});

	it("discovers subdirectory with index.js", async () => {
		const subdir = path.join(extensionsDir, "my-extension");
		fs.mkdirSync(subdir);
		fs.writeFileSync(path.join(subdir, "index.js"), extensionCode);

		const result = await discoverAndLoadExtensions([], tempDir, tempDir);

		expect(result.errors).toHaveLength(0);
		expect(result.extensions).toHaveLength(1);
		expect(result.extensions[0].path).toContain("my-extension");
		expect(result.extensions[0].path).toContain("index.js");
	});

	it("discovers subdirectory with index.js", async () => {
		const subdir = path.join(extensionsDir, "my-extension");
		fs.mkdirSync(subdir);
		fs.writeFileSync(path.join(subdir, "index.js"), extensionCode);

		const result = await discoverAndLoadExtensions([], tempDir, tempDir);

		expect(result.errors).toHaveLength(0);
		expect(result.extensions).toHaveLength(1);
		expect(result.extensions[0].path).toContain("index.js");
	});

	it("prefers index.ts over index.js", async () => {
		const subdir = path.join(extensionsDir, "my-extension");
		fs.mkdirSync(subdir);
		fs.writeFileSync(path.join(subdir, "index.js"), extensionCode);
		fs.writeFileSync(path.join(subdir, "index.js"), extensionCode);

		const result = await discoverAndLoadExtensions([], tempDir, tempDir);

		expect(result.errors).toHaveLength(0);
		expect(result.extensions).toHaveLength(1);
		expect(result.extensions[0].path).toContain("index.js");
	});

	it("discovers subdirectory with package.json pi field", async () => {
		const subdir = path.join(extensionsDir, "my-package");
		const srcDir = path.join(subdir, "src");
		fs.mkdirSync(subdir);
		fs.mkdirSync(srcDir);
		fs.writeFileSync(path.join(srcDir, "main.js"), extensionCode);
		fs.writeFileSync(
			path.join(subdir, "package.json"),
			JSON.stringify({
				name: "my-package",
				pi: {
					extensions: ["./src/main.js"],
				},
			}),
		);

		const result = await discoverAndLoadExtensions([], tempDir, tempDir);

		expect(result.errors).toHaveLength(0);
		expect(result.extensions).toHaveLength(1);
		expect(result.extensions[0].path).toContain("src");
		expect(result.extensions[0].path).toContain("main.js");
	});

	it("package.json can declare multiple extensions", async () => {
		const subdir = path.join(extensionsDir, "my-package");
		fs.mkdirSync(subdir);
		fs.writeFileSync(path.join(subdir, "ext1.js"), extensionCode);
		fs.writeFileSync(path.join(subdir, "ext2.js"), extensionCode);
		fs.writeFileSync(
			path.join(subdir, "package.json"),
			JSON.stringify({
				name: "my-package",
				pi: {
					extensions: ["./ext1.js", "./ext2.js"],
				},
			}),
		);

		const result = await discoverAndLoadExtensions([], tempDir, tempDir);

		expect(result.errors).toHaveLength(0);
		expect(result.extensions).toHaveLength(2);
	});

	it("package.json with pi field takes precedence over index.js", async () => {
		const subdir = path.join(extensionsDir, "my-package");
		fs.mkdirSync(subdir);
		fs.writeFileSync(path.join(subdir, "index.js"), extensionCodeWithTool("from-index"));
		fs.writeFileSync(path.join(subdir, "custom.js"), extensionCodeWithTool("from-custom"));
		fs.writeFileSync(
			path.join(subdir, "package.json"),
			JSON.stringify({
				name: "my-package",
				pi: {
					extensions: ["./custom.js"],
				},
			}),
		);

		const result = await discoverAndLoadExtensions([], tempDir, tempDir);

		expect(result.errors).toHaveLength(0);
		expect(result.extensions).toHaveLength(1);
		expect(result.extensions[0].path).toContain("custom.js");
		// Verify the right tool was registered
		expect(result.extensions[0].tools.has("from-custom")).toBe(true);
		expect(result.extensions[0].tools.has("from-index")).toBe(false);
	});

	it("ignores package.json without pi field, falls back to index.js", async () => {
		const subdir = path.join(extensionsDir, "my-package");
		fs.mkdirSync(subdir);
		fs.writeFileSync(path.join(subdir, "index.js"), extensionCode);
		fs.writeFileSync(
			path.join(subdir, "package.json"),
			JSON.stringify({
				name: "my-package",
				version: "1.0.0",
			}),
		);

		const result = await discoverAndLoadExtensions([], tempDir, tempDir);

		expect(result.errors).toHaveLength(0);
		expect(result.extensions).toHaveLength(1);
		expect(result.extensions[0].path).toContain("index.js");
	});

	it("ignores subdirectory without index or package.json", async () => {
		const subdir = path.join(extensionsDir, "not-an-extension");
		fs.mkdirSync(subdir);
		fs.writeFileSync(path.join(subdir, "helper.js"), extensionCode);
		fs.writeFileSync(path.join(subdir, "utils.js"), extensionCode);

		const result = await discoverAndLoadExtensions([], tempDir, tempDir);

		expect(result.errors).toHaveLength(0);
		expect(result.extensions).toHaveLength(0);
	});

	it("does not recurse beyond one level", async () => {
		const subdir = path.join(extensionsDir, "container");
		const nested = path.join(subdir, "nested");
		fs.mkdirSync(subdir);
		fs.mkdirSync(nested);
		fs.writeFileSync(path.join(nested, "index.js"), extensionCode);
		// No index.ts or package.json in container/

		const result = await discoverAndLoadExtensions([], tempDir, tempDir);

		expect(result.errors).toHaveLength(0);
		expect(result.extensions).toHaveLength(0);
	});

	it("handles mixed direct files and subdirectories", async () => {
		// Direct file
		fs.writeFileSync(path.join(extensionsDir, "direct.js"), extensionCode);

		// Subdirectory with index
		const subdir1 = path.join(extensionsDir, "with-index");
		fs.mkdirSync(subdir1);
		fs.writeFileSync(path.join(subdir1, "index.js"), extensionCode);

		// Subdirectory with package.json
		const subdir2 = path.join(extensionsDir, "with-manifest");
		fs.mkdirSync(subdir2);
		fs.writeFileSync(path.join(subdir2, "entry.js"), extensionCode);
		fs.writeFileSync(path.join(subdir2, "package.json"), JSON.stringify({ pi: { extensions: ["./entry.js"] } }));

		const result = await discoverAndLoadExtensions([], tempDir, tempDir);

		expect(result.errors).toHaveLength(0);
		expect(result.extensions).toHaveLength(3);
	});

	it("skips non-existent paths declared in package.json", async () => {
		const subdir = path.join(extensionsDir, "my-package");
		fs.mkdirSync(subdir);
		fs.writeFileSync(path.join(subdir, "exists.js"), extensionCode);
		fs.writeFileSync(
			path.join(subdir, "package.json"),
			JSON.stringify({
				pi: {
					extensions: ["./exists.js", "./missing.js"],
				},
			}),
		);

		const result = await discoverAndLoadExtensions([], tempDir, tempDir);

		expect(result.errors).toHaveLength(0);
		expect(result.extensions).toHaveLength(1);
		expect(result.extensions[0].path).toContain("exists.js");
	});

	it("loads extensions and registers commands", async () => {
		fs.writeFileSync(path.join(extensionsDir, "with-command.js"), extensionCode);

		const result = await discoverAndLoadExtensions([], tempDir, tempDir);

		expect(result.errors).toHaveLength(0);
		expect(result.extensions).toHaveLength(1);
		expect(result.extensions[0].commands.has("test")).toBe(true);
	});

	it("loads extensions and registers tools", async () => {
		fs.writeFileSync(path.join(extensionsDir, "with-tool.js"), extensionCodeWithTool("my-tool"));

		const result = await discoverAndLoadExtensions([], tempDir, tempDir);

		expect(result.errors).toHaveLength(0);
		expect(result.extensions).toHaveLength(1);
		expect(result.extensions[0].tools.has("my-tool")).toBe(true);
	});

	it("reports errors for invalid extension code", async () => {
		fs.writeFileSync(path.join(extensionsDir, "invalid.js"), "this is not valid typescript export");

		const result = await discoverAndLoadExtensions([], tempDir, tempDir);

		expect(result.errors).toHaveLength(1);
		expect(result.errors[0].path).toContain("invalid.js");
		expect(result.extensions).toHaveLength(0);
	});

	it("handles explicitly configured paths", async () => {
		const customPath = path.join(tempDir, "custom-location", "my-ext.js");
		fs.mkdirSync(path.dirname(customPath), { recursive: true });
		fs.writeFileSync(customPath, extensionCode);

		const result = await discoverAndLoadExtensions([customPath], tempDir, tempDir);

		expect(result.errors).toHaveLength(0);
		expect(result.extensions).toHaveLength(1);
		expect(result.extensions[0].path).toContain("my-ext.js");
	});

	it("resolves dependencies from extension's own node_modules", async () => {
		// Load extension that has its own package.json and node_modules with 'ms' package
		const extPath = path.resolve(__dirname, "../examples/extensions/with-deps");

		const result = await discoverAndLoadExtensions([extPath], tempDir, tempDir);

		expect(result.errors).toHaveLength(0);
		expect(result.extensions).toHaveLength(1);
		expect(result.extensions[0].path).toContain("with-deps");
		// The extension registers a 'parse_duration' tool
		expect(result.extensions[0].tools.has("parse_duration")).toBe(true);
	});

	it("registers message renderers", async () => {
		const extCode = `
			export default function(pi) {
				pi.registerMessageRenderer("my-custom-type", (message, options, theme) => {
					return null; // Use default rendering
				});
			}
		`;
		fs.writeFileSync(path.join(extensionsDir, "with-renderer.js"), extCode);

		const result = await discoverAndLoadExtensions([], tempDir, tempDir);

		expect(result.errors).toHaveLength(0);
		expect(result.extensions).toHaveLength(1);
		expect(result.extensions[0].messageRenderers.has("my-custom-type")).toBe(true);
	});

	it("reports error when extension throws during initialization", async () => {
		const extCode = `
			export default function(pi) {
				throw new Error("Initialization failed!");
			}
		`;
		fs.writeFileSync(path.join(extensionsDir, "throws.js"), extCode);

		const result = await discoverAndLoadExtensions([], tempDir, tempDir);

		expect(result.errors).toHaveLength(1);
		expect(result.errors[0].error).toContain("Initialization failed!");
		expect(result.extensions).toHaveLength(0);
	});

	it("reports error when extension has no default export", async () => {
		const extCode = `
			export function notDefault(pi) {
				pi.registerCommand("test", { handler: async () => {} });
			}
		`;
		fs.writeFileSync(path.join(extensionsDir, "no-default.js"), extCode);

		const result = await discoverAndLoadExtensions([], tempDir, tempDir);

		expect(result.errors).toHaveLength(1);
		expect(result.errors[0].error).toContain("does not export a valid factory function");
		expect(result.extensions).toHaveLength(0);
	});

	it("allows multiple extensions to register different tools", async () => {
		fs.writeFileSync(path.join(extensionsDir, "tool-a.js"), extensionCodeWithTool("tool-a"));
		fs.writeFileSync(path.join(extensionsDir, "tool-b.js"), extensionCodeWithTool("tool-b"));

		const result = await discoverAndLoadExtensions([], tempDir, tempDir);

		expect(result.errors).toHaveLength(0);
		expect(result.extensions).toHaveLength(2);

		const allTools = new Set<string>();
		for (const ext of result.extensions) {
			for (const name of ext.tools.keys()) {
				allTools.add(name);
			}
		}
		expect(allTools.has("tool-a")).toBe(true);
		expect(allTools.has("tool-b")).toBe(true);
	});

	it("loads extension with event handlers", async () => {
		const extCode = `
			export default function(pi) {
				pi.on("agent_start", async () => {});
				pi.on("tool_call", async (event) => undefined);
				pi.on("agent_end", async () => {});
			}
		`;
		fs.writeFileSync(path.join(extensionsDir, "with-handlers.js"), extCode);

		const result = await discoverAndLoadExtensions([], tempDir, tempDir);

		expect(result.errors).toHaveLength(0);
		expect(result.extensions).toHaveLength(1);
		expect(result.extensions[0].handlers.has("agent_start")).toBe(true);
		expect(result.extensions[0].handlers.has("tool_call")).toBe(true);
		expect(result.extensions[0].handlers.has("agent_end")).toBe(true);
	});

	it("loads extension with shortcuts", async () => {
		const extCode = `
			export default function(pi) {
				pi.registerShortcut("ctrl+t", {
					description: "Test shortcut",
					handler: async (ctx) => {},
				});
			}
		`;
		fs.writeFileSync(path.join(extensionsDir, "with-shortcut.js"), extCode);

		const result = await discoverAndLoadExtensions([], tempDir, tempDir);

		expect(result.errors).toHaveLength(0);
		expect(result.extensions).toHaveLength(1);
		expect(result.extensions[0].shortcuts.has("ctrl+t")).toBe(true);
	});

	it("loads extension with flags", async () => {
		const extCode = `
			export default function(pi) {
				pi.registerFlag("my-flag", {
					description: "My custom flag",
					handler: async (value) => {},
				});
			}
		`;
		fs.writeFileSync(path.join(extensionsDir, "with-flag.js"), extCode);

		const result = await discoverAndLoadExtensions([], tempDir, tempDir);

		expect(result.errors).toHaveLength(0);
		expect(result.extensions).toHaveLength(1);
		expect(result.extensions[0].flags.has("my-flag")).toBe(true);
	});

	it("loadExtensions only loads explicit paths without discovery", async () => {
		// Create discoverable extensions (would be found by discoverAndLoadExtensions)
		fs.writeFileSync(path.join(extensionsDir, "discovered.js"), extensionCodeWithTool("discovered"));

		// Create explicit extension outside discovery path
		const explicitPath = path.join(tempDir, "explicit.js");
		fs.writeFileSync(explicitPath, extensionCodeWithTool("explicit"));

		// Use loadExtensions directly to skip discovery
		const { loadExtensions } = await import("../src/core/extensions/loader.js");
		const result = await loadExtensions([explicitPath], tempDir);

		expect(result.errors).toHaveLength(0);
		expect(result.extensions).toHaveLength(1);
		expect(result.extensions[0].tools.has("explicit")).toBe(true);
		expect(result.extensions[0].tools.has("discovered")).toBe(false);
	});

	it("loadExtensions with no paths loads nothing", async () => {
		// Create discoverable extensions (would be found by discoverAndLoadExtensions)
		fs.writeFileSync(path.join(extensionsDir, "discovered.js"), extensionCode);

		// Use loadExtensions directly with empty paths
		const { loadExtensions } = await import("../src/core/extensions/loader.js");
		const result = await loadExtensions([], tempDir);

		expect(result.errors).toHaveLength(0);
		expect(result.extensions).toHaveLength(0);
	});
});
