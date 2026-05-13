/**
 * Main entry point for the coding agent CLI.
 *
 * This file handles CLI argument parsing and translates them into
 * createAgentSession() options. The SDK does the heavy lifting.
 */

import { resolve } from "node:path";
import { type ImageContent, modelsAreEqual, supportsXhigh } from "@mariozechner/pi-ai";
import { ProcessTerminal, setKeybindings, TUI } from "@mariozechner/pi-tui";
import chalk from "chalk";
import { createInterface } from "readline";
import { type Args, type Mode, parseArgs, printHelp } from "./cli/args.js";
import { processFileArguments } from "./cli/file-processor.js";
import { buildInitialMessage } from "./cli/initial-message.js";
import { listModels } from "./cli/list-models.js";
import { selectSession } from "./cli/session-picker.js";
import { getAgentDir, getModelsPath, VERSION } from "./config.js";
import { type CreateAgentSessionRuntimeFactory, createAgentSessionRuntime } from "./core/agent-session-runtime.js";
import {
	type AgentSessionRuntimeDiagnostic,
	createAgentSessionFromServices,
	createAgentSessionServices,
} from "./core/agent-session-services.js";
import { AuthStorage } from "./core/auth-storage.js";
import { exportFromFile } from "./core/export-html/index.js";
import { KeybindingsManager } from "./core/keybindings.js";
import type { ModelRegistry } from "./core/model-registry.js";
import { resolveCliModel, resolveModelScope, type ScopedModel } from "./core/model-resolver.js";
import { restoreStdout, takeOverStdout } from "./core/output-guard.js";
import type { CreateAgentSessionOptions } from "./core/sdk.js";
import {
	formatMissingSessionCwdPrompt,
	getMissingSessionCwdIssue,
	MissingSessionCwdError,
	type SessionCwdIssue,
} from "./core/session-cwd.js";
import { SessionManager } from "./core/session-manager.js";
import { SettingsManager } from "./core/settings-manager.js";
import { printTimings, resetTimings, time } from "./core/timings.js";
import { allTools } from "./core/tools/index.js";
import { runMigrations, showDeprecationWarnings } from "./migrations.js";
import { InteractiveMode, runPrintMode, runRpcMode } from "./modes/index.js";
import { ExtensionSelectorComponent } from "./modes/interactive/components/extension-selector.js";
import { initTheme, stopThemeWatcher } from "./modes/interactive/theme/theme.js";
import { handleConfigCommand, handlePackageCommand } from "./package-manager-cli.js";
import { isLocalPath } from "./utils/paths.js";

/**
 * Read all content from piped stdin.
 * Returns undefined if stdin is a TTY (interactive terminal).
 */
async function readPipedStdin(): Promise<string | undefined> {
	// If stdin is a TTY, we're running interactively - don't read stdin
	if (process.stdin.isTTY) {
		return undefined;
	}

	return new Promise((resolve) => {
		let data = "";
		process.stdin.setEncoding("utf8");
		process.stdin.on("data", (chunk) => {
			data += chunk;
		});
		process.stdin.on("end", () => {
			resolve(data.trim() || undefined);
		});
		process.stdin.resume();
	});
}

function collectSettingsDiagnostics(
	settingsManager: SettingsManager,
	context: string,
): AgentSessionRuntimeDiagnostic[] {
	return settingsManager.drainErrors().map(({ scope, error }) => ({
		type: "warning",
		message: `(${context}, ${scope} settings) ${error.message}`,
	}));
}

function reportDiagnostics(diagnostics: readonly AgentSessionRuntimeDiagnostic[]): void {
	for (const diagnostic of diagnostics) {
		const color = diagnostic.type === "error" ? chalk.red : diagnostic.type === "warning" ? chalk.yellow : chalk.dim;
		const prefix = diagnostic.type === "error" ? "Error: " : diagnostic.type === "warning" ? "Warning: " : "";
		console.error(color(`${prefix}${diagnostic.message}`));
	}
}

function isTruthyEnvFlag(value: string | undefined): boolean {
	if (!value) return false;
	return value === "1" || value.toLowerCase() === "true" || value.toLowerCase() === "yes";
}

