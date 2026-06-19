#!/usr/bin/env node
import { existsSync, mkdirSync, appendFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { ExtensionAPI, BeforeProviderRequestEvent } from "@earendil-works/pi-coding-agent";
import { getAgentDir } from "@earendil-works/pi-coding-agent";

const AGENT_DIR = getAgentDir();
const CONFIG_DIR_NAME = dirname(AGENT_DIR).split(/[/\\]/).pop() || ".pi";

/**
 * Context Logger Extension
 *
 * Logs LLM context (system prompt, messages, tools) before each provider request.
 * Configure via flag: --contextLogFile <path>
 *
 * Output format: JSON lines (one JSON object per request)
 */

const DEFAULT_LOG_PATH = join(CONFIG_DIR_NAME, "context", "context.log");

export default function (pi: ExtensionAPI): any {
	// Register CLI flags for this extension
	pi.registerFlag("contextLogFile", {
		description: "Path to file where LLM context will be logged (default: .piclaw/context/context.log)",
		type: "string",
		default: undefined,
	});

	pi.registerFlag("contextLogAppend", {
		description: "Append to context log (default: true)",
		type: "boolean",
		default: true,
	});

	// Hook into before_provider_request to capture context
	pi.on("before_provider_request", async (event: BeforeProviderRequestEvent) => {
		const logFile = pi.getFlag("contextLogFile") as string | undefined;
		const shouldAppend = (pi.getFlag("contextLogAppend") as boolean) ?? true;

		// If no log file specified, use default in cwd
		const effectiveLogFile = logFile ?? DEFAULT_LOG_PATH;

		// If explicitly set to empty string or "false", disable logging
		if (!effectiveLogFile || effectiveLogFile === "false" || effectiveLogFile === "") {
			return;
		}

		try {
			const logDir = dirname(effectiveLogFile);
			if (!existsSync(logDir)) {
				mkdirSync(logDir, { recursive: true });
			}

			// Cast payload to expected shape (model, context, options)
			const payload = event.payload as { model: unknown; context: unknown; options: unknown };
			const logEntry = JSON.stringify({
				timestamp: new Date().toISOString(),
				model: payload.model,
				context: payload.context,
				options: payload.options,
			}) + "\n";

			appendFileSync(effectiveLogFile, logEntry);
		} catch (err) {
			// Log error but don't break the request flow
			console.error("[ContextLogger] Failed to write log:", err);
		}
	});
	// Return empty object to satisfy extension discovery
	return {};
}
