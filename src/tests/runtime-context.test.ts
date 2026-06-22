import { describe, it, expect, beforeEach, vi } from 'vitest';

// Import all functions we need to test
import {
  setCurrentRuntime,
  getCurrentRuntime,
  getCurrentSession,
  getCurrentServices,
  getCurrentCwd,
  getCurrentDiagnostics,
  getCurrentAgentDir,
  getCurrentModel,
  getCurrentModelApi,
  getCurrentExtensionRunner,
  getCurrentSessionManager,
  getCurrentSessionFile,
  getCurrentSessionId,
  getCurrentSessionName,
  getCurrentActiveToolNames,
  getCurrentToolInfoList,
  getCurrentToolDefinition,
  getCurrentMessages,
  getCurrentModelFallbackMessage,
  getCurrentAuthStorage,
  getCurrentSettingsManager,
  getCurrentModelRegistry,
  getCurrentResourceLoader,
  clearCurrentRuntime,
} from '../runtime-context.js';

import type {
  AgentSessionRuntime,
  AgentSession,
  AgentSessionServices,
  AgentSessionRuntimeDiagnostic,
  ToolDefinition,
  ExtensionRunner,
  SessionManager,
  ToolInfo,
} from '@earendil-works/pi-coding-agent';

// Helper to create a minimal mock runtime
function createMockRuntime(overrides: Partial<AgentSessionRuntime> = {}): AgentSessionRuntime {
  const now = new Date();
  const session: AgentSession = {
    sessionId: 'test-session-id',
    sessionFile: '/tmp/test-session.jsonl',
    sessionName: 'Test Session',
    messages: [],
    model: undefined,
    extensionRunner: {
      run: vi.fn().mockResolvedValue(undefined),
    } as unknown as ExtensionRunner,
    sessionManager: {
      // Minimal methods for runtime context tests; we can mock more as needed.
      dispose: vi.fn(),
      getActive: vi.fn(),
      list: vi.fn(),
      getRegistry: vi.fn(),
      getDiagnostics: vi.fn(),
    } as unknown as SessionManager,
    getActiveToolNames: vi.fn().mockReturnValue(['tool1', 'tool2']),
    getAllTools: vi.fn().mockReturnValue([
      { name: 'tool1', label: 'Tool 1', description: 'Desc' },
      { name: 'tool2', label: 'Tool 2', description: 'Desc2' },
    ] as ToolInfo[]),
    getToolDefinition: vi.fn().mockName('getToolDefinition'),
  };

  const services: AgentSessionServices = {
    cwd: '/tmp',
    agentDir: '/tmp/agent',
    authStorage: { get: vi.fn(), set: vi.fn(), delete: vi.fn() } as any,
    settingsManager: { get: vi.fn(), set: vi.fn() } as any,
    modelRegistry: { getCurrentModel: vi.fn(), listModels: vi.fn() } as any,
    resourceLoader: { loadSkill: vi.fn() } as any,
    diagnostics: [],
  };

  return {
    session,
    services,
    cwd: '/tmp',
    diagnostics: [],
    modelFallbackMessage: undefined,
    ...overrides,
  } as AgentSessionRuntime;
}