/** Set up offline mode based on CLI args or env var */
function setupOfflineMode(args: string[]): void {
	const offlineMode = args.includes("--offline") || isTruthyEnvFlag(process.env.PI_OFFLINE);
	if (offlineMode) {
		process.env.PI_OFFLINE = "1";
		process.env.PI_SKIP_VERSION_CHECK = "1";
	}
}

type AppMode = "interactive" | "print" | "json" | "rpc";

function resolveAppMode(parsed: Args, stdinIsTTY: boolean): AppMode {
	if (parsed.mode === "rpc") {
		return "rpc";
	}
	if (parsed.mode === "json") {
		return "json";
	}
	if (parsed.print || !stdinIsTTY) {
		return "print";
	}
	return "interactive";
}

function toPrintOutputMode(appMode: AppMode): Exclude<Mode, "rpc"> {
	return appMode === "json" ? "json" : "text";
}

async function prepareInitialMessage(
	parsed: Args,
	autoResizeImages: boolean,
	stdinContent?: string,
): Promise<{
	initialMessage?: string;
	initialImages?: ImageContent[];
}> {
	if (parsed.fileArgs.length === 0) {
		return buildInitialMessage({ parsed, stdinContent });
	}

	const { text, images } = await processFileArguments(parsed.fileArgs, { autoResizeImages });
	return buildInitialMessage({
		parsed,
		fileText: text,
		fileImages: images,
		stdinContent,
	});
}

/** Result from resolving a session argument */
type ResolvedSession =
	| { type: "path"; path: string } // Direct file path
	| { type: "local"; path: string } // Found in current project
	| { type: "global"; path: string; cwd: string } // Found in different project
	| { type: "not_found"; arg: string }; // Not found anywhere

function isPathLikeSessionArg(arg: string): boolean {
	return arg.includes("/") || arg.includes("\\") || arg.endsWith(".jsonl");
}

async function findLocalSession(
	sessionArg: string,
	cwd: string,
	sessionDir: string | undefined,
): Promise<ResolvedSession | null> {
	const localSessions = await SessionManager.list(cwd, sessionDir);
	const localMatches = localSessions.filter((s) => s.id.startsWith(sessionArg));
	if (localMatches.length >= 1) {
		return { type: "local", path: localMatches[0].path };
	}
	return null;
}

async function findGlobalSession(sessionArg: string): Promise<ResolvedSession | null> {
	const allSessions = await SessionManager.listAll();
	const globalMatches = allSessions.filter((s) => s.id.startsWith(sessionArg));
	if (globalMatches.length >= 1) {
		const match = globalMatches[0];
		return { type: "global", path: match.path, cwd: match.cwd };
	}
	return null;
}

/**
 * Resolve a session argument to a file path.
 * If it looks like a path, use as-is. Otherwise try to match as session ID prefix.
 */
async function resolveSessionPath(sessionArg: string, cwd: string, sessionDir?: string): Promise<ResolvedSession> {
	if (isPathLikeSessionArg(sessionArg)) {
		return { type: "path", path: sessionArg };
	}
	const local = await findLocalSession(sessionArg, cwd, sessionDir);
	if (local) return local;
	const global = await findGlobalSession(sessionArg);
	if (global) return global;
	return { type: "not_found", arg: sessionArg };
}

/** Prompt user for yes/no confirmation */
async function promptConfirm(message: string): Promise<boolean> {
	return new Promise((resolve) => {
		const rl = createInterface({
			input: process.stdin,
			output: process.stdout,
		});
		rl.question(`${message} [y/N] `, (answer) => {
			rl.close();
			resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
		});
	});
}

function getConflictingForkFlags(parsed: Args): string[] {
	return [
		parsed.session ? "--session" : undefined,
		parsed.continue ? "--continue" : undefined,
		parsed.resume ? "--resume" : undefined,
		parsed.noSession ? "--no-session" : undefined,
	].filter((flag): flag is string => flag !== undefined);
}

