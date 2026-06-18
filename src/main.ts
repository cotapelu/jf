/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  // Types (ALL)
  type AgentSessionRuntime,
  type AgentSessionRuntimeDiagnostic,
  type AgentSessionServices,
  type CreateAgentSessionOptions,
  type CreateAgentSessionResult,
  type CreateAgentSessionRuntimeFactory,
  type CreateAgentSessionRuntimeResult,
  type CreateAgentSessionServicesOptions,
  type CreateAgentSessionFromServicesOptions,
  type PromptTemplate,
  // Functions (ALL)
  createAgentSession,
  createAgentSessionFromServices,
  createAgentSessionRuntime,
  createAgentSessionServices,
  createBashTool,
  createCodingTools,
  createEditTool,
  createFindTool,
  createGrepTool,
  createLsTool,
  createReadOnlyTools,
  createReadTool,
  createWriteTool,
  // Core
  getAgentDir,
  InteractiveMode,
  SessionManager,
  type InteractiveModeOptions,
  type ModelInfo,
} from '@earendil-works/pi-coding-agent';

import { registerAllCustomTools } from './tools/index.js';
import { getExtensionRegistry, GitExtension } from './tools/extensions/index.js';
import { setCurrentRuntime } from './runtime-context.js';
import { loadAll } from './auto-loader.js';

// 1️⃣ PromptTemplate usage
const myCustomPrompt: PromptTemplate = {
  name: 'my_custom_assistant',
  description: 'Custom assistant prompt for Pi SDK',
  filePath: process.argv[1] ?? '<inline:custom>',
  sourceInfo: {
    path: process.argv[1] ?? '<inline:custom>',
    source: 'temporary',
    scope: 'temporary',
    origin: 'top-level',
  },
  content: `You are an AI coding assistant specialized in TypeScript and Node.js. Be concise, accurate, and provide code examples when helpful. Always explain your reasoning before providing solutions.`,
};

// 2️⃣ Factory tạo runtime với tất cả factories
const createRuntime: CreateAgentSessionRuntimeFactory = async ({
  cwd,
  agentDir,
  sessionManager,
  sessionStartEvent,
  projectTrustContext,
}): Promise<CreateAgentSessionRuntimeResult> => {
  // Services với PromptTemplate override
  const servicesOptions: CreateAgentSessionServicesOptions = {
    cwd,
    agentDir,
    resourceLoaderOptions: {
      promptsOverride: () => ({
        prompts: [myCustomPrompt],
        diagnostics: [],
      }),
    },
  };

  const services: AgentSessionServices = await createAgentSessionServices(servicesOptions);
  const diagnostics: AgentSessionRuntimeDiagnostic[] = services.diagnostics;

  // Auto-load extensions and plugins
  await loadAll();

  // Register and initialize extensions
  const extensionRegistry = getExtensionRegistry();
  // Register built-in extensions (idempotent)
  if (!extensionRegistry.has('git')) {
    extensionRegistry.register(new GitExtension());
  }
  await extensionRegistry.initializeAll(cwd);
  const extensionTools = extensionRegistry.getAllTools(cwd);

  // Assemble custom tools: built-in custom tools + extension tools
  const baseCustomTools = registerAllCustomTools();
  const allCustomTools = [...baseCustomTools, ...extensionTools];

  // Session options: include all tool names
  const allToolNames = [
    'read',
    'bash',
    'edit',
    'write',
    'grep',
    'find',
    'ls',
    ...allCustomTools.map((t) => t.name),
  ];
  const sessionOptions: CreateAgentSessionFromServicesOptions = {
    services,
    sessionManager,
    sessionStartEvent,
    tools: allToolNames,
    customTools: allCustomTools,
  };

  // Create session với explicit typing
  const result: CreateAgentSessionResult = await createAgentSessionFromServices(sessionOptions);

  // Return full runtime result
  const runtimeResult: CreateAgentSessionRuntimeResult = {
    session: result.session,
    extensionsResult: result.extensionsResult,
    services,
    diagnostics,
    modelFallbackMessage: result.modelFallbackMessage,
  };

  // Log diagnostics
  diagnostics.forEach((diag: AgentSessionRuntimeDiagnostic) => {
    if (diag.type === 'warning') console.warn(`[Diagnostic] ${diag.message}`);
    if (diag.type === 'error') console.error(`[Diagnostic] ${diag.message}`);
  });

  return runtimeResult;
};

export async function main() {
  console.log('🚀 Pi SDK - FULL EXPORTS USAGE\n');

  // ====== RUNTIME SETUP ======
  const sessionManager: SessionManager = SessionManager.create(process.cwd());
  const runtime: AgentSessionRuntime = await createAgentSessionRuntime(createRuntime, {
    cwd: process.cwd(),
    agentDir: getAgentDir(),
    sessionManager,
  });

  setCurrentRuntime(runtime);
  console.log(` Parent session: ${runtime.session.sessionFile}\n`);

  const modeOptions: InteractiveModeOptions = {
    //==        initialMessages: ["Hello! I'm running with full Pi SDK exports."],
    // verbose: false, // Tắt verbose để tránh hiển thị input 2 lần
  };

  const demoModel: ModelInfo = {
    provider: 'anthropic',
    id: 'claude-sonnet-4-20250514',
    contextWindow: 200000,
    reasoning: true,
  };

  console.log('🖥️ Launching InteractiveMode...\n');
  const mode = new InteractiveMode(runtime, modeOptions);
  await mode.run();
}

// NOTE: main() is called by dist/cli.js, not here.
