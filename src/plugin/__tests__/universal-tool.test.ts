import { vi, describe, it, expect } from "vitest";
import { registerUniversalTool } from "../extensions/tools/universal-tool.js";
import { createMockExtensionAPI } from "../tests/utils/mock-factory.js";

vi.mock("@earendil-works/pi-tui", () => ({
  Text: class Text { constructor(public content: string) {} },
}));

const createMockApi = () => createMockExtensionAPI();

describe("Universal Tool", () => {
  it("should register tool with correct name", () => {
    const api = createMockApi();
    registerUniversalTool(api);
    expect(api.registerTool).toHaveBeenCalledWith(expect.objectContaining({
      name: "plugin.universal",
      label: "Universal Tool",
    }));
  });

  it("should have description mentioning actions", () => {
    const api = createMockApi();
    registerUniversalTool(api);
    const tool = api.registerTool.mock.calls[0][0];
    expect(tool.description).toContain("echo");
    expect(tool.description).toContain("calc");
  });

  it("should have parameters with action enum", () => {
    const api = createMockApi();
    registerUniversalTool(api);
    const tool = api.registerTool.mock.calls[0][0];
    const params = tool.parameters; // tool is any from mock, params implicitly any
    expect(params.properties.action.enum).toContain("echo");
    expect(params.properties.action.enum).toContain("calc");
    expect(params.required).toContain("action");
  });

  it("should define execute function", () => {
    const api = createMockApi();
    registerUniversalTool(api);
    const tool = api.registerTool.mock.calls[0][0];
    expect(typeof tool.execute).toBe("function");
  });

  it("should define renderResult function", () => {
    const api = createMockApi();
    registerUniversalTool(api);
    const tool = api.registerTool.mock.calls[0][0];
    expect(typeof tool.renderResult).toBe("function");
  });
});
