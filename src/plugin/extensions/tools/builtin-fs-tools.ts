#!/usr/bin/env node
/**
 * Builtin Filesystem Tools (ls, grep, find)
 *
 * Registers the standard filesystem tools using the pi-coding-agent SDK.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
	createLsToolDefinition,
	createGrepToolDefinition,
	createFindToolDefinition,
	type LsToolOptions,
	type GrepToolOptions,
	type FindToolOptions,
} from "@earendil-works/pi-coding-agent";

export function registerBuildinCustomToools(api: ExtensionAPI): void {
	// Create tool definitions for the current working directory
	const cwd = process.cwd();

	// Register ls
	api.registerTool(createLsToolDefinition(cwd, {
		// Optional: customize options if needed
	} as LsToolOptions));

	// Register grep
	api.registerTool(createGrepToolDefinition(cwd, {
		// Optional: customize options if needed
	} as GrepToolOptions));

	// Register find
	api.registerTool(createFindToolDefinition(cwd, {
		// Optional: customize options if needed
	} as FindToolOptions));
}
