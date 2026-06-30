/**
 * Add-on Runner - Khởi động agent với tất cả add-ons đã đăngng ký
 * Main file chỉ cần import và gọi hàm này.
 */

import {
  createAgentSessionRuntime,
  createAgentSessionServices,
  createAgentSessionFromServices,
  getAgentDir,
  InteractiveMode,
  SessionManager,
} from '@earendil-works/pi-coding-agent';
import type {
  CreateAgentSessionRuntimeFactory,
  CreateAgentSessionServicesOptions,
  CreateAgentSessionFromServicesOptions,
  CreateAgentSessionResult,
  AgentSessionRuntimeDiagnostic,
} from '@earendil-works/pi-coding-agent';

import { defaultAssistantPrompt } from './prompts/index.js';
import { configureSettings } from './settings-config.js';
import { setCurrentRuntime } from './runtime-context.js';
import { registerAllAddon } from './index.js';

/**
 * Tạo runtime factory sử dụng addon đã đăngng ký
 */
export function createAddonRuntimeFactory(): CreateAgentSessionRuntimeFactory {
  return async (options) => {
    const { cwd, agentDir, sessionManager, sessionStartEvent } = options;
    const { extensions, tools } = registerAllAddon(cwd);

    const servicesOptions: CreateAgentSessionServicesOptions = {
      cwd,
      agentDir,
      resourceLoaderOptions: {
        promptsOverride: () => ({ prompts: [defaultAssistantPrompt], diagnostics: [] }),
        extensionFactories: extensions,
      },
    };

    const services = await createAgentSessionServices(servicesOptions);
    configureSettings(services.settingsManager);

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
 * Khởi động agent với add-ons (chỉ 1 function call từ main.ts)
 * @param cwd - Working directory (default: process.cwd())
 */
export async function runAddon(cwd: string = process.cwd()): Promise<void> {
  const createRuntime = createAddonRuntimeFactory();

  const sessionManager = SessionManager.create(process.cwd());
  const runtime = await createAgentSessionRuntime(createRuntime, {
    cwd,
    agentDir: getAgentDir(),
    sessionManager,
  });

  setCurrentRuntime(runtime);
  await new InteractiveMode(runtime, {}).run();
}
