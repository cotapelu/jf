import path from 'path';
import { fileURLToPath } from 'url';
import {
  type AgentSessionRuntime,
  type AgentSessionRuntimeDiagnostic,
  type AgentSessionServices,
  type CreateAgentSessionRuntimeFactory,
  type CreateAgentSessionRuntimeResult,
  type CreateAgentSessionServicesOptions,
  type CreateAgentSessionFromServicesOptions,
  type CreateAgentSessionResult,
  type PromptTemplate,
  createAgentSessionRuntime,
  createAgentSessionServices,
  createAgentSessionFromServices,
  getAgentDir,
  InteractiveMode,
  SessionManager,
  type InteractiveModeOptions,
} from '@earendil-works/pi-coding-agent';

import { setCurrentRuntime } from './runtime-context.js';

// Resolve package root dir (where src/ lives)
// In build: dist/main.js => package root is 1 level up
// In src: src/main.ts => package root is 1 level up
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageRoot = path.resolve(__dirname, '..');

// Extensions are loaded from src/extensions via extensionsAggregator

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
  // projectTrustContext: không dùng trong hiện tại, có thể dùng sau
}): Promise<CreateAgentSessionRuntimeResult> => {
  // Services với PromptTemplate override và extension discovery
  const servicesOptions: CreateAgentSessionServicesOptions = {
    cwd,
    agentDir,
    resourceLoaderOptions: {
      promptsOverride: () => ({
        prompts: [myCustomPrompt],
        diagnostics: [],
      }),
      // Auto-discovery paths for extensions - use packageRoot, not process.cwd()
      additionalExtensionPaths: [
        path.join(packageRoot, 'src/extensions'), // dev
        path.join(packageRoot, 'dist/extensions'), // prod
        path.join(packageRoot, '.pi/extensions'), // local
      ],
    },
  };

  let services: AgentSessionServices;
  try {
    services = await createAgentSessionServices(servicesOptions);
  } catch (err) {
    console.error('❌ Failed to create agent session services:', err);
    throw err;
  }
  const diagnostics: AgentSessionRuntimeDiagnostic[] = services.diagnostics || [];

  // Session options: use default tools (all built-in) + custom tools from extensions
  const sessionOptions: CreateAgentSessionFromServicesOptions = {
    services,
    sessionManager,
    sessionStartEvent,
    // tools: undefined - include all built-in tools
    // customTools: undefined - include all tools from bound extensions
  };

  // Create session với explicit typing
  let result: CreateAgentSessionResult;
  try {
    result = await createAgentSessionFromServices(sessionOptions);
  } catch (err) {
    console.error('❌ Failed to create agent session:', err);
    throw err;
  }
  if (!result?.session) {
    throw new Error('createAgentSessionFromServices returned invalid result (missing session)');
  }

  // Debug: Log loaded tools
  const extList = result.extensionsResult?.extensions || [];
  console.log('📦 Extensions loaded:', extList.length);
  for (const ext of extList) {
    // Use type assertion to access properties
    const extAny = ext as any;
    console.log(`  - ${extAny.name || 'unknown'}: ${extAny.tools?.size || 0} tools, ${extAny.commands?.size || 0} commands`);
  }
  const toolNames = result.session.agent.state.tools.map(t => t.name);
  console.log('🔧 Total tools in session:', toolNames.length);
  console.log('📋 Tool names:', toolNames.sort());

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
  try {
    const runtime = await initializeRuntime();
    await runInteractiveMode(runtime);
  } catch (err) {
    console.error('❌ Fatal error in main():', err);
    throw err;
  }
}

// ====== HELPER FUNCTIONS ======

async function initializeRuntime(): Promise<AgentSessionRuntime> {
  // ====== RUNTIME SETUP ======
  const sessionManager: SessionManager = SessionManager.create(process.cwd());
  const runtime: AgentSessionRuntime = await createAgentSessionRuntime(createRuntime, {
    cwd: process.cwd(),
    agentDir: getAgentDir(),
    sessionManager,
  });
  setCurrentRuntime(runtime);
  return runtime;
}

async function runInteractiveMode(runtime: AgentSessionRuntime): Promise<void> {
  const modeOptions: InteractiveModeOptions = {};
  const mode = new InteractiveMode(runtime, modeOptions);
  try {
    await mode.run();
  } catch (err) {
    console.error('❌ InteractiveMode crashed:', err);
    throw err;
  }
}

// NOTE: main() is called by dist/cli.js, not here.
