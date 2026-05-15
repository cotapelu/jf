/**
 * RPC mode: Headless operation with JSON stdin/stdout protocol.
 *
 * Used for embedding the agent in other applications.
 * Receives commands as JSON on stdin, outputs events and responses as JSON on stdout.
 *
 * Protocol:
 * - Commands: JSON objects with `type` field, optional `id` for correlation
 * - Responses: JSON objects with `type: "response"`, `command`, `success`, and optional `data`/`error`
 * - Events: AgentSessionEvent objects streamed as they occur
 * - Extension UI: Extension UI requests are emitted, client responds with extension_ui_response
 */

import * as crypto from "node:crypto";
import type { AgentSession } from "../../core/agent-session.js";
import type { AgentSessionRuntime } from "../../core/agent-session-runtime.js";
import type {
	ExtensionUIContext,
	ExtensionUIDialogOptions,
	ExtensionWidgetOptions,
} from "../../core/extensions/index.js";
import { takeOverStdout, writeRawStdout } from "../../core/output-guard.js";
import { type Theme, theme } from "../interactive/theme/theme.js";
import { attachJsonlLineReader, serializeJsonLine } from "./jsonl.js";
import type {
	RpcCommand,
	RpcExtensionUIRequest,
	RpcExtensionUIResponse,
	RpcResponse,
	RpcSessionState,
	RpcSlashCommand,
} from "./rpc-types.js";

// Re-export types for consumers
export type {
	RpcCommand,
	RpcExtensionUIRequest,
	RpcExtensionUIResponse,
	RpcResponse,
	RpcSessionState,
} from "./rpc-types.js";

// ============================================================================
// Types and Interfaces
// ============================================================================

interface RpcContext {
	runtimeHost: AgentSessionRuntime;
	session: AgentSession;
	unsubscribe?: () => void;
	detachInput?: () => void;
	pendingExtensionRequests: Map<string, { resolve: (value: any) => void; reject: (error: Error) => void }>;
	shutdownRequested: boolean;
	output: (obj: RpcResponse | RpcExtensionUIRequest | object) => void;
	success: <T extends RpcCommand["type"]>(id: string | undefined, command: T, data?: object | null) => RpcResponse;
	error: (id: string | undefined, command: string, message: string) => RpcResponse;
}

type CommandHandler = (ctx: RpcContext, command: any) => Promise<RpcResponse>;

// ============================================================================
// Core Output Helpers (≤20 lines each)
// ============================================================================

function rpcOutput(obj: RpcResponse | RpcExtensionUIRequest | object): void {
	writeRawStdout(serializeJsonLine(obj));
}

function rpcSuccess<T extends RpcCommand["type"]>(
	id: string | undefined,
	command: T,
	data?: object | null,
): RpcResponse {
	if (data === undefined) {
		return { id, type: "response", command, success: true } as RpcResponse;
	}
	return { id, type: "response", command, success: true, data } as RpcResponse;
}

function rpcError(id: string | undefined, command: string, message: string): RpcResponse {
	return { id, type: "response", command, success: false, error: message };
}

// ============================================================================
// Dialog Promise Helper (≤20 lines)
// ============================================================================

function createDialogPromise<T>(
	ctx: RpcContext,
	opts: ExtensionUIDialogOptions | undefined,
	defaultValue: T,
	request: Record<string, unknown>,
	parseResponse: (response: RpcExtensionUIResponse) => T,
): Promise<T> {
	if (opts?.signal?.aborted) return Promise.resolve(defaultValue);
	const id = crypto.randomUUID();
	return new Promise((resolve, reject) => {
		let timeoutId: ReturnType<typeof setTimeout>;
		const cleanup = () => {
			if (timeoutId) clearTimeout(timeoutId);
			opts?.signal?.removeEventListener("abort", onAbort);
			ctx.pendingExtensionRequests.delete(id);
		};
		const onAbort = () => {
			cleanup();
			resolve(defaultValue);
		};
		opts?.signal?.addEventListener("abort", onAbort, { once: true });
		if (opts?.timeout) {
			timeoutId = setTimeout(() => {
				cleanup();
				resolve(defaultValue);
			}, opts.timeout);
		}
		ctx.pendingExtensionRequests.set(id, {
			resolve: (response: RpcExtensionUIResponse) => {
				cleanup();
				resolve(parseResponse(response));
			},
			reject,
		});
		ctx.output({ type: "extension_ui_request", id, ...request } as RpcExtensionUIRequest);
	});
}

