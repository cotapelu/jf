import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { platform } from "node:os";
import { join } from "node:path";
import { TOOLS, TOOLS_DIR } from "./tool-downloader.js";

const TERMUX_PACKAGES: Record<string, string> = {
	fd: "fd",
	rg: "ripgrep",
};

// Get the path to a tool (system-wide or in our tools dir)
export function getToolPath(tool: "fd" | "rg"): string | null {
	const config = TOOLS[tool];
	if (!config) return null;

	// Check our tools directory first
	const localPath = join(TOOLS_DIR, config.binaryName + (platform() === "win32" ? ".exe" : ""));
	if (existsSync(localPath)) {
		return localPath;
	}

	// Check system PATH - if found, just return the command name (it's in PATH)
	if (commandExists(config.binaryName)) {
		return config.binaryName;
	}

	return null;
}

// Check if a command exists in PATH by trying to run it
function commandExists(cmd: string): boolean {
	try {
		const result = spawnSync(cmd, ["--version"], { stdio: "pipe" });
		// Check for ENOENT error (command not found)
		return result.error === undefined || result.error === null;
	} catch {
		return false;
	}
}

function isOfflineModeEnabled(): boolean {
	const value = process.env.PI_OFFLINE;
	if (!value) return false;
	return value === "1" || value.toLowerCase() === "true" || value.toLowerCase() === "yes";
}

// Termux package names for tools
// Ensure a tool is available, downloading if necessary
// Returns the path to the tool, or null if unavailable
export async function ensureTool(tool: "fd" | "rg", silent: boolean = false): Promise<string | undefined> {
	const existingPath = getToolPath(tool);
	if (existingPath) {
		return existingPath;
	}

	const config = TOOLS[tool];
	if (!config) return undefined;

	if (isOfflineModeEnabled()) {
		if (!silent) {
			// eslint-disable-next-line no-console
			console.log(require("chalk").yellow(`${config.name} not found. Offline mode enabled, skipping download.`));
		}
		return undefined;
	}

	// On Android/Termux, Linux binaries don't work due to Bionic libc incompatibility.
	// Users must install via pkg.
	if (platform() === "android") {
		const pkgName = TERMUX_PACKAGES[tool] ?? tool;
		if (!silent) {
			// eslint-disable-next-line no-console
			console.log(require("chalk").yellow(`${config.name} not found. Install with: pkg install ${pkgName}`));
		}
		return undefined;
	}

	// Tool not found - download it
	if (!silent) {
		// eslint-disable-next-line no-console
		console.log(require("chalk").dim(`${config.name} not found. Downloading...`));
	}

	try {
		// Import dynamically to avoid circular dependency
		const { downloadTool } = await import("./tool-downloader.js");
		const path = await downloadTool(tool);
		if (!silent) {
			// eslint-disable-next-line no-console
			console.log(require("chalk").dim(`${config.name} installed to ${path}`));
		}
		return path;
	} catch (e) {
		if (!silent) {
			// eslint-disable-next-line no-console
			console.log(
				require("chalk").yellow(`Failed to download ${config.name}: ${e instanceof Error ? e.message : e}`),
			);
		}
		return undefined;
	}
}