function printForkFlagError(flags: string[]): void {
	console.error(
		`
${chalk.red.bold("✗ Invalid Argument Combination")}
${chalk.dim("The --fork flag cannot be used with:")}
  ${flags.map((flag) => chalk.yellow(`  • ${flag}`)).join("\n")}
${chalk.dim("Please remove one of the conflicting flags and try again.")}
		`.trim(),
	);
	process.exit(1);
}

function validateForkFlags(parsed: Args): void {
	if (!parsed.fork) return;
	const conflictingFlags = getConflictingForkFlags(parsed);
	if (conflictingFlags.length > 0) {
		printForkFlagError(conflictingFlags);
	}
}

function forkSessionOrExit(sourcePath: string, cwd: string, sessionDir?: string): SessionManager {
	try {
		return SessionManager.forkFrom(sourcePath, cwd, sessionDir);
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		console.error(chalk.red(`✗ Failed to fork session: ${message}`));
		process.exit(1);
	}
}

// Helper functions for createSessionManager
function handleNoSession(): SessionManager {
	return SessionManager.inMemory();
}

async function handleFork(sessionArg: string, cwd: string, sessionDir: string | undefined): Promise<SessionManager> {
	const resolved = await resolveSessionPath(sessionArg, cwd, sessionDir);
	switch (resolved.type) {
		case "path":
		case "local":
		case "global":
			return forkSessionOrExit(resolved.path, cwd, sessionDir);
		case "not_found":
			console.error(chalk.red(`No session found matching '${resolved.arg}'`));
			process.exit(1);
	}
}

async function handleSessionArg(
	sessionArg: string,
	cwd: string,
	sessionDir: string | undefined,
): Promise<SessionManager> {
	const resolved = await resolveSessionPath(sessionArg, cwd, sessionDir);
	switch (resolved.type) {
		case "path":
		case "local":
			return SessionManager.open(resolved.path, sessionDir);
		case "global": {
			console.log(chalk.yellow(`Session found in different project: ${resolved.cwd}`));
			const shouldFork = await promptConfirm("Fork this session into current directory?");
			if (!shouldFork) {
				console.log(chalk.dim("Aborted."));
				process.exit(0);
			}
			return forkSessionOrExit(resolved.path, cwd, sessionDir);
		}
		case "not_found":
			console.error(chalk.red(`No session found matching '${resolved.arg}'`));
			process.exit(1);
	}
}

async function handleResume(
	cwd: string,
	sessionDir: string | undefined,
	settingsManager: SettingsManager,
): Promise<SessionManager> {
	initTheme(settingsManager.getTheme(), true);
	try {
		const selectedPath = await selectSession(
			(onProgress) => SessionManager.list(cwd, sessionDir, onProgress),
			SessionManager.listAll,
		);
		if (!selectedPath) {
			console.log(chalk.dim("No session selected"));
			process.exit(0);
		}
		return SessionManager.open(selectedPath, sessionDir);
	} finally {
		stopThemeWatcher();
	}
}

function handleContinue(cwd: string, sessionDir: string | undefined): SessionManager {
	return SessionManager.continueRecent(cwd, sessionDir);
}

function createDefaultSession(cwd: string, sessionDir: string | undefined): SessionManager {
	return SessionManager.create(cwd, sessionDir);
}

async function createSessionManager(
	parsed: Args,
	cwd: string,
	sessionDir: string | undefined,
	settingsManager: SettingsManager,
): Promise<SessionManager> {
	if (parsed.noSession) return handleNoSession();
	if (parsed.fork) return handleFork(parsed.fork, cwd, sessionDir);
	if (parsed.session) return handleSessionArg(parsed.session, cwd, sessionDir);
	if (parsed.resume) return handleResume(cwd, sessionDir, settingsManager);
	if (parsed.continue) return handleContinue(cwd, sessionDir);
	return createDefaultSession(cwd, sessionDir);
}