// ============================================================================
// Extension UI Context (class with small methods)
// ============================================================================

class RpcExtensionUIContextImpl implements ExtensionUIContext {
	constructor(private ctx: RpcContext) {}

	select = (title: string, options: any, opts?: ExtensionUIDialogOptions) =>
		createDialogPromise(this.ctx, opts, undefined, { method: "select", title, options }, (r) =>
			"cancelled" in r && r.cancelled ? undefined : "value" in r ? r.value : undefined,
		);

	confirm = (title: string, message: string, opts?: ExtensionUIDialogOptions) =>
		createDialogPromise(this.ctx, opts, false, { method: "confirm", title, message }, (r) =>
			"cancelled" in r && r.cancelled ? false : "confirmed" in r ? r.confirmed : false,
		);

	input = (title: string, placeholder: string, opts?: ExtensionUIDialogOptions) =>
		createDialogPromise(this.ctx, opts, undefined, { method: "input", title, placeholder }, (r) =>
			"cancelled" in r && r.cancelled ? undefined : "value" in r ? r.value : undefined,
		);

	notify = (message: string, type?: "info" | "warning" | "error") => {
		this.ctx.output({
			type: "extension_ui_request",
			id: crypto.randomUUID(),
			method: "notify",
			message,
			notifyType: type,
		} as RpcExtensionUIRequest);
	};

	onTerminalInput = () => () => {};

	setStatus = (key: string, text: string | undefined) => {
		this.ctx.output({
			type: "extension_ui_request",
			id: crypto.randomUUID(),
			method: "setStatus",
			statusKey: key,
			statusText: text,
		} as RpcExtensionUIRequest);
	};

	setWorkingMessage = (_message?: string) => {};

	setHiddenThinkingLabel = (_label?: string) => {};

	setWidget = (key: string, content: unknown, options?: ExtensionWidgetOptions) => {
		if (content === undefined || Array.isArray(content)) {
			this.ctx.output({
				type: "extension_ui_request",
				id: crypto.randomUUID(),
				method: "setWidget",
				widgetKey: key,
				widgetLines: content as string[] | undefined,
				widgetPlacement: options?.placement,
			} as RpcExtensionUIRequest);
		}
	};

	setFooter = (_factory: unknown) => {};

	setHeader = (_factory: unknown) => {};

	setTitle = (title: string) => {
		this.ctx.output({
			type: "extension_ui_request",
			id: crypto.randomUUID(),
			method: "setTitle",
			title,
		} as RpcExtensionUIRequest);
	};

	custom = async () => {
		return undefined as never;
	};

	pasteToEditor = (text: string) => {
		this.setEditorText(text);
	};

	setEditorText = (text: string) => {
		this.ctx.output({
			type: "extension_ui_request",
			id: crypto.randomUUID(),
			method: "set_editor_text",
			text,
		} as RpcExtensionUIRequest);
	};

	getEditorText = (): string => "";

	editor = async (title: string, prefill?: string): Promise<string | undefined> => {
		const id = crypto.randomUUID();
		return new Promise((resolve, reject) => {
			this.ctx.pendingExtensionRequests.set(id, {
				resolve: (response: RpcExtensionUIResponse) => {
					if ("cancelled" in response && response.cancelled) resolve(undefined);
					else if ("value" in response) resolve(response.value);
					else resolve(undefined);
				},
				reject,
			});
			this.ctx.output({
				type: "extension_ui_request",
				id,
				method: "editor",
				title,
				prefill,
			} as RpcExtensionUIRequest);
		});
	};

	setEditorComponent = () => {};

	get theme() {
		return theme;
	}

	getAllThemes = () => [];

	getTheme = (_name: string) => undefined;

	setTheme = (_theme: string | Theme) => {
		return { success: false, error: "Theme switching not supported in RPC mode" };
	};

	getToolsExpanded = () => false;

	setToolsExpanded = (_expanded: boolean) => {};
}

