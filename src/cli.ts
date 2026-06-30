#!/usr/bin/env node

// ============================================
// Reference: llm-context/coding-agent/src/index.ts
// Purpose: API exports organized by source file
// ============================================

// --- cli/args.ts ---
// export { type Args, parseArgs } from "./cli/args.ts";

// --- config.ts ---
// export { getAgentDir, getDocsPath, getExamplesPath, getPackageDir, getReadmePath, VERSION } from "./config.ts";

// --- core/agent-session.ts ---
// export {
// 	AgentSession,
// 	type AgentSessionConfig,
// 	type AgentSessionEvent,
// 	type AgentSessionEventListener,
// 	type ModelCycleResult,
// 	type ParsedSkillBlock,
// 	type PromptOptions,
// 	parseSkillBlock,
// 	type SessionStats,
// } from "./core/agent-session.ts";

// --- core/auth-storage.ts ---
// export {
// 	type ApiKeyCredential,
// 	type AuthCredential,
// 	type AuthStatus,
// 	AuthStorage,
// 	type AuthStorageBackend,
// 	FileAuthStorageBackend,
// 	InMemoryAuthStorageBackend,
// 	type OAuthCredential,
// } from "./core/auth-storage.ts";

// --- core/compaction/index.ts ---
// export {
// 	type BranchPreparation,
// 	type BranchSummaryResult,
// 	type CollectEntriesResult,
// 	type CompactionResult,
// 	type CutPointResult,
// 	calculateContextTokens,
// 	collectEntriesForBranchSummary,
// 	compact,
// 	DEFAULT_COMPACTION_SETTINGS,
// 	estimateTokens,
// 	type FileOperations,
// 	findCutPoint,
// 	findTurnStartIndex,
// 	type GenerateBranchSummaryOptions,
// 	generateBranchSummary,
// 	generateSummary,
// 	getLastAssistantUsage,
// 	prepareBranchEntries,
// 	serializeConversation,
// 	shouldCompact,
// } from "./core/compaction/index.ts";

// --- core/event-bus.ts ---
// export { createEventBus, type EventBus, type EventBusController } from "./core/event-bus.ts";

// --- core/extensions/index.ts ---
// export type {
// 	AgentEndEvent,
// 	AgentStartEvent,
// 	AgentToolResult,
// 	AgentToolUpdateCallback,
// 	AppKeybinding,
// 	AutocompleteProviderFactory,
// 	BashToolCallEvent,
// 	BeforeAgentStartEvent,
// 	BeforeAgentStartEventResult,
// 	BeforeProviderRequestEvent,
// 	BeforeProviderRequestEventResult,
// 	BuildSystemPromptOptions,
// 	CompactOptions,
// 	ContextEvent,
// 	ContextUsage,
// 	CustomToolCallEvent,
// 	EditToolCallEvent,
// 	ExecOptions,
// 	ExecResult,
// 	Extension,
// 	ExtensionActions,
// 	ExtensionAPI,
// 	ExtensionCommandContext,
// 	ExtensionCommandContextActions,
// 	ExtensionContext,
// 	ExtensionContextActions,
// 	ExtensionError,
// 	ExtensionEvent,
// 	ExtensionFactory,
// 	ExtensionFlag,
// 	ExtensionHandler,
// 	ExtensionRuntime,
// 	ExtensionShortcut,
// 	ExtensionUIContext,
// 	ExtensionUIDialogOptions,
// 	ExtensionWidgetOptions,
// 	FindToolCallEvent,
// 	GrepToolCallEvent,
// 	InputEvent,
// 	InputEventResult,
// 	InputSource,
// 	KeybindingsManager,
// 	LoadExtensionsResult,
// 	LsToolCallEvent,
// 	MessageRenderer,
// 	MessageRenderOptions,
// 	ProjectTrustContext,
// 	ProjectTrustEvent,
// 	ProjectTrustEventDecision,
// 	ProjectTrustEventResult,
// 	ProjectTrustHandler,
// 	ProviderConfig,
// 	ProviderModelConfig,
// 	ReadToolCallEvent,
// 	RegisteredCommand,
// 	RegisteredTool,
// 	ResolvedCommand,
// 	SessionBeforeCompactEvent,
// 	SessionBeforeForkEvent,
// 	SessionBeforeSwitchEvent,
// 	SessionBeforeTreeEvent,
// 	SessionCompactEvent,
// 	SessionShutdownEvent,
// 	SessionStartEvent,
// 	SessionTreeEvent,
// 	SlashCommandInfo,
// 	SlashCommandSource,
// 	SourceInfo,
// 	TerminalInputHandler,
// 	ToolCallEvent,
// 	ToolCallEventResult,
// 	ToolDefinition,
// 	ToolExecutionMode,
// 	ToolInfo,
// 	ToolRenderResultOptions,
// 	ToolResultEvent,
// 	TurnEndEvent,
// 	TurnStartEvent,
// 	UserBashEvent,
// 	UserBashEventResult,
// 	WidgetPlacement,
// 	WorkingIndicatorOptions,
// 	WriteToolCallEvent,
// } from "./core/extensions/index.ts";
// export {
// 	createExtensionRuntime,
// 	defineTool,
// 	discoverAndLoadExtensions,
// 	ExtensionRunner,
// 	isBashToolResult,
// 	isEditToolResult,
// 	isFindToolResult,
// 	isGrepToolResult,
// 	isLsToolResult,
// 	isReadToolResult,
// 	isToolCallEventType,
// 	isWriteToolResult,
// 	wrapRegisteredTool,
// 	wrapRegisteredTools,
// } from "./core/extensions/index.ts";

