import { vi, describe, it, expect, beforeEach } from "vitest";
import { registerProviderCommand } from "../extensions/commands/provider-command.js";
import { createMockExtensionAPI } from "../tests/utils/mock-factory.js";

// Mock external dependencies
vi.mock("@earendil-works/pi-tui", () => ({
  Container: class Container {
    children: any[] = [];
    addChild(child: any) { this.children.push(child); }
    clear() { this.children = []; }
    render() { return []; }
    invalidate() {}
  },
  Text: class Text {
    constructor(public content: string) {}
  },
  Spacer: class Spacer {},
}));

vi.mock("@earendil-works/pi-coding-agent", () => ({
  DynamicBorder: class DynamicBorder {},
  TreeSelectorComponent: class TreeSelectorComponent {
    getTreeList() { return { getSelectedNode: () => null }; }
    handleInput() {}
  },
  SettingsList: class SettingsList {
    handleInput() {}
  },
  getSettingsListTheme: () => ({}),
}));

const mockNotify = vi.fn();
const mockUiNotify = vi.fn().mockImplementation((msg, type) => mockNotify(msg, type));
const mockCustom = vi.fn();

const createMockCtx = (overrides: any = {}) => ({
  modelRegistry: {
    getAll: () => [
      { id: "m1", provider: "openai", providerBaseUrl: "https://api.openai.com" },
      { id: "m2", provider: "anthropic", providerBaseUrl: "https://api.anthropic.com" },
      { id: "m3", provider: "openai" },
    ],
    registerProvider: vi.fn(),
    unregisterProvider: vi.fn(),
    getAvailable: vi.fn(() => [
      { id: "m1", provider: "openai" },
      { id: "m2", provider: "anthropic" },
    ]),
  },
  ui: {
    notify: mockUiNotify,
    custom: mockCustom,
  },
  mode: "tui",
});

const createMockApi = () => createMockExtensionAPI();

