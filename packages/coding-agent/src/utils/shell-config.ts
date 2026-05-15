import { existsSync } from "node:fs";
import { delimiter } from "node:path";
import { getBinDir, getSettingsPath } from "../config.js";
import { SettingsManager } from "../core/settings-manager.js";
import { findBashOnPath } from "./bash-finder.js";

let cachedShellConfig: { shell: string; args: string[] } | null = null;

/**
 * Get shell configuration based on platform.
 * Resolution order:
 * 1. User-specified shellPath in settings.json
 * 2. On Windows: Git Bash in known locations, then bash on PATH
 * 3. On Unix: /bin/bash, then bash on PATH, then fallback to sh
 */
export function getShellConfig(): { shell: string; args: string[] } {
	if (cachedShellConfig) {
		return cachedShellConfig;
	}

	const settings = SettingsManager.create();
	const customShellPath = settings.getShellPath();

	// 1. Check user-specified shell path
	if (customShellPath) {
		if (existsSync(customShellPath)) {
			cachedShellConfig = { shell: customShellPath, args: ["-c"] };
			return cachedShellConfig;
		}
		throw new Error(
			`Custom shell path not found: ${customShellPath}\nPlease update shellPath in ${getSettingsPath()}`,
		);
	}

	if (process.platform === "win32") {
		// 2. Try Git Bash in known locations
		const paths: string[] = [];
		const programFiles = process.env.ProgramFiles;
		if (programFiles) {
			paths.push(`${programFiles}\\Git\\bin\\bash.exe`);
		}
		const programFilesX86 = process.env["ProgramFiles(x86)"];
		if (programFilesX86) {
			paths.push(`${programFilesX86}\\Git\\bin\\bash.exe`);
		}

		for (const path of paths) {
			if (existsSync(path)) {
				cachedShellConfig = { shell: path, args: ["-c"] };
				return cachedShellConfig;
			}
		}

		// 3. Fallback: search bash.exe on PATH (Cygwin, MSYS2, WSL, etc.)
		const bashOnPath = findBashOnPath();
		if (bashOnPath) {
			cachedShellConfig = { shell: bashOnPath, args: ["-c"] };
			return cachedShellConfig;
		}

		throw new Error(
			`No bash shell found. Options:\n` +
				`  1. Install Git for Windows: https://git-scm.com/download/win\n` +
				`  2. Add your bash to PATH (Cygwin, MSYS2, etc.)\n` +
				`  3. Set shellPath in ${getSettingsPath()}\n\n` +
				`Searched Git Bash in:\n${paths.map((p) => `  ${p}`).join("\n")}`,
		);
	}

	// Unix: try /bin/bash, then bash on PATH, then fallback to sh
	if (existsSync("/bin/bash")) {
		cachedShellConfig = { shell: "/bin/bash", args: ["-c"] };
		return cachedShellConfig;
	}

	const bashOnPath = findBashOnPath();
	if (bashOnPath) {
		cachedShellConfig = { shell: bashOnPath, args: ["-c"] };
		return cachedShellConfig;
	}

	cachedShellConfig = { shell: "sh", args: ["-c"] };
	return cachedShellConfig;
}

export function getShellEnv(): NodeJS.ProcessEnv {
	const binDir = getBinDir();
	const pathKey = Object.keys(process.env).find((key) => key.toLowerCase() === "path") ?? "PATH";
	const currentPath = process.env[pathKey] ?? "";
	const pathEntries = currentPath.split(delimiter).filter(Boolean);
	const hasBinDir = pathEntries.includes(binDir);
	const updatedPath = hasBinDir ? currentPath : [binDir, currentPath].filter(Boolean).join(delimiter);

	return {
		...process.env,
		[pathKey]: updatedPath,
	};
}
