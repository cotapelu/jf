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
import extensionsAggregator from './extensions/index.js';
import { join } from 'node:path';
import type { ToolDefinition } from '@earendil-works/pi-coding-agent';

/**
 * Load extensions from src/extensions and return collected tools & commands.
 * Does NOT bind to session; just collects definitions.
 */
async function loadExtensionsForRuntime(cwd: string, services: AgentSessionServices): Promise<{ extensionTools: ToolDefinition[]; extensionCommands: Map<string, any> }> {
  const extensionTools: ToolDefinition[] = [];
  const extensionCommands = new Map<string, any>();

  const api: any = {
    registerTool: (tool: ToolDefinition) => { extensionTools.push(tool); },
    registerCommand: (name: string, def: any) => { extensionCommands.set(name, def); },
    registerProvider: (name: string, config: any) => { (services as any).registerProvider?.(name, config) || console.log(`[API] registerProvider ${name} (no-op)`); },
    registerFlag: (name: string, def: any) => { (services as any).registerFlag?.(name, def) || console.log(`[API] registerFlag ${name} (no-op)`); },
    registerKeybinding: (name: string, def: any) => { (services as any).registerKeybinding?.(name, def) || console.log(`[API] registerKeybinding ${name} (no-op)`); },
    registerMessageRenderer: (name: string, fn: any) => { (services as any).registerMessageRenderer?.(name, fn) || console.log(`[API] registerMessageRenderer ${name} (no-op)`); },
    on: () => {}, // no-op during load
    sendMessage: async () => {},
    getFlag: (name: string) => (services as any).getFlag(name),
    exec: (cmd: string, args: string[], opts?: any) => (services as any).exec(cmd, args, opts),
    ui: null,
    notify: (msg: string, type?: string) => console[type === 'error' ? 'error' : 'log']('[Notify]', msg),
    pluginLoader: undefined,
  };

  try {
    await extensionsAggregator(api);
    console.log(`[loadExtensionsForRuntime] Collected ${extensionTools.length} tools, ${extensionCommands.size} commands`);
  } catch (err) {
    console.error('[loadExtensionsForRuntime] failed:', err);
  }

  return { extensionTools, extensionCommands };
}
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

  // Load built-in custom tools only (extensions handled in main())
  const baseCustomTools = registerAllCustomTools();
  const allCustomTools = baseCustomTools;

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
    // Commands are handled by bindExtensions after session creation
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

  // Load and bind extensions from src/extensions using extensionsAggregator
  {
    const extensionTools: ToolDefinition[] = [];
    const extensionCommands = new Map<string, any>();
    const currentSession = runtime.session; // current AgentSession

    // Build full ExtensionAPI from runtime (cast to any for missing methods in types)
    const api: any = {
      registerTool: (tool: ToolDefinition) => { extensionTools.push(tool); },
      registerCommand: (name: string, def: any) => { extensionCommands.set(name, def); },
      registerProvider: (name: string, config: any) => { (runtime.services as any).registerProvider?.(name, config) || console.log(`[API] registerProvider ${name} (no-op)`); },
      registerFlag: (name: string, def: any) => { (runtime.services as any).registerFlag?.(name, def) || console.log(`[API] registerFlag ${name} (no-op)`); },
      registerKeybinding: (name: string, def: any) => { (runtime.services as any).registerKeybinding?.(name, def) || console.log(`[API] registerKeybinding ${name} (no-op)`); },
      registerMessageRenderer: (name: string, fn: any) => { (runtime as any).registerMessageRenderer?.(name, fn) || console.log(`[API] registerMessageRenderer ${name} (no-op)`); },
      on: (event: string, handler: any) => { (currentSession as any).on?.(event, handler) || (sessionManager as any).on?.(event, handler) || console.log(`[API] on ${event} (no-op)`); },
      sendMessage: (msg: any, opts?: any) => { (currentSession as any).sendMessage?.(msg, opts) || (sessionManager as any).sendMessage?.(msg, opts) || console.log('[API] sendMessage (no-op)'); },
      getFlag: (name: string) => (runtime.services as any).getFlag(name),
      exec: (cmd: string, args: string[], opts?: any) => (runtime.services as any).exec(cmd, args, opts),
      ui: (runtime as any).ui || null,
      notify: (msg: string, type?: string) => console[type === 'error' ? 'error' : 'log']('[Notify]', msg),
      pluginLoader: undefined,
    };

    try {
      await extensionsAggregator(api);
      console.log(`[Debug] Aggregator loaded ${extensionTools.length} tools, ${extensionCommands.size} commands`);

      // Bind tools and commands to the session using proper Extension structure
      if (extensionTools.length > 0 || extensionCommands.size > 0) {
        // Extension object needs Maps for tools and commands (not just getters)
        const toolsMap = new Map<string, any>();
        for (const tool of extensionTools) {
          toolsMap.set(tool.name, { definition: tool, sourceInfo: { path: '<jf>', source: 'local', scope: 'project', origin: 'top-level' } });
        }
        const commandsMap = new Map<string, any>();
        for (const [name, def] of extensionCommands) {
          commandsMap.set(name, { name, ...def, sourceInfo: { path: '<jf>', source: 'local', scope: 'project', origin: 'top-level' } });
        }

        const extObj = {
          name: 'jf-extensions',
          version: '1.0.0',
          description: 'Extensions from src/extensions',
          tools: toolsMap,
          commands: commandsMap,
          handlers: new Map(),
          flags: new Map(),
          shortcuts: new Map(),
          messageRenderers: new Map()
        };
        await (runtime.session as any).bindExtensions({ extensions: [extObj] });
        console.log(`✅ Bound ${extensionTools.length} tools and ${extensionCommands.size} commands`);
        console.log('[Debug] Commands:', Array.from(extensionCommands.keys()));
        // Refresh commands in runtime if needed
        try {
          const sess = runtime.session as any;
          if (sess.refreshCommands) sess.refreshCommands();
          if (sess.runtime?.refreshCommands) sess.runtime.refreshCommands();
        } catch (e) {
          // ignore
        }
      } else {
        console.log('ℹ️ No extensions (tools/commands) collected');
      }
    } catch (err) {
      console.error('❌ Failed to load extensions:', err);
    }
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
