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
  createAgentSessionRuntime,
  createAgentSessionServices,
  createAgentSessionFromServices,
  getAgentDir,
  InteractiveMode,
  SessionManager,
  type InteractiveModeOptions,
} from '@earendil-works/pi-coding-agent';

import { setCurrentRuntime } from './runtime-context.js';
import { defaultAssistantPrompt } from './prompts/index.js';
// Import custom tools from src/tools/
import { registerAllBuiltinTools, registerAllCustomTools } from './tools/index.js';
// Import extensions aggregator to manually load extensions
import extensionsAggregator from './extensions/index.js';

// Factory tạo runtime với tất cả factories
const createRuntime: CreateAgentSessionRuntimeFactory = async ({
  cwd,
  agentDir,
  sessionManager,
  sessionStartEvent,
}): Promise<CreateAgentSessionRuntimeResult> => {
  // Services với extensionFactories và PromptTemplate override
  const servicesOptions: CreateAgentSessionServicesOptions = {
    cwd,
    agentDir,
    resourceLoaderOptions: {
      promptsOverride: () => ({
        prompts: [defaultAssistantPrompt],
        diagnostics: [],
      }),
      extensionFactories: [extensionsAggregator],
    },
  };

  let services: AgentSessionServices;
  try {
    services = await createAgentSessionServices(servicesOptions);
  } catch (err) {
    console.error('❌ Failed to create agent session services:', err);
    throw err;
  }

  // Extensions are automatically loaded by the resourceLoader via extensionFactories

  const diagnostics: AgentSessionRuntimeDiagnostic[] = services.diagnostics || [];

  // Get ALL tool definitions (built-in + custom)
  const builtinToolDefs = registerAllBuiltinTools(cwd);
  const customToolDefs = registerAllCustomTools();
  const allTools = [...builtinToolDefs, ...customToolDefs];

  console.log('🛠️ Built-in tools:', builtinToolDefs.map(t => t.name));
  console.log('🛠️ Custom tools:', customToolDefs.map(t => t.name));
  console.log('🛠️ Total tools to register:', allTools.length);

  // Session options: pass all tools via customTools (no built-in tools parameter)
  const sessionOptions: CreateAgentSessionFromServicesOptions = {
    services,
    sessionManager,
    sessionStartEvent,
    customTools: allTools,
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
