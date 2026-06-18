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
import { setCurrentRuntime } from './runtime-context.js';
import { discoverAndLoadExtensions } from '@earendil-works/pi-coding-agent';
import { join } from 'node:path';
import type { ToolDefinition } from '@earendil-works/pi-coding-agent';
// Extensions loaded via Pi SDK's discoverAndLoadExtensions from src/extensions

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

  // Load extensions from src/extensions (absolute path)
  const extensionsPath = join(cwd, 'src/extensions');
  const { extensions, errors } = await discoverAndLoadExtensions(
    [extensionsPath],
    cwd,
    agentDir
  );
  if (errors.length) {
    console.error('Extension discovery errors:', errors.map(e => `${e.path}: ${e.error}`).join('\n'));
  }

  // Extract tools from extensions (Pi SDK Extension objects have .tools map)
  const extensionTools: ToolDefinition[] = [];
  for (const ext of extensions) {
    for (const toolEntry of ext.tools.values()) {
      extensionTools.push(toolEntry.definition);
    }
  }

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
  // Debug: write to file
  try { require('fs').appendFileSync('/tmp/jf_debug.log', 'main started\n'); } catch {}


  // ====== RUNTIME SETUP ======
  const sessionManager: SessionManager = SessionManager.create(process.cwd());
  const runtime: AgentSessionRuntime = await createAgentSessionRuntime(createRuntime, {
    cwd: process.cwd(),
    agentDir: getAgentDir(),
    sessionManager,
  });

  setCurrentRuntime(runtime);

  // Load and bind extensions from src/extensions
  try {
    const { extensions, errors } = await discoverAndLoadExtensions(
      ['src/extensions'],
      process.cwd(),
      getAgentDir()
    );
    if (errors?.length) {
      console.error('Extension discovery errors:', errors.map(e => `${e.path}: ${e.error}`).join('\n'));
    }
    if (extensions?.length) {
      await (runtime.session as any).bindExtensions({ extensions });
      console.log(`✅ Bound ${extensions.length} extensions`);
    } else {
      console.log('ℹ️ No extensions found');
    }
  } catch (err) {
    console.error('❌ Failed to bind extensions:', err);
  }

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