function createExtensionUIContext(ctx: RpcContext): ExtensionUIContext {
	return new RpcExtensionUIContextImpl(ctx);
}

// ============================================================================
// Command Context Actions (≤20 lines)
// ============================================================================

function createCommandContextActions(ctx: RpcContext) {
	return {
		waitForIdle: () => ctx.session.agent.waitForIdle(),
		newSession: async (options: any) => {
			const result = await ctx.runtimeHost.newSession(options);
			if (!result.cancelled) await rebindSession(ctx);
			return result;
		},
		fork: async (entryId: string) => {
			const result = await ctx.runtimeHost.fork(entryId);
			if (!result.cancelled) await rebindSession(ctx);
			return { cancelled: result.cancelled };
		},
		navigateTree: async (targetId: string, options: any) => {
			const result = await ctx.session.navigateTree(targetId, {
				summarize: options?.summarize,
				customInstructions: options?.customInstructions,
				replaceInstructions: options?.replaceInstructions,
				label: options?.label,
			});
			return { cancelled: result.cancelled };
		},
		switchSession: async (sessionPath: string) => {
			const result = await ctx.runtimeHost.switchSession(sessionPath);
			if (!result.cancelled) await rebindSession(ctx);
			return result;
		},
		reload: async () => {
			await ctx.session.reload();
		},
	};
}

// ============================================================================
// Session Rebinding (≤20 lines)
// ============================================================================

async function rebindSession(ctx: RpcContext): Promise<void> {
	ctx.session = ctx.runtimeHost.session;
	await ctx.session.bindExtensions({
		uiContext: createExtensionUIContext(ctx),
		commandContextActions: createCommandContextActions(ctx),
		shutdownHandler: () => {
			ctx.shutdownRequested = true;
		},
		onError: (err: any) => {
			ctx.output({
				type: "extension_error",
				extensionPath: err.extensionPath,
				event: err.event,
				error: err.error,
			});
		},
	});
	ctx.unsubscribe?.();
	ctx.unsubscribe = ctx.session.subscribe((event) => ctx.output(event));
}

// ============================================================================
// Command Handlers Map (each handler ≤20 lines)
// ============================================================================

