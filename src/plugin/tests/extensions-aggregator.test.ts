import { vi, describe, it, expect, beforeEach } from "vitest";

// Mock all dependencies (no external references to avoid hoisting issues)
vi.mock("../extensions/providers/kilo-provider", () => ({
  registerKiloProvider: vi.fn(),
}));
vi.mock("../extensions/tools/index.js", () => ({
  registerTodosTool: vi.fn(),
  registerMemoryTool: vi.fn(),
  registerUniversalTool: vi.fn(),
  registerEvoReloadTool: vi.fn(),
}));
// Tools moved to plugins: git, test, format, audit, build, metrics, secret-scanner, scripts
// No mocking needed
vi.mock("../extensions/team/index.js", () => ({ registerTeamTool: vi.fn() }));
vi.mock("../extensions/tools/subtool-loader.js", () => ({ registerSubToolLoaderExtension: vi.fn() }));
// tool-template removed (moved to master-tool)
vi.mock("../extensions/tools/skill-reader.js", () => ({ registerSkillReaderExtension: vi.fn() }));
vi.mock("../extensions/hooks/auto-continue.js", () => ({ default: vi.fn() }));
vi.mock("../extensions/hooks/auto-compact-85.js", () => ({ default: vi.fn() }));
vi.mock("../extensions/piclaw-header.js", () => ({ default: vi.fn() }));
vi.mock("../extensions/renderers/todos-renderer.js", () => ({ registerTodosRenderer: vi.fn() }));
vi.mock("../extensions/team/team-widget.js", () => ({ registerTeamWidget: vi.fn() }));
vi.mock("../extensions/renderers/memory-renderer.js", () => ({ registerMemoryRenderer: vi.fn() }));
vi.mock("../extensions/renderers/branch-summary-renderer.js", () => ({ registerBranchSummaryRenderer: vi.fn() }));
vi.mock("../extensions/renderers/team-ops-renderer.js", () => ({ registerTeamOpsRenderer: vi.fn() }));
vi.mock("../extensions/commands/session-tree-command.js", () => ({ registerSessionTreeCommand: vi.fn() }));
vi.mock("../extensions/commands/settings-command.js", () => ({ registerSettingsCommand: vi.fn() }));
vi.mock("../extensions/commands/provider-command.js", () => ({ registerProviderCommand: vi.fn() }));
vi.mock("../extensions/commands/copy-command.js", () => ({ registerCopyCommand: vi.fn() }));
vi.mock("../extensions/commands/team-command.js", () => ({ registerTeamCommand: vi.fn() }));
// Metrics command and widget removed (0fb3d3e)

// Now import the module under test and the mocked functions
import { extensionsAggregator, getExtensionFactories } from "../extensions/factory";
import { createMockExtensionAPI } from "./utils/mock-factory.js";
import { registerKiloProvider } from "../extensions/providers/kilo-provider";
import { registerTodosTool, registerMemoryTool, registerUniversalTool, registerEvoReloadTool } from "../extensions/tools/index";
// Tools moved to plugins, no direct imports
import { registerTeamTool } from "../extensions/team/index";
import { registerSubToolLoaderExtension } from "../extensions/tools/subtool-loader";
// tool-template removed (master-tool replaces it)
import { registerSkillReaderExtension } from "../extensions/tools/skill-reader";
import autoContinueExtension from "../extensions/hooks/auto-continue";
import autoCompact85Extension from "../extensions/hooks/auto-compact-85";
import piclawHeader from "../extensions/piclaw-header";
import { registerTodosRenderer } from "../extensions/renderers/todos-renderer";
import { registerTeamWidget } from "../extensions/team/team-widget";
import { registerMemoryRenderer } from "../extensions/renderers/memory-renderer";
import { registerBranchSummaryRenderer } from "../extensions/renderers/branch-summary-renderer";
import { registerTeamOpsRenderer } from "../extensions/renderers/team-ops-renderer";
import { registerSessionTreeCommand } from "../extensions/commands/session-tree-command";
import { registerSettingsCommand } from "../extensions/commands/settings-command";
import { registerProviderCommand } from "../extensions/commands/provider-command";
import { registerCopyCommand } from "../extensions/commands/copy-command";
import { registerTeamCommand } from "../extensions/commands/team-command";
// import { registerMetricsCommand } from "../extensions/commands/metrics-command"; // removed
// import { registerMetricsWidget } from "../extensions/metrics/metrics-widget"; // removed
//

describe("Extensions Aggregator", () => {
  const mockApi: any = createMockExtensionAPI({ registerFlag: vi.fn(), getFlag: vi.fn() });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers all extensions and hooks", async () => {
    await extensionsAggregator(mockApi);

    expect(registerKiloProvider).toHaveBeenCalledWith(mockApi);
    expect(registerTodosTool).toHaveBeenCalledWith(mockApi);
    expect(registerMemoryTool).toHaveBeenCalledWith(mockApi);
    expect(registerUniversalTool).toHaveBeenCalledWith(mockApi);
    expect(registerEvoReloadTool).toHaveBeenCalledWith(mockApi);
    // Plugin-based tools are loaded automatically, not directly registered
    expect(registerTeamTool).toHaveBeenCalledWith(mockApi);
    expect(registerSubToolLoaderExtension).toHaveBeenCalledWith(mockApi);
    // tool-template removed (replaced by master-tool)
    expect(registerSkillReaderExtension).toHaveBeenCalledWith(mockApi);
    expect(autoContinueExtension).toHaveBeenCalledWith(mockApi);
    expect(autoCompact85Extension).toHaveBeenCalledWith(mockApi);
    expect(piclawHeader).toHaveBeenCalledWith(mockApi);
    expect(registerTodosRenderer).toHaveBeenCalledWith(mockApi);
    expect(registerTeamWidget).toHaveBeenCalledWith(mockApi);
    expect(registerMemoryRenderer).toHaveBeenCalledWith(mockApi);
    expect(registerBranchSummaryRenderer).toHaveBeenCalledWith(mockApi);
    expect(registerTeamOpsRenderer).toHaveBeenCalledWith(mockApi);
    expect(registerSessionTreeCommand).toHaveBeenCalledWith(mockApi);
    expect(registerSettingsCommand).toHaveBeenCalledWith(mockApi);
    expect(registerProviderCommand).toHaveBeenCalledWith(mockApi);
    expect(registerCopyCommand).toHaveBeenCalledWith(mockApi);
    expect(registerTeamCommand).toHaveBeenCalledWith(mockApi);
    // Metrics widget and command removed
  });

  it("getExtensionFactories returns array containing aggregator", () => {
    const factories = getExtensionFactories();
    expect(Array.isArray(factories)).toBe(true);
    expect(factories).toContain(extensionsAggregator);
  });
});