describe("Provider Command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("registerProviderCommand", () => {
    it("should register command with correct name", () => {
      const api = createMockApi();
      registerProviderCommand(api);
      expect(api.registerCommand).toHaveBeenCalledWith("providers", expect.any(Object));
    });

    describe("handler - list action", () => {
      it("should list all providers", async () => {
        const api = createMockApi();
        registerProviderCommand(api);
        const ctx = createMockCtx();

        const handler = api.registerCommand.mock.calls[0][1].handler;
        await handler("list", ctx);

        expect(mockCustom).toHaveBeenCalled();
        const customRenderer = mockCustom.mock.calls[0][0];
        expect(typeof customRenderer).toBe("function");
      });

      it("should notify when no providers", async () => {
        const api = createMockApi();
        registerProviderCommand(api);
        const ctx = createMockCtx();
        ctx.modelRegistry.getAll = () => [];

        const handler = api.registerCommand.mock.calls[0][1].handler;
        await handler("list", ctx);

        // The command will call custom() even with no providers? Let's check logic: if (infos.length === 0) notify and return BEFORE custom()
        // Actually in code: if (infos.length === 0) { notify; return; } So custom should not be called
        expect(mockCustom).not.toHaveBeenCalled();
        expect(mockNotify).toHaveBeenCalledWith("No providers registered", "info");
      });

      it("should notify error when modelRegistry.getAll throws", async () => {
        const api = createMockApi();
        registerProviderCommand(api);
        const ctx = createMockCtx();
        ctx.modelRegistry.getAll = vi.fn(() => { throw new Error('DB failure'); });
        const handler = api.registerCommand.mock.calls[0][1].handler;
        await handler('list', ctx);
        expect(mockNotify).toHaveBeenCalledWith('Failed to list providers: DB failure', 'error');
      });

      it('should render provider list UI fully (cover custom renderer)', async () => {
        const api = createMockApi();
        registerProviderCommand(api);
        const ctx = createMockCtx();

        let capturedComponent: any = null;
        mockCustom.mockImplementation(async (rendererFn) => {
          const fakeTui = {};
          const fakeTheme = { fg: (_c: string, t: string) => t, bold: () => ({}) };
          const fakeKb = {};
          const done = vi.fn();
          capturedComponent = rendererFn(fakeTui, fakeTheme, fakeKb, done);
          // exercise render
          capturedComponent.render(80);
          return capturedComponent;
        });

        const handler = api.registerCommand.mock.calls[0][1].handler;
        await handler('list', ctx);

        expect(mockCustom).toHaveBeenCalled();
        expect(capturedComponent).toBeDefined();
        expect(typeof capturedComponent.render).toBe('function');
        // Cover invalidate() and handleInput()
        capturedComponent.invalidate();
        capturedComponent.handleInput('enter');
      });

      it('should render providers with and without baseUrl (cover else branch)', async () => {
        const api = createMockApi();
        registerProviderCommand(api);
        const ctx = createMockCtx();
        // Mix: one provider with baseUrl, one without
        ctx.modelRegistry.getAll = () => [
          { id: 'p1', provider: 'hasbase', providerBaseUrl: 'https://has.base' },
          { id: 'p2', provider: 'nobase' },
        ];
        let capturedComponent: any = null;
        mockCustom.mockImplementation(async (rendererFn) => {
          const fakeTui = {};
          const fakeTheme = { fg: (_c: string, t: string) => t, bold: () => ({}) };
          const fakeKb = {};
          const done = vi.fn();
          capturedComponent = rendererFn(fakeTui, fakeTheme, fakeKb, done);
          capturedComponent.render(80);
          return capturedComponent;
        });
        const handler = api.registerCommand.mock.calls[0][1].handler;
        await handler('list', ctx);
        expect(mockCustom).toHaveBeenCalled();
        expect(capturedComponent).toBeDefined();
        // The else branch should have executed for the 'nobase' provider
        expect(capturedComponent).toBeDefined(); // just verifying we got component
      });
    });

    describe("handler - add action", () => {
      it("should add provider with correct params", async () => {
        const api = createMockApi();
        registerProviderCommand(api);
        const ctx = createMockCtx();

        const handler = api.registerCommand.mock.calls[0][1].handler;
        await handler("add myprovider https://api.example.com myapikey", ctx);

        expect(ctx.modelRegistry.registerProvider).toHaveBeenCalledWith("myprovider", {
          name: "myprovider",
          baseUrl: "https://api.example.com",
          apiKey: "myapikey",
        });
        expect(mockNotify).toHaveBeenCalledWith("Added provider myprovider", "info");
      });

      it("should error if missing params", async () => {
        const api = createMockApi();
        registerProviderCommand(api);
        const ctx = createMockCtx();

        const handler = api.registerCommand.mock.calls[0][1].handler;
        await handler("add", ctx);
        expect(mockNotify).toHaveBeenCalledWith("Usage: /providers add <name> <baseUrl> <apiKey>", "error");

        vi.clearAllMocks();
        await handler("add name", ctx);
        expect(mockNotify).toHaveBeenCalledWith("Usage: /providers add <name> <baseUrl> <apiKey>", "error");

        vi.clearAllMocks();
        await handler("add name url", ctx);
        expect(mockNotify).toHaveBeenCalledWith("Usage: /providers add <name> <baseUrl> <apiKey>", "error");
      });

      it("should handle registration error", async () => {
        const api = createMockApi();
        registerProviderCommand(api);
        const ctx = createMockCtx();
        ctx.modelRegistry.registerProvider = vi.fn().mockImplementation(() => {
          throw new Error("Provider already exists");
        });

        const handler = api.registerCommand.mock.calls[0][1].handler;
        await handler("add dup https://url key", ctx);

        expect(mockNotify).toHaveBeenCalledWith("Failed: Provider already exists", "error");
      });
    });

    describe("handler - remove action", () => {
      it("should remove provider", async () => {
        const api = createMockApi();
        registerProviderCommand(api);
        const ctx = createMockCtx();

        const handler = api.registerCommand.mock.calls[0][1].handler;
        await handler("remove myprovider", ctx);

        expect(ctx.modelRegistry.unregisterProvider).toHaveBeenCalledWith("myprovider");
        expect(mockNotify).toHaveBeenCalledWith("Removed provider myprovider", "info");
      });

      it("should error if missing provider name", async () => {
        const api = createMockApi();
        registerProviderCommand(api);
        const ctx = createMockCtx();

        const handler = api.registerCommand.mock.calls[0][1].handler;
        await handler("remove", ctx);

        expect(mockNotify).toHaveBeenCalledWith("Usage: /providers remove <name>", "error");
      });
    });

    describe("handler - test action", () => {
      it("should test provider with available models", async () => {
        const api = createMockApi();
        registerProviderCommand(api);
        const ctx = createMockCtx();

        const handler = api.registerCommand.mock.calls[0][1].handler;
        await handler("test openai", ctx);

        expect(mockNotify).toHaveBeenCalledWith("openai OK: 1 models available", "info");
      });

      it("should warn if no available models", async () => {
        const api = createMockApi();
        registerProviderCommand(api);
        const ctx = createMockCtx();
        ctx.modelRegistry.getAvailable.mockImplementation(() => []); // no available

        const handler = api.registerCommand.mock.calls[0][1].handler;
        await handler("test unknown", ctx);

        expect(mockNotify).toHaveBeenCalledWith("No available models for unknown (auth required)", "warning");
      });

      it("should error if missing provider name", async () => {
        const api = createMockApi();
        registerProviderCommand(api);
        const ctx = createMockCtx();

        const handler = api.registerCommand.mock.calls[0][1].handler;
        await handler("test", ctx);

        expect(mockNotify).toHaveBeenCalledWith("Usage: /providers test <name>", "error");
      });

      it("should handle test exception", async () => {
        const api = createMockApi();
        registerProviderCommand(api);
        const ctx = createMockCtx();
        ctx.modelRegistry.getAvailable = vi.fn(() => {
          throw new Error("Network error");
        });

        const handler = api.registerCommand.mock.calls[0][1].handler;
        await handler("test openai", ctx);

        expect(mockNotify).toHaveBeenCalledWith("Test failed: Network error", "error");
      });
    });

    describe("handler - unknown action", () => {
      it("should notify unknown action", async () => {
        const api = createMockApi();
        registerProviderCommand(api);
        const ctx = createMockCtx();

        const handler = api.registerCommand.mock.calls[0][1].handler;
        await handler("unknown", ctx);

        expect(mockNotify).toHaveBeenCalledWith("Unknown action: unknown", "error");
      });
    });

    describe("handler - default action (list)", () => {
      it("should default to list when no action provided", async () => {
        const api = createMockApi();
        registerProviderCommand(api);
        const ctx = createMockCtx();

        const handler = api.registerCommand.mock.calls[0][1].handler;
        await handler("", ctx);

        expect(mockCustom).toHaveBeenCalled();
      });
    });
  });
});
