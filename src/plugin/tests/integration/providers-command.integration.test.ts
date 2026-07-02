import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerProviderCommand } from "../../extensions/commands/provider-command.js";

// Minimal mocks for provider integration test
function createMockModelRegistry() {
  const providers = new Map<string, { name: string; baseUrl: string; apiKey: string }>();
  return {
    getAll: vi.fn(() => Array.from(providers.values())),
    getAvailable: vi.fn(() => []),
    registerProvider: vi.fn((name: string, config: any) => {
      providers.set(name, config);
      return { providerId: name, ...config };
    }),
    unregisterProvider: vi.fn((name: string) => {
      providers.delete(name);
    }),
  };
}

describe("Provider Command Integration", () => {
  let mockApi: any;
  let mockModelRegistry: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockModelRegistry = createMockModelRegistry();
    mockApi = {
      on: vi.fn(),
      registerCommand: vi.fn(),
      modelRegistry: mockModelRegistry,
    };
  });

  it("registers the /providers command", () => {
    registerProviderCommand(mockApi);
    expect(mockApi.registerCommand).toHaveBeenCalledWith(
      "providers",
      expect.objectContaining({
        description: expect.stringContaining("Manage LLM providers"),
        handler: expect.any(Function),
      })
    );
  });

  it("list providers: shows none when empty", async () => {
    registerProviderCommand(mockApi);
    const mockNotify = vi.fn();
    const handler = mockApi.registerCommand.mock.calls[0][1].handler;
    const ctx = {
      modelRegistry: mockModelRegistry,
      ui: { notify: mockNotify },
    };

    await handler("list", ctx);

    expect(mockNotify).toHaveBeenCalledWith("No providers registered", "info");
  });

  it("add provider: registers and notifies", async () => {
    registerProviderCommand(mockApi);
    const mockNotify = vi.fn();
    const handler = mockApi.registerCommand.mock.calls[0][1].handler;
    const ctx = {
      modelRegistry: mockModelRegistry,
      ui: { notify: mockNotify },
    };

    await handler("add openai https://api.openai.com sk-123", ctx);

    expect(mockModelRegistry.registerProvider).toHaveBeenCalledWith("openai", {
      name: "openai",
      baseUrl: "https://api.openai.com",
      apiKey: "sk-123",
    });
    expect(mockNotify).toHaveBeenCalledWith("Added provider openai", "info");
  });

  it("remove provider: unregisters and notifies", async () => {
    registerProviderCommand(mockApi);
    const mockNotify = vi.fn();
    const handler = mockApi.registerCommand.mock.calls[0][1].handler;
    const ctx = {
      modelRegistry: mockModelRegistry,
      ui: { notify: mockNotify },
    };

    await handler("remove openai", ctx);

    expect(mockModelRegistry.unregisterProvider).toHaveBeenCalledWith("openai");
    expect(mockNotify).toHaveBeenCalledWith("Removed provider openai", "info");
  });

  it("test provider: reports available models count", async () => {
    registerProviderCommand(mockApi);
    const mockNotify = vi.fn();
    const handler = mockApi.registerCommand.mock.calls[0][1].handler;
    const ctx = {
      modelRegistry: mockModelRegistry,
      ui: { notify: mockNotify },
    };

    // Simulate available models
    mockModelRegistry.getAvailable.mockReturnValue([
      { provider: "openai", modelId: "gpt-4" },
      { provider: "openai", modelId: "gpt-3.5-turbo" },
    ]);

    await handler("test openai", ctx);

    expect(mockNotify).toHaveBeenCalledWith("openai OK: 2 models available", "info");
  });

  it("unknown action shows error", async () => {
    registerProviderCommand(mockApi);
    const mockNotify = vi.fn();
    const handler = mockApi.registerCommand.mock.calls[0][1].handler;
    const ctx = {
      modelRegistry: mockModelRegistry,
      ui: { notify: mockNotify },
    };

    await handler("foo", ctx);

    expect(mockNotify).toHaveBeenCalledWith("Unknown action: foo", "error");
  });
});