describe('runtime-context', () => {
  beforeEach(() => {
    clearCurrentRuntime();
  });

  describe('setCurrentRuntime / clearCurrentRuntime', () => {
    it('should set and retrieve runtime', () => {
      const runtime = createMockRuntime();
      setCurrentRuntime(runtime);
      expect(getCurrentRuntime()).toBe(runtime);
    });

    it('should clear runtime', () => {
      const runtime = createMockRuntime();
      setCurrentRuntime(runtime);
      clearCurrentRuntime();
      expect(() => getCurrentRuntime()).toThrow('Runtime not set');
    });
  });

  describe('getCurrentRuntime', () => {
    it('should throw if runtime not set', () => {
      expect(() => getCurrentRuntime()).toThrow('Runtime not set');
    });
  });

  describe('getCurrentSession', () => {
    it('should return session from runtime', () => {
      const runtime = createMockRuntime();
      setCurrentRuntime(runtime);
      expect(getCurrentSession()).toBe(runtime.session);
    });
  });

  describe('getCurrentServices', () => {
    it('should return services from runtime', () => {
      const runtime = createMockRuntime();
      setCurrentRuntime(runtime);
      expect(getCurrentServices()).toBe(runtime.services);
    });
  });

  describe('getCurrentCwd', () => {
    it('should return cwd from runtime', () => {
      const runtime = createMockRuntime({ cwd: '/custom/cwd' });
      setCurrentRuntime(runtime);
      expect(getCurrentCwd()).toBe('/custom/cwd');
    });
  });

  describe('getCurrentDiagnostics', () => {
    it('should return diagnostics array', () => {
      const diag: AgentSessionRuntimeDiagnostic[] = [{ type: 'info', message: 'test' }];
      const runtime = createMockRuntime({ diagnostics: diag });
      setCurrentRuntime(runtime);
      expect(getCurrentDiagnostics()).toBe(diag);
    });
  });

  describe('getCurrentAgentDir', () => {
    it('should return agentDir from services', () => {
      const runtime = createMockRuntime();
      setCurrentRuntime(runtime);
      expect(getCurrentAgentDir()).toBe(runtime.services.agentDir);
    });
  });

  describe('getCurrentModel', () => {
    it('should return current model from session', () => {
      const mockModel: any = { api: 'test' };
      const runtime = createMockRuntime({ session: { ...createMockRuntime().session, model: mockModel } });
      setCurrentRuntime(runtime);
      expect(getCurrentModel()).toBe(mockModel);
    });

    it('should return undefined if no model selected', () => {
      const runtime = createMockRuntime();
      setCurrentRuntime(runtime);
      expect(getCurrentModel()).toBeUndefined();
    });
  });

  describe('getCurrentModelApi', () => {
    it('should return model API when model is set', () => {
      const mockModel: any = { api: 'test-api' };
      const runtime = createMockRuntime({ session: { ...createMockRuntime().session, model: mockModel } });
      setCurrentRuntime(runtime);
      expect(getCurrentModelApi()).toBe('test-api');
    });

    it('should return undefined when no model', () => {
      const runtime = createMockRuntime();
      setCurrentRuntime(runtime);
      expect(getCurrentModelApi()).toBeUndefined();
    });
  });

  describe('getCurrentExtensionRunner', () => {
    it('should return extensionRunner from session', () => {
      const runner: ExtensionRunner = { run: vi.fn().mockResolvedValue(undefined) } as any;
      const runtime = createMockRuntime({ session: { ...createMockRuntime().session, extensionRunner: runner } });
      setCurrentRuntime(runtime);
      expect(getCurrentExtensionRunner()).toBe(runner);
    });
  });

  describe('getCurrentSessionManager', () => {
    it('should return sessionManager from session', () => {
      const manager: SessionManager = { dispose: vi.fn() } as any;
      const runtime = createMockRuntime({ session: { ...createMockRuntime().session, sessionManager: manager } });
      setCurrentRuntime(runtime);
      expect(getCurrentSessionManager()).toBe(manager);
    });
  });

  describe('getCurrentSessionFile', () => {
    it('should return sessionFile from session', () => {
      const runtime = createMockRuntime();
      setCurrentRuntime(runtime);
      expect(getCurrentSessionFile()).toBe(runtime.session.sessionFile);
    });
  });

  describe('getCurrentSessionId', () => {
    it('should return sessionId from session', () => {
      const runtime = createMockRuntime();
      setCurrentRuntime(runtime);
      expect(getCurrentSessionId()).toBe(runtime.session.sessionId);
    });
  });

  describe('getCurrentSessionName', () => {
    it('should return sessionName from session', () => {
      const runtime = createMockRuntime();
      setCurrentRuntime(runtime);
      expect(getCurrentSessionName()).toBe(runtime.session.sessionName);
    });
  });

  describe('getCurrentActiveToolNames', () => {
    it('should return active tool names from session', () => {
      const runtime = createMockRuntime();
      setCurrentRuntime(runtime);
      expect(getCurrentActiveToolNames()).toEqual(['tool1', 'tool2']);
    });
  });

  describe('getCurrentToolInfoList', () => {
    it('should return tool info list from session', () => {
      const runtime = createMockRuntime();
      setCurrentRuntime(runtime);
      const list = getCurrentToolInfoList();
      expect(list).toHaveLength(2);
      expect(list[0].name).toBe('tool1');
    });
  });

  describe('getCurrentToolDefinition', () => {
    it('should return tool definition if available', () => {
      const toolDef: ToolDefinition = { name: 'test', label: 'Test', description: 'Test tool', parameters: {}, execute: vi.fn() };
      const session = createMockRuntime().session;
      session.getToolDefinition = vi.fn().mockReturnValue(toolDef);
      setCurrentRuntime(createMockRuntime({ session }));
      expect(getCurrentToolDefinition('test')).toBe(toolDef);
    });

    it('should return undefined if tool not found', () => {
      const session = createMockRuntime().session;
      session.getToolDefinition = vi.fn().mockReturnValue(undefined);
      setCurrentRuntime(createMockRuntime({ session }));
      expect(getCurrentToolDefinition('missing')).toBeUndefined();
    });
  });

  describe('getCurrentMessages', () => {
    it('should return messages from session', () => {
      const messages = [{ role: 'user', content: 'hello' }];
      const runtime = createMockRuntime({ session: { ...createMockRuntime().session, messages } });
      setCurrentRuntime(runtime);
      expect(getCurrentMessages()).toBe(messages);
    });
  });

  describe('getCurrentModelFallbackMessage', () => {
    it('should return modelFallbackMessage if set', () => {
      const runtime = createMockRuntime({ modelFallbackMessage: 'Using fallback' });
      setCurrentRuntime(runtime);
      expect(getCurrentModelFallbackMessage()).toBe('Using fallback');
    });

    it('should return undefined if not set', () => {
      const runtime = createMockRuntime();
      setCurrentRuntime(runtime);
      expect(getCurrentModelFallbackMessage()).toBeUndefined();
    });
  });

  describe('getCurrentAuthStorage', () => {
    it('should return authStorage from services', () => {
      const runtime = createMockRuntime();
      setCurrentRuntime(runtime);
      expect(getCurrentAuthStorage()).toBe(runtime.services.authStorage);
    });
  });

  describe('getCurrentSettingsManager', () => {
    it('should return settingsManager from services', () => {
      const runtime = createMockRuntime();
      setCurrentRuntime(runtime);
      expect(getCurrentSettingsManager()).toBe(runtime.services.settingsManager);
    });
  });

  describe('getCurrentModelRegistry', () => {
    it('should return modelRegistry from services', () => {
      const runtime = createMockRuntime();
      setCurrentRuntime(runtime);
      expect(getCurrentModelRegistry()).toBe(runtime.services.modelRegistry);
    });
  });

  describe('getCurrentResourceLoader', () => {
    it('should return resourceLoader from services', () => {
      const runtime = createMockRuntime();
      setCurrentRuntime(runtime);
      expect(getCurrentResourceLoader()).toBe(runtime.services.resourceLoader);
    });
  });
});