/** Initialize session manager and handle cwd issues */
async function initializeSessionManager(
	parsed: Args,
	cwd: string,
	agentDir: string,
	appMode: AppMode,
): Promise<SessionManager> {
	const startupSettingsManager = SettingsManager.create(cwd, agentDir);
	reportDiagnostics(collectSettingsDiagnostics(startupSettingsManager, "startup session lookup"));

	const sessionDir = parsed.sessionDir ?? startupSettingsManager.getSessionDir();
	let sessionManager = await createSessionManager(parsed, cwd, sessionDir, startupSettingsManager);
	const missingSessionCwdIssue = getMissingSessionCwdIssue(sessionManager, cwd);
	sessionManager = await handleMissingSessionCwd(
		missingSessionCwdIssue,
		startupSettingsManager,
		appMode,
		sessionDir,
		sessionManager,
	);
	time("createSessionManager");
	return sessionManager;
}

/** Handle missing session cwd by prompting or erroring */
async function handleMissingSessionCwd(
	issue: SessionCwdIssue | undefined,
	settingsManager: SettingsManager,
	appMode: AppMode,
	sessionDir: string | undefined,
	sessionManager: SessionManager,
): Promise<SessionManager> {
	if (!issue) {
		return sessionManager;
	}
	if (appMode === "interactive") {
		const selectedCwd = await promptForMissingSessionCwd(issue, settingsManager);
		if (!selectedCwd) {
			process.exit(0);
		}
		return SessionManager.open(issue.sessionFile!, sessionDir, selectedCwd);
	} else {
		console.error(chalk.red(new MissingSessionCwdError(issue).message));
		process.exit(1);
	}
}

// Helper functions for buildSessionOptions
function applyCliModel(
	parsed: Args,
	modelRegistry: ModelRegistry,
	options: CreateAgentSessionOptions,
	diagnostics: AgentSessionRuntimeDiagnostic[],
): boolean {
	let cliThinkingFromModel = false;
	if (parsed.model) {
		const resolved = resolveCliModel({
			cliProvider: parsed.provider,
			cliModel: parsed.model,
			modelRegistry,
		});
		if (resolved.warning) {
			diagnostics.push({ type: "warning", message: resolved.warning });
		}
		if (resolved.error) {
			diagnostics.push({ type: "error", message: resolved.error });
		}
		if (resolved.model) {
			options.model = resolved.model;
			if (!parsed.thinking && resolved.thinkingLevel) {
				options.thinkingLevel = resolved.thinkingLevel;
				cliThinkingFromModel = true;
			}
		}
	}
	return cliThinkingFromModel;
}

function applyDefaultModel(
	parsed: Args,
	scopedModels: ScopedModel[],
	hasExistingSession: boolean,
	modelRegistry: ModelRegistry,
	settingsManager: SettingsManager,
	options: CreateAgentSessionOptions,
): void {
	if (options.model || scopedModels.length === 0 || hasExistingSession) {
		return;
	}
	const savedProvider = settingsManager.getDefaultProvider();
	const savedModelId = settingsManager.getDefaultModel();
	const savedModel = savedProvider && savedModelId ? modelRegistry.find(savedProvider, savedModelId) : undefined;
	const savedInScope = savedModel ? scopedModels.find((sm) => modelsAreEqual(sm.model, savedModel)) : undefined;

	if (savedInScope) {
		options.model = savedInScope.model;
		if (!parsed.thinking && savedInScope.thinkingLevel) {
			options.thinkingLevel = savedInScope.thinkingLevel;
		}
	} else {
		options.model = scopedModels[0].model;
		if (!parsed.thinking && scopedModels[0].thinkingLevel) {
			options.thinkingLevel = scopedModels[0].thinkingLevel;
		}
	}
}

function applyCliThinkingLevel(parsed: Args, options: CreateAgentSessionOptions): void {
	if (parsed.thinking) {
		options.thinkingLevel = parsed.thinking;
	}
}

function applyScopedModels(scopedModels: ScopedModel[], options: CreateAgentSessionOptions): void {
	if (scopedModels.length > 0) {
		options.scopedModels = scopedModels.map((sm) => ({
			model: sm.model,
			thinkingLevel: sm.thinkingLevel,
		}));
	}
}

function applyTools(parsed: Args, options: CreateAgentSessionOptions): void {
	if (parsed.noTools) {
		if (parsed.tools && parsed.tools.length > 0) {
			options.tools = parsed.tools.map((name) => allTools[name]);
		} else {
			options.tools = [];
		}
	} else if (parsed.tools) {
		options.tools = parsed.tools.map((name) => allTools[name]);
	}
}