const commandHandlers: Record<string, CommandHandler> = {
	prompt: async (ctx, command) => {
		ctx.session
			.prompt(command.message, {
				images: command.images,
				streamingBehavior: command.streamingBehavior,
				source: "rpc",
			})
			.catch((e) => ctx.output(rpcError(command.id, "prompt", e.message)));
		return rpcSuccess(command.id, "prompt");
	},

	steer: async (ctx, command) => {
		await ctx.session.steer(command.message, command.images);
		return rpcSuccess(command.id, "steer");
	},

	follow_up: async (ctx, command) => {
		await ctx.session.followUp(command.message, command.images);
		return rpcSuccess(command.id, "follow_up");
	},

	abort: async (ctx, command) => {
		await ctx.session.abort();
		return rpcSuccess(command.id, "abort");
	},

	new_session: async (ctx, command) => {
		const options = command.parentSession ? { parentSession: command.parentSession } : undefined;
		const result = await ctx.runtimeHost.newSession(options);
		if (!result.cancelled) await rebindSession(ctx);
		return rpcSuccess(command.id, "new_session", result);
	},

	get_state: async (ctx, command) => {
		const state: RpcSessionState = {
			model: ctx.session.model,
			thinkingLevel: ctx.session.thinkingLevel,
			isStreaming: ctx.session.isStreaming,
			isCompacting: ctx.session.isCompacting,
			steeringMode: ctx.session.steeringMode,
			followUpMode: ctx.session.followUpMode,
			sessionFile: ctx.session.sessionFile,
			sessionId: ctx.session.sessionId,
			sessionName: ctx.session.sessionName,
			autoCompactionEnabled: ctx.session.autoCompactionEnabled,
			messageCount: ctx.session.messages.length,
			pendingMessageCount: ctx.session.pendingMessageCount,
		};
		return rpcSuccess(command.id, "get_state", state);
	},

	set_model: async (ctx, command) => {
		const models = await ctx.session.modelRegistry.getAvailable();
		const model = models.find((m) => m.provider === command.provider && m.id === command.modelId);
		if (!model) return rpcError(command.id, "set_model", `Model not found: ${command.provider}/${command.modelId}`);
		await ctx.session.setModel(model);
		return rpcSuccess(command.id, "set_model", model);
	},

	cycle_model: async (ctx, command) => {
		const result = await ctx.session.cycleModel();
		return result ? rpcSuccess(command.id, "cycle_model", result) : rpcSuccess(command.id, "cycle_model", null);
	},

	get_available_models: async (ctx, command) => {
		const models = await ctx.session.modelRegistry.getAvailable();
		return rpcSuccess(command.id, "get_available_models", { models });
	},

	set_thinking_level: async (ctx, command) => {
		ctx.session.setThinkingLevel(command.level);
		return rpcSuccess(command.id, "set_thinking_level");
	},

	cycle_thinking_level: async (ctx, command) => {
		const level = ctx.session.cycleThinkingLevel();
		return level
			? rpcSuccess(command.id, "cycle_thinking_level", { level })
			: rpcSuccess(command.id, "cycle_thinking_level", null);
	},

	set_steering_mode: async (ctx, command) => {
		ctx.session.setSteeringMode(command.mode);
		return rpcSuccess(command.id, "set_steering_mode");
	},

	set_follow_up_mode: async (ctx, command) => {
		ctx.session.setFollowUpMode(command.mode);
		return rpcSuccess(command.id, "set_follow_up_mode");
	},

	compact: async (ctx, command) => {
		const result = await ctx.session.compact(command.customInstructions);
		return rpcSuccess(command.id, "compact", result);
	},

	set_auto_compaction: async (ctx, command) => {
		ctx.session.setAutoCompactionEnabled(command.enabled);
		return rpcSuccess(command.id, "set_auto_compaction");
	},

	set_auto_retry: async (ctx, command) => {
		ctx.session.setAutoRetryEnabled(command.enabled);
		return rpcSuccess(command.id, "set_auto_retry");
	},

	abort_retry: async (ctx, command) => {
		ctx.session.abortRetry();
		return rpcSuccess(command.id, "abort_retry");
	},

	bash: async (ctx, command) => {
		const result = await ctx.session.executeBash(command.command);
		return rpcSuccess(command.id, "bash", result);
	},

	abort_bash: async (ctx, command) => {
		ctx.session.abortBash();
		return rpcSuccess(command.id, "abort_bash");
	},

	get_session_stats: async (ctx, command) => {
		const stats = ctx.session.getSessionStats();
		return rpcSuccess(command.id, "get_session_stats", stats);
	},

	export_html: async (ctx, command) => {
		const path = await ctx.session.exportToHtml(command.outputPath);
		return rpcSuccess(command.id, "export_html", { path });
	},

	switch_session: async (ctx, command) => {
		const result = await ctx.runtimeHost.switchSession(command.sessionPath);
		if (!result.cancelled) await rebindSession(ctx);
		return rpcSuccess(command.id, "switch_session", result);
	},

	fork: async (ctx, command) => {
		const result = await ctx.runtimeHost.fork(command.entryId);
		if (!result.cancelled) await rebindSession(ctx);
		return rpcSuccess(command.id, "fork", { text: result.selectedText, cancelled: result.cancelled });
	},

	get_fork_messages: async (ctx, command) => {
		const messages = ctx.session.getUserMessagesForForking();
		return rpcSuccess(command.id, "get_fork_messages", { messages });
	},

	get_last_assistant_text: async (ctx, command) => {
		const text = ctx.session.getLastAssistantText();
		return rpcSuccess(command.id, "get_last_assistant_text", { text });
	},

	set_session_name: async (ctx, command) => {
		const name = command.name.trim();
		if (!name) return rpcError(command.id, "set_session_name", "Session name cannot be empty");
		ctx.session.setSessionName(name);
		return rpcSuccess(command.id, "set_session_name");
	},

	get_messages: async (ctx, command) => {
		return rpcSuccess(command.id, "get_messages", { messages: ctx.session.messages });
	},

	get_commands: async (ctx, command) => {
		const commands: RpcSlashCommand[] = [];

		for (const cmd of ctx.session.extensionRunner?.getRegisteredCommands() ?? []) {
			commands.push({
				name: cmd.invocationName,
				description: cmd.description,
				source: "extension",
				sourceInfo: cmd.sourceInfo,
			});
		}

		for (const template of ctx.session.promptTemplates) {
			commands.push({
				name: template.name,
				description: template.description,
				source: "prompt",
				sourceInfo: template.sourceInfo,
			});
		}

		for (const skill of ctx.session.resourceLoader.getSkills().skills) {
			commands.push({
				name: `skill:${skill.name}`,
				description: skill.description,
				source: "skill",
				sourceInfo: skill.sourceInfo,
			});
		}

		return rpcSuccess(command.id, "get_commands", { commands });
	},
};