// --- core/footer-data-provider.ts ---
// export type { ReadonlyFooterDataProvider } from "./core/footer-data-provider.ts";

// --- core/messages.ts ---
// export { convertToLlm } from "./core/messages.ts";

// --- core/model-registry.ts ---
// export { ModelRegistry } from "./core/model-registry.ts";

// --- core/package-manager.ts ---
// export type {
// 	PackageManager,
// 	PathMetadata,
// 	ProgressCallback,
// 	ProgressEvent,
// 	ResolvedPaths,
// 	ResolvedResource,
// } from "./core/package-manager.ts";
// export { DefaultPackageManager } from "./core/package-manager.ts";

// --- core/resource-loader.ts ---
// export type { ResourceCollision, ResourceDiagnostic, ResourceLoader } from "./core/resource-loader.ts";
// export { DefaultResourceLoader, loadProjectContextFiles } from "./core/resource-loader.ts";

// --- core/sdk.ts ---
// export {
// 	AgentSessionRuntime,
// 	type AgentSessionRuntimeDiagnostic,
// 	type AgentSessionServices,
// 	type CreateAgentSessionFromServicesOptions,
// 	type CreateAgentSessionOptions,
// 	type CreateAgentSessionResult,
// 	type CreateAgentSessionRuntimeFactory,
// 	type CreateAgentSessionRuntimeResult,
// 	type CreateAgentSessionServicesOptions,
// 	// Factory
// 	createAgentSession,
// 	createAgentSessionFromServices,
// 	createAgentSessionRuntime,
// 	createAgentSessionServices,
// 	createBashTool,
// 	// Tool factories (for custom cwd)
// 	createCodingTools,
// 	createEditTool,
// 	createFindTool,
// 	createGrepTool,
// 	createLsTool,
// 	createReadOnlyTools,
// 	createReadTool,
// 	createWriteTool,
// 	type PromptTemplate,
// } from "./core/sdk.ts";

// --- core/session-manager.ts ---
// export type {
// 	BranchSummaryEntry,
// 	buildSessionContext,
// 	type CompactionEntry,
// 	CURRENT_SESSION_VERSION,
// 	type CustomEntry,
// 	type CustomMessageEntry,
// 	type FileEntry,
// 	getLatestCompactionEntry,
// 	type ModelChangeEntry,
// 	migrateSessionEntries,
// 	type NewSessionOptions,
// 	parseSessionEntries,
// 	type SessionContext,
// 	type SessionEntry,
// 	type SessionEntryBase,
// 	type SessionHeader,
// 	type SessionInfo,
// 	type SessionInfoEntry,
// 	SessionManager,
// 	type SessionMessageEntry,
// 	ThinkingLevelChangeEntry,
// } from "./core/session-manager.ts";

// --- core/settings-manager.ts ---
// export type {
// 	CompactionSettings,
// 	ImageSettings,
// 	PackageSource,
// 	RetrySettings,
// } from "./core/settings-manager.ts";
// export { SettingsManager } from "./core/settings-manager.ts";

// --- core/skills.ts ---
// export {
// 	formatSkillsForPrompt,
// 	type LoadSkillsFromDirOptions,
// 	type LoadSkillsResult,
// 	loadSkills,
// 	loadSkillsFromDir,
// 	type Skill,
// 	type SkillFrontmatter,
// } from "./core/skills.ts";

// --- core/source-info.ts ---
// export { createSyntheticSourceInfo } from "./core/source-info.ts";

