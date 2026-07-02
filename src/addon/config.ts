/**
 * Agent Configuration & Setup
 * Contains all initialization logic extracted from main.ts
 */

import {
  createAgentSessionServices,
  createAgentSessionFromServices,
  createAgentSessionRuntime,
  getAgentDir,
  SessionManager,
  InteractiveMode,
} from '@earendil-works/pi-coding-agent';
import type {
  CreateAgentSessionRuntimeFactory,
  CreateAgentSessionServicesOptions,
  CreateAgentSessionFromServicesOptions,
  CreateAgentSessionResult,
  AgentSessionRuntimeDiagnostic,
} from '@earendil-works/pi-coding-agent';

import { defaultAssistantPrompt } from './prompts/index.js';

import { setCurrentRuntime } from './runtime-context.js';
import { registerAllAddon } from './index.js';
import { registerAllPlugin } from '../plugin/index.js';

/**
 * Tạo runtime factory sử dụng addon đã đăng ký
 */
export function createRuntimeFactory(): CreateAgentSessionRuntimeFactory {
  return async (options) => {
    const { cwd, agentDir, sessionManager, sessionStartEvent } = options;
    const { tools, extensions: addonExtensions } = registerAllAddon(cwd);
    const { extensions: pluginExtensions } = registerAllPlugin();

    const servicesOptions: CreateAgentSessionServicesOptions = {
      cwd,
      agentDir,
      resourceLoaderOptions: {
        promptsOverride: () => ({ prompts: [defaultAssistantPrompt], diagnostics: [] }),
        extensionFactories: [...addonExtensions, ...pluginExtensions],
      },
    };

    const services = await createAgentSessionServices(servicesOptions);


    const sessionOptions: CreateAgentSessionFromServicesOptions = {
      services,
      sessionManager,
      sessionStartEvent,
      customTools: tools,
    };

    const result: CreateAgentSessionResult = await createAgentSessionFromServices(sessionOptions);

    if (!result?.session) {
      throw new Error('createAgentSessionFromServices returned invalid result (missing session)');
    }

    const diagnostics: AgentSessionRuntimeDiagnostic[] = services.diagnostics || [];

    return {
      session: result.session,
      services,
      extensionsResult: result.extensionsResult,
      diagnostics,
      modelFallbackMessage: result.modelFallbackMessage,
    };
  };
}

/**
 * Khởi động agent với cwd tùy chọn
 */
export async function startAgent(cwd: string = process.cwd()): Promise<void> {
  const createRuntime = createRuntimeFactory();

  const sessionManager = SessionManager.create(process.cwd());
  const runtime = await createAgentSessionRuntime(createRuntime, {
    cwd,
    agentDir: getAgentDir(),
    sessionManager,
  });

  setCurrentRuntime(runtime);
  await new InteractiveMode(runtime, {}).run();
}
