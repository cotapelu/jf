#!/usr/bin/env node
import { createLogger } from "../utils/logger.js";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import * as path from "node:path";
import { existsSync, readFileSync } from "node:fs";

const DEFAULT_IDLE_TIMEOUT_MS = 30_000;
const DEFAULT_IDLE_MESSAGE = "Continue next task in docs/TODO.md, remember update done and git commit.";
const REMINDER_FILE = "AUTO-CONTINUE.md";

// Create logger for this hook
const logger = createLogger('AutoContinue');

function findProjectRoot(startPath: string): string {
	let current = startPath;
	const root = path.parse(current).root;
	while (current && current !== root) {
		if (
			existsSync(path.join(current, "package.json")) ||
			existsSync(path.join(current, ".git")) ||
			existsSync(path.join(current, "pi.config.json"))
		) {
			return current;
		}
		const parent = path.dirname(current);
		if (parent === current) break;
		current = parent;
	}
	return startPath;
}

function loadReminderMessage(): string {
	try {
		const projectRoot = findProjectRoot(process.cwd());
		const filePath = path.join(projectRoot, REMINDER_FILE);
		if (existsSync(filePath)) {
			const content = readFileSync(filePath, "utf-8");
			const trimmed = content.trim();
			if (trimmed) {
				logger.log(`[AutoContinue] Loaded reminder from ${filePath}`);
				return trimmed;
			}
		}
	} catch (error) {
		logger.error("[AutoContinue] Failed to load reminder file", { error });
	}
	logger.log("[AutoContinue] Using default message");
	return DEFAULT_IDLE_MESSAGE;
}

const IDLE_MESSAGE = loadReminderMessage();

export default function (pi: ExtensionAPI) {
	let enabled = false;
	let idleTimeoutMs = DEFAULT_IDLE_TIMEOUT_MS;
	let idleTimer: ReturnType<typeof setTimeout> | null = null;

	pi.on("session_shutdown", () => {
		if (idleTimer) {
			clearTimeout(idleTimer);
			idleTimer = null;
		}
	});

	const startIdleTimer = () => {
		if (!enabled) return;
		if (idleTimer) return;
		idleTimer = setTimeout(() => {
			if (enabled) {
				pi.sendMessage(
					{ customType: "auto-continue", content: IDLE_MESSAGE, display: false },
					{ triggerTurn: true, deliverAs: "followUp" }
				);
			}
			idleTimer = null;
		}, idleTimeoutMs);
	};

	pi.registerCommand("gnpi", {
		description: "Toggle auto-continue: /gnpi [on|off|seconds]",
		handler: async (args: string, ctx: ExtensionContext) => {
			const parts = args.trim().split(/\s+/);
			const command = parts[0].toLowerCase();

			if (command === "off" || command === "0") {
				enabled = false;
				if (idleTimer) {
					clearTimeout(idleTimer);
					idleTimer = null;
				}
				if (ctx.hasUI) {
					ctx.ui.notify("Auto-continue đã TẮT", "info");
				}
				return;
			}

			if (command === "on" || command === "1") {
				enabled = true;
				if (ctx.hasUI) {
					ctx.ui.notify(`Auto-continue đã BẬT - ${idleTimeoutMs / 1000}s timeout`, "info");
				}
				if (ctx.isIdle()) {
					startIdleTimer();
				}
				return;
			}

			const timeoutSec = parseInt(parts[0], 10);
			if (!isNaN(timeoutSec) && timeoutSec > 0) {
				idleTimeoutMs = timeoutSec * 1000;
				if (ctx.hasUI) {
					ctx.ui.notify(`Auto-continue timeout set to ${timeoutSec} giây`, "info");
				}
				return;
			}

			enabled = !enabled;
			if (enabled) {
				if (ctx.hasUI) {
					ctx.ui.notify(`Auto-continue đã BẬT - timeout=${idleTimeoutMs / 1000}s`, "info");
				}
				if (ctx.isIdle()) {
					startIdleTimer();
				}
			} else {
				if (idleTimer) {
					clearTimeout(idleTimer);
					idleTimer = null;
				}
				if (ctx.hasUI) {
					ctx.ui.notify("Auto-continue đã TẮT", "info");
				}
			}
		},
	});

	pi.on("agent_end", () => {
		if (!enabled) return;
		startIdleTimer();
	});

	pi.on("session_compact", () => {
		if (!enabled) return;
		startIdleTimer();
	});
}