// --- core/tools/index.ts ---
// export {
// 	type BashOperations,
// 	type BashSpawnContext,
// 	type BashSpawnHook,
// 	type BashToolDetails,
// 	type BashToolInput,
// 	type BashToolOptions,
// 	createBashToolDefinition,
// 	createEditToolDefinition,
// 	createFindToolDefinition,
// 	createGrepToolDefinition,
// 	createLocalBashOperations,
// 	createLsToolDefinition,
// 	createReadToolDefinition,
// 	createWriteToolDefinition,
// 	DEFAULT_MAX_BYTES,
// 	DEFAULT_MAX_LINES,
// 	type EditOperations,
// 	type EditToolDetails,
// 	type EditToolInput,
// 	type EditToolOptions,
// 	type FindOperations,
// 	type FindToolDetails,
// 	type FindToolInput,
// 	type FindToolOptions,
// 	formatSize,
// 	type GrepOperations,
// 	type GrepToolDetails,
// 	type GrepToolInput,
// 	type GrepToolOptions,
// 	type LsOperations,
// 	type LsToolDetails,
// 	type LsToolInput,
// 	type LsToolOptions,
// 	type ReadOperations,
// 	type ReadToolDetails,
// 	type ReadToolInput,
// 	type ReadToolOptions,
// 	type ToolsOptions,
// 	type TruncationOptions,
// 	type TruncationResult,
// 	truncateHead,
// 	truncateLine,
// 	truncateTail,
// 	type WriteOperations,
// 	type WriteToolInput,
// 	type WriteToolOptions,
// 	withFileMutationQueue,
// } from "./core/tools/index.ts";

// --- core/trust-manager.ts ---
// export { hasProjectTrustInputs, type ProjectTrustDecision, ProjectTrustStore } from "./core/trust-manager.ts";

// --- main.ts ---
// export { type MainOptions, main } from "./main.ts";

// --- modes/index.ts ---
// export {
// 	InteractiveMode,
// 	type InteractiveModeOptions,
// 	type ModelInfo,
// 	type PrintModeOptions,
// 	RpcClient,
// 	type RpcClientOptions,
// 	type RpcCommand,
// 	type RpcEventListener,
// 	type RpcExtensionUIRequest,
// 	type RpcExtensionUIResponse,
// 	type RpcResponse,
// 	type RpcSessionState,
// 	runPrintMode,
// 	runRpcMode,
// } from "./modes/index.ts";

// --- modes/interactive/components/index.ts ---
// export {
// 	ArminComponent,
// 	AssistantMessageComponent,
// 	BashExecutionComponent,
// 	BorderedLoader,
// 	BranchSummaryMessageComponent,
// 	CompactionSummaryMessageComponent,
// 	CustomEditor,
// 	CustomMessageComponent,
// 	DynamicBorder,
// 	ExtensionEditorComponent,
// 	ExtensionInputComponent,
// 	ExtensionSelectorComponent,
// 	FooterComponent,
// 	keyHint,
// 	keyText,
// 	LoginDialogComponent,
// 	ModelSelectorComponent,
// 	OAuthSelectorComponent,
// 	type RenderDiffOptions,
// 	rawKeyHint,
// 	renderDiff,
// 	SessionSelectorComponent,
// 	type SettingsCallbacks,
// 	type SettingsConfig,
// 	SettingsSelectorComponent,
// 	ShowImagesSelectorComponent,
// 	SkillInvocationMessageComponent,
// 	ThemeSelectorComponent,
// 	ThinkingSelectorComponent,
// 	ToolExecutionComponent,
// 	type ToolExecutionOptions,
// 	TreeSelectorComponent,
// 	truncateToVisualLines,
// 	UserMessageComponent,
// 	UserMessageSelectorComponent,
// 	type VisualTruncateResult,
// } from "./modes/interactive/components/index.ts";

// --- modes/interactive/theme/theme.ts ---
// export {
// 	getLanguageFromPath,
// 	getMarkdownTheme,
// 	getSelectListTheme,
// 	getSettingsListTheme,
// 	highlightCode,
// 	initTheme,
// 	Theme,
// 	type ThemeColor,
// } from "./modes/interactive/theme/theme.ts";

// --- utils/clipboard.ts ---
// export { copyToClipboard } from "./utils/clipboard.ts";

// --- utils/frontmatter.ts ---
// export { parseFrontmatter, stripFrontmatter } from "./utils/frontmatter.ts";

// --- utils/image-convert.ts ---
// export { convertToPng } from "./utils/image-convert.ts";

// --- utils/image-resize.ts ---
// export { formatDimensionNote, type ResizedImage, resizeImage } from "./utils/image-resize.ts";

// --- utils/shell.ts ---
// export { getShellConfig } from "./utils/shell.ts";

import { main } from './addon/main.js';
console.error('cli starting...');
main().catch((err: unknown) => {
  console.error('Fatal:', err);
  process.exit(1);
});