function buildSessionOptions(
	parsed: Args,
	scopedModels: ScopedModel[],
	hasExistingSession: boolean,
	modelRegistry: ModelRegistry,
	settingsManager: SettingsManager,
): {
	options: CreateAgentSessionOptions;
	cliThinkingFromModel: boolean;
	diagnostics: AgentSessionRuntimeDiagnostic[];
} {
	const options: CreateAgentSessionOptions = {};
	const diagnostics: AgentSessionRuntimeDiagnostic[] = [];
	const cliThinkingFromModel = applyCliModel(parsed, modelRegistry, options, diagnostics);
	applyDefaultModel(parsed, scopedModels, hasExistingSession, modelRegistry, settingsManager, options);
	applyCliThinkingLevel(parsed, options);
	applyScopedModels(scopedModels, options);
	applyTools(parsed, options);
	return { options, cliThinkingFromModel, diagnostics };
}

function resolveCliPaths(cwd: string, paths: string[] | undefined): string[] | undefined {
	return paths?.map((value) => (isLocalPath(value) ? resolve(cwd, value) : value));
}

function createPromptUI(settingsManager: SettingsManager): TUI {
	initTheme(settingsManager.getTheme());
	setKeybindings(KeybindingsManager.create());
	const ui = new TUI(new ProcessTerminal(), settingsManager.getShowHardwareCursor());
	ui.setClearOnShrink(settingsManager.getClearOnShrink());
	return ui;
}

function runSessionCwdSelector(ui: TUI, issue: SessionCwdIssue, finish: (result: string | undefined) => void): void {
	const selector = new ExtensionSelectorComponent(
		formatMissingSessionCwdPrompt(issue),
		["Continue", "Cancel"],
		(option) => finish(option === "Continue" ? issue.fallbackCwd : undefined),
		() => finish(undefined),
		{ tui: ui },
	);
	ui.addChild(selector);
	ui.setFocus(selector);
	ui.start();
}

async function promptForMissingSessionCwd(
	issue: SessionCwdIssue,
	settingsManager: SettingsManager,
): Promise<string | undefined> {
	return new Promise((resolve) => {
		const ui = createPromptUI(settingsManager);
		let settled = false;
		const finish = (result: string | undefined) => {
			if (settled) return;
			settled = true;
			ui.stop();
			resolve(result);
		};
		runSessionCwdSelector(ui, issue, finish);
	});
}