function handleCommand(ctx: RpcContext, command: RpcCommand): Promise<RpcResponse> {
	const handler = commandHandlers[command.type];
	if (handler) {
		return handler(ctx, command);
	}
	return Promise.resolve(
		rpcError(undefined, (command as { type: string }).type, `Unknown command: ${(command as { type: string }).type}`),
	);
}

// ============================================================================
// Input Handling (≤20 lines each)
// ============================================================================

function handleInputLine(ctx: RpcContext, line: string): void {
	let parsed: unknown;
	try {
		parsed = JSON.parse(line);
	} catch (parseError: unknown) {
		ctx.output(
			rpcError(
				undefined,
				"parse",
				`Failed to parse command: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
			),
		);
		return;
	}

	if (typeof parsed === "object" && parsed !== null && "type" in parsed && parsed.type === "extension_ui_response") {
		const response = parsed as RpcExtensionUIResponse;
		const pending = ctx.pendingExtensionRequests.get(response.id);
		if (pending) {
			ctx.pendingExtensionRequests.delete(response.id);
			pending.resolve(response);
		}
		return;
	}

	const command = parsed as RpcCommand;
	handleInputLineAsync(ctx, command).catch((err) => {
		console.error("Unexpected error in handleInputLine:", err);
	});
}

async function handleInputLineAsync(ctx: RpcContext, command: any): Promise<void> {
	try {
		const response = await handleCommand(ctx, command);
		ctx.output(response);
		await checkShutdownRequested(ctx);
	} catch (commandError: unknown) {
		ctx.output(
			rpcError(
				(command as any).id,
				(command as any).type,
				commandError instanceof Error ? commandError.message : String(commandError),
			),
		);
	}
}

// ============================================================================
// Shutdown Handling (≤20 lines)
// ============================================================================

async function shutdown(ctx: RpcContext): Promise<never> {
	ctx.unsubscribe?.();
	await ctx.runtimeHost.dispose();
	ctx.detachInput?.();
	process.stdin.pause();
	process.exit(0);
}

async function checkShutdownRequested(ctx: RpcContext): Promise<void> {
	if (!ctx.shutdownRequested) return;
	await shutdown(ctx);
}

function onInputEnd(ctx: RpcContext): void {
	void shutdown(ctx);
}

// ============================================================================
// Initialization and Setup (≤20 lines)
// ============================================================================

function initializeRpcContext(runtimeHost: AgentSessionRuntime): RpcContext {
	return {
		runtimeHost,
		session: runtimeHost.session,
		pendingExtensionRequests: new Map(),
		shutdownRequested: false,
		output: (obj) => rpcOutput(obj),
		success: rpcSuccess as any,
		error: rpcError as any,
		unsubscribe: undefined,
		detachInput: undefined,
	};
}

function setupInputHandling(ctx: RpcContext): void {
	ctx.detachInput = attachJsonlLineReader(process.stdin, (line) => {
		void handleInputLine(ctx, line);
	});
	process.stdin.on("end", () => onInputEnd(ctx));
}

function waitForShutdown(): Promise<never> {
	return new Promise(() => {});
}

// ============================================================================
// Main Entry (Orchestrator ≤20 lines)
// ============================================================================

export async function runRpcMode(runtimeHost: AgentSessionRuntime): Promise<never> {
	takeOverStdout();
	const ctx = initializeRpcContext(runtimeHost);
	await rebindSession(ctx);
	setupInputHandling(ctx);
	return waitForShutdown();
}
