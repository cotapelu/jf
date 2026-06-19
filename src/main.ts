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

import { registerAllCustomTools } from './tools/index.js';
import { setCurrentRuntime } from './runtime-context.js';
import extensionsAggregator from './extensions/index.js';
import type { ToolDefinition } from '@earendil-works/pi-coding-agent';

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

  let services: AgentSessionServices;
  try {
    services = await createAgentSessionServices(servicesOptions);
  } catch (err) {
    console.error('❌ Failed to create agent session services:', err);
    throw err;
  }
  const diagnostics: AgentSessionRuntimeDiagnostic[] = services.diagnostics || [];

  // Load built-in custom tools only (extensions handled in main())
  const baseCustomTools = registerAllCustomTools();
  const allCustomTools = baseCustomTools;

  // Session options: built-in tools only (custom tools go in customTools)
  const builtinToolNames = [
    'read',
    'bash',
    'edit',
    'write',
    'grep',
    'find',
    'ls',
  ];
  const sessionOptions: CreateAgentSessionFromServicesOptions = {
    services,
    sessionManager,
    sessionStartEvent,
    tools: builtinToolNames,
    customTools: allCustomTools,
    // Commands are handled by bindExtensions after session creation
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
    await loadAndBindExtensions(runtime);
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

async function loadAndBindExtensions(runtime: AgentSessionRuntime): Promise<void> {
  const extensionTools: ToolDefinition[] = [];
  const extensionCommands = new Map<string, any>();
  const currentSession = runtime.session;

  const api: any = {
    registerTool: (tool: ToolDefinition) => { extensionTools.push(tool); },
    registerCommand: (name: string, def: any) => { extensionCommands.set(name, def); },
    registerProvider: (name: string, config: any) => { (runtime.services as any).registerProvider?.(name, config) || console.log(`[API] registerProvider ${name} (no-op)`); },
    registerFlag: (name: string, def: any) => { (runtime.services as any).registerFlag?.(name, def) || console.log(`[API] registerFlag ${name} (no-op)`); },
    registerKeybinding: (name: string, def: any) => { (runtime.services as any).registerKeybinding?.(name, def) || console.log(`[API] registerKeybinding ${name} (no-op)`); },
    registerMessageRenderer: (name: string, fn: any) => { (runtime as any).registerMessageRenderer?.(name, fn) || console.log(`[API] registerMessageRenderer ${name} (no-op)`); },
    on: (event: string, handler: any) => { (currentSession as any).on?.(event, handler) || console.log(`[API] on ${event} (no-op)`); },
    sendMessage: (msg: any, opts?: any) => { (currentSession as any).sendMessage?.(msg, opts) || console.log('[API] sendMessage (no-op)'); },
    getFlag: (name: string) => (runtime.services as any).getFlag(name),
    exec: (cmd: string, args: string[], opts?: any) => (runtime.services as any).exec(cmd, args, opts),
    ui: (runtime as any).ui || null,
    notify: (msg: string, type?: string) => console[type === 'error' ? 'error' : 'log']('[Notify]', msg),
    pluginLoader: undefined,
  };

  try {
    await extensionsAggregator(api);

    if (extensionTools.length > 0 || extensionCommands.size > 0) {
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
      try {
        await (runtime.session as any).bindExtensions({ extensions: [extObj] });
        console.log(`✅ Bound ${extensionTools.length} tools and ${extensionCommands.size} commands`);

        const sess = runtime.session as any;
        if (sess.refreshCommands) sess.refreshCommands();
        if (sess.runtime?.refreshCommands) sess.runtime.refreshCommands();
      } catch (err) {
        console.error('❌ Failed to bind or refresh extensions:', err);
      }
    } else {
      console.log('ℹ️ No extensions (tools/commands) collected');
    }
  } catch (err) {
    console.error('❌ Failed to load extensions:', err);
  }
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
