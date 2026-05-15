import type { AssistantMessage, ImageContent } from "@earendil-works/pi-ai";
import type { AgentSessionRuntime } from "../core/agent-session-runtime.js";
import { flushRawStdout, writeRawStdout } from "../core/output-guard.js";

export interface PrintModeOptions {
	mode: "text" | "json";
	messages?: string[];
	initialMessage?: string;
	initialImages?: ImageContent[];
}

function createCommandContextActions(session: any, runtimeHost: AgentSessionRuntime): any {
	return {
		waitForIdle: () => session.agent.waitForIdle(),
		newSession: async (options: any) => {
			const result = await runtimeHost.newSession(options);
			if (!result.cancelled) {
				await session.reload();
			}
			return result;
		},
		fork: async (entryId: string) => {
			const result = await runtimeHost.fork(entryId);
			if (!result.cancelled) {
				await session.reload();
			}
			return { cancelled: result.cancelled };
		},
		navigateTree: async (targetId: string, navigateOptions?: any) => {
			const result = await session.navigateTree(targetId, {
				summarize: navigateOptions?.summarize,
				customInstructions: navigateOptions?.customInstructions,
				replaceInstructions: navigateOptions?.replaceInstructions,
				label: navigateOptions?.label,
			});
			return { cancelled: result.cancelled };
		},
		switchSession: async (sessionPath: string) => {
			const result = await runtimeHost.switchSession(sessionPath);
			if (!result.cancelled) {
				await session.reload();
			}
			return result;
		},
		reload: async () => {
			await session.reload();
		},
	};
}

function bindExtensions(session: any, actions: any): () => void {
	const onError = (err: any) => {
		console.error(`Extension error (${err.extensionPath}): ${err.error}`);
	};
	session.bindExtensions({
		commandContextActions: actions,
		onError,
	});
	return () => {};
}

function maybeSubscribeJson(session: any, mode: "text" | "json"): () => void {
	if (mode !== "json") return () => {};
	const unsub = session.subscribe((event: any) => {
		writeRawStdout(`${JSON.stringify(event)}\n`);
	});
	return unsub;
}

async function rebindSession(
	runtimeHost: AgentSessionRuntime,
	mode: "text" | "json",
	setUnsub: (fn: () => void) => void,
): Promise<any> {
	const session = runtimeHost.session;
	const actions = createCommandContextActions(session, runtimeHost);
	const extUnsub = bindExtensions(session, actions);
	const jsonUnsub = maybeSubscribeJson(session, mode);
	const combinedUnsub = () => {
		extUnsub();
		jsonUnsub();
	};
	setUnsub(combinedUnsub);
	return session;
}

function renderJsonHeader(session: any): void {
	const header = session.sessionManager.getHeader?.();
	if (header) {
		writeRawStdout(`${JSON.stringify(header)}\n`);
	}
}

async function processInitialMessages(
	session: any,
	initialMessage?: string,
	initialImages?: ImageContent[],
	messages?: string[],
): Promise<void> {
	if (initialMessage) {
		await session.prompt(initialMessage, { images: initialImages });
	}
	for (const msg of messages ?? []) {
		await session.prompt(msg);
	}
}

function renderTextResult(session: any): number {
	const state = session.state;
	const lastMessage = state.messages?.[state.messages.length - 1];
	if (!lastMessage || lastMessage.role !== "assistant") {
		return 0;
	}
	const assistantMsg = lastMessage as AssistantMessage;
	if (assistantMsg.stopReason === "error" || assistantMsg.stopReason === "aborted") {
		console.error(assistantMsg.errorMessage || `Request ${assistantMsg.stopReason}`);
		return 1;
	}
	for (const content of assistantMsg.content) {
		if (content.type === "text") {
			writeRawStdout(`${content.text}\n`);
		}
	}
	flushRawStdout();
	return 0;
}

/**
 * Run in print (single-shot) mode.
 */
export async function runPrintMode(runtimeHost: AgentSessionRuntime, options: PrintModeOptions): Promise<number> {
	const { mode, messages = [], initialMessage, initialImages } = options;
	let exitCode = 0;
	let unsubscribe: () => void = () => {};

	try {
		const session = await rebindSession(runtimeHost, mode, (fn) => {
			unsubscribe = fn;
		});
		if (mode === "json") {
			renderJsonHeader(session);
		}
		await processInitialMessages(session, initialMessage, initialImages, messages);
		if (mode === "text") {
			exitCode = renderTextResult(session);
		}
		return exitCode;
	} finally {
		unsubscribe();
		flushRawStdout();
	}
}