export async function main(args: string[]) {
	resetTimings();
	setupOfflineMode(args);

	if (await handlePackageCommand(args)) {
		return;
	}

	if (await handleConfigCommand(args)) {
		return;
	}

	const parsed = parseArgs(args);
	if (parsed.diagnostics.length > 0) {
		for (const d of parsed.diagnostics) {
			const color = d.type === "error" ? chalk.red : chalk.yellow;
			console.error(color(`${d.type === "error" ? "Error" : "Warning"}: ${d.message}`));
		}
		if (parsed.diagnostics.some((d) => d.type === "error")) {
			process.exit(1);
		}
	}
	time("parseArgs");
	let appMode = resolveAppMode(parsed, process.stdin.isTTY);
	const shouldTakeOverStdout = appMode !== "interactive";
	if (shouldTakeOverStdout) {
		takeOverStdout();
	}

	if (parsed.version) {
		console.log(VERSION);
		process.exit(0);
	}

	if (parsed.export) {
		let result: string;
		try {
			const outputPath = parsed.messages.length > 0 ? parsed.messages[0] : undefined;
			result = await exportFromFile(parsed.export, outputPath);
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : "Failed to export session";
			console.error(chalk.red(`✗ Export failed: ${message}`));
			process.exit(1);
		}
		console.log(`Exported to: ${result}`);
		process.exit(0);
	}

	if (parsed.mode === "rpc" && parsed.fileArgs.length > 0) {
		console.error(chalk.red("✗ @file arguments are not supported in RPC mode"));
		process.exit(1);
	}

	validateForkFlags(parsed);

	// Run migrations (pass cwd for project-local migrations)
	const { migratedAuthProviders: migratedProviders, deprecationWarnings } = runMigrations(process.cwd());
	time("runMigrations");

	const cwd = process.cwd();
	const agentDir = getAgentDir();
	const sessionManager = await initializeSessionManager(parsed, cwd, agentDir, appMode);

	const resolvedExtensionPaths = resolveCliPaths(cwd, parsed.extensions);
	const resolvedSkillPaths = resolveCliPaths(cwd, parsed.skills);
	const resolvedPromptTemplatePaths = resolveCliPaths(cwd, parsed.promptTemplates);
	const resolvedThemePaths = resolveCliPaths(cwd, parsed.themes);
	const authStorage = AuthStorage.create();
	const createRuntime: CreateAgentSessionRuntimeFactory = async ({
		cwd,
		agentDir,
		sessionManager,
		sessionStartEvent,
	}) => {
		const services = await createAgentSessionServices({
			cwd,
			agentDir,
			authStorage,
			extensionFlagValues: parsed.unknownFlags,
			resourceLoaderOptions: {
				additionalExtensionPaths: resolvedExtensionPaths,
				additionalSkillPaths: resolvedSkillPaths,
				additionalPromptTemplatePaths: resolvedPromptTemplatePaths,
				additionalThemePaths: resolvedThemePaths,
				noExtensions: parsed.noExtensions,
				noSkills: parsed.noSkills,
				noPromptTemplates: parsed.noPromptTemplates,
				noThemes: parsed.noThemes,
				systemPrompt: parsed.systemPrompt,
				appendSystemPrompt: parsed.appendSystemPrompt,
			},
		});
		const { settingsManager, modelRegistry, resourceLoader } = services;
		const diagnostics: AgentSessionRuntimeDiagnostic[] = [
			...services.diagnostics,
			...collectSettingsDiagnostics(settingsManager, "runtime creation"),
			...resourceLoader.getExtensions().errors.map(({ path, error }) => ({
				type: "error" as const,
				message: `Failed to load extension "${path}": ${error}`,
			})),
		];

		const modelPatterns = parsed.models ?? settingsManager.getEnabledModels();
		const scopedModels =
			modelPatterns && modelPatterns.length > 0 ? await resolveModelScope(modelPatterns, modelRegistry) : [];
		const {
			options: sessionOptions,
			cliThinkingFromModel,
			diagnostics: sessionOptionDiagnostics,
		} = buildSessionOptions(
			parsed,
			scopedModels,
			sessionManager.buildSessionContext().messages.length > 0,
			modelRegistry,
			settingsManager,
		);
		diagnostics.push(...sessionOptionDiagnostics);

		if (parsed.apiKey) {
			if (!sessionOptions.model) {
				diagnostics.push({
					type: "error",
					message: "--api-key requires a model to be specified via --model, --provider/--model, or --models",
				});
			} else {
				authStorage.setRuntimeApiKey(sessionOptions.model.provider, parsed.apiKey);
			}
		}

		const created = await createAgentSessionFromServices({
			services,
			sessionManager,
			sessionStartEvent,
			model: sessionOptions.model,
			thinkingLevel: sessionOptions.thinkingLevel,
			scopedModels: sessionOptions.scopedModels,
			tools: sessionOptions.tools,
			customTools: sessionOptions.customTools,
		});
		const cliThinkingOverride = parsed.thinking !== undefined || cliThinkingFromModel;
		if (created.session.model && cliThinkingOverride) {
			let effectiveThinking = created.session.thinkingLevel;
			if (!created.session.model.reasoning) {
				effectiveThinking = "off";
			} else if (effectiveThinking === "xhigh" && !supportsXhigh(created.session.model)) {
				effectiveThinking = "high";
			}
			if (effectiveThinking !== created.session.thinkingLevel) {
				created.session.setThinkingLevel(effectiveThinking);
			}
		}

		return {
			...created,
			services,
			diagnostics,
		};
	};
	time("createRuntime");
	const runtime = await createAgentSessionRuntime(createRuntime, {
		cwd: sessionManager.getCwd(),
		agentDir,
		sessionManager,
	});
	const { services, session, modelFallbackMessage } = runtime;
	const { settingsManager, modelRegistry, resourceLoader } = services;

	if (parsed.help) {
		const extensionFlags = resourceLoader
			.getExtensions()
			.extensions.flatMap((extension) => Array.from(extension.flags.values()));
		printHelp(extensionFlags);
		process.exit(0);
	}

	if (parsed.listModels !== undefined) {
		const searchPattern = typeof parsed.listModels === "string" ? parsed.listModels : undefined;
		await listModels(modelRegistry, searchPattern);
		process.exit(0);
	}

	// Read piped stdin content (if any) - skip for RPC mode which uses stdin for JSON-RPC
	let stdinContent: string | undefined;
	if (appMode !== "rpc") {
		stdinContent = await readPipedStdin();
		if (stdinContent !== undefined && appMode === "interactive") {
			appMode = "print";
		}
	}
	time("readPipedStdin");

	const { initialMessage, initialImages } = await prepareInitialMessage(
		parsed,
		settingsManager.getImageAutoResize(),
		stdinContent,
	);
	time("prepareInitialMessage");
	initTheme(settingsManager.getTheme(), appMode === "interactive");
	time("initTheme");

	// Show deprecation warnings in interactive mode
	if (appMode === "interactive" && deprecationWarnings.length > 0) {
		await showDeprecationWarnings(deprecationWarnings);
	}

	const scopedModels = [...session.scopedModels];
	time("resolveModelScope");
	reportDiagnostics(runtime.diagnostics);
	if (runtime.diagnostics.some((diagnostic) => diagnostic.type === "error")) {
		process.exit(1);
	}
	time("createAgentSession");

	if (appMode !== "interactive" && !session.model) {
		console.error(chalk.red("No models available."));
		console.error(chalk.yellow("\nSet an API key environment variable:"));
		console.error("  ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY, etc.");
		console.error(chalk.yellow(`\nOr create ${getModelsPath()}`));
		process.exit(1);
	}

	const startupBenchmark = isTruthyEnvFlag(process.env.PI_STARTUP_BENCHMARK);
	if (startupBenchmark && appMode !== "interactive") {
		console.error(chalk.red("✗ PI_STARTUP_BENCHMARK only supports interactive mode"));
		process.exit(1);
	}

	if (appMode === "rpc") {
		printTimings();
		await runRpcMode(runtime);
	} else if (appMode === "interactive") {
		if (scopedModels.length > 0 && (parsed.verbose || !settingsManager.getQuietStartup())) {
			const modelList = scopedModels
				.map((sm) => {
					const thinkingStr = sm.thinkingLevel ? `:${sm.thinkingLevel}` : "";
					return `${sm.model.id}${thinkingStr}`;
				})
				.join(", ");
			console.log(chalk.dim(`Model scope: ${modelList} ${chalk.gray("(Ctrl+P to cycle)")}`));
		}

		const interactiveMode = new InteractiveMode(runtime, {
			migratedProviders,
			modelFallbackMessage,
			initialMessage,
			initialImages,
			initialMessages: parsed.messages,
			verbose: parsed.verbose,
		});
		if (startupBenchmark) {
			await interactiveMode.init();
			time("interactiveMode.init");
			printTimings();
			interactiveMode.stop();
			stopThemeWatcher();
			if (process.stdout.writableLength > 0) {
				await new Promise<void>((resolve) => process.stdout.once("drain", resolve));
			}
			if (process.stderr.writableLength > 0) {
				await new Promise<void>((resolve) => process.stderr.once("drain", resolve));
			}
			return;
		}

		printTimings();
		await interactiveMode.run();
	} else {
		printTimings();
		const exitCode = await runPrintMode(runtime, {
			mode: toPrintOutputMode(appMode),
			messages: parsed.messages,
			initialMessage,
			initialImages,
		});
		stopThemeWatcher();
		restoreStdout();
		if (exitCode !== 0) {
			process.exitCode = exitCode;
		}
		return;
	}
}
