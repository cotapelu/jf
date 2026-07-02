import { vi, describe, it, expect, beforeEach } from "vitest";
import { registerTodosRenderer } from "../extensions/renderers/todos-renderer.js";
import { Text } from "@earendil-works/pi-tui";

type RendererFn = (message: { details?: unknown }, options: unknown, theme: unknown) => Text;

vi.mock("@earendil-works/pi-tui", () => ({
  Text: class Text {
    constructor(public content: string) {}
  },
}));

describe("Todos Renderer", () => {
  let mockApi: any;

  beforeEach(() => {
    mockApi = {
      registerMessageRenderer: vi.fn(),
    };
  });

  describe("registerTodosRenderer", () => {
    it("should register renderer for 'todos_result' type", () => {
      registerTodosRenderer(mockApi);
      expect(mockApi.registerMessageRenderer).toHaveBeenCalledWith(
        "todos_result",
        expect.any(Function)
      );
    });

    it("should return default text when details missing", () => {
      registerTodosRenderer(mockApi);

      const mockTheme = { fg: (c: string, t: string) => t };
      const renderer = mockApi.registerMessageRenderer.mock.calls[0][1] as RendererFn;
      const result: any = renderer({}, {}, mockTheme);

      expect(result).toBeInstanceOf(Text);
      expect(result.content).toBe("📋 Todo operation completed");
    });

    it("should render progress bar correctly", () => {
      registerTodosRenderer(mockApi);

      const mockTheme = { fg: (c: string, t: string) => t };
      const details = {
        totalTasks: 10,
        completedTasks: 5,
        phases: [],
      };

      const renderer = mockApi.registerMessageRenderer.mock.calls[0][1] as RendererFn;
      const result: any = renderer({ details }, {}, mockTheme);

      const content = result.content;
      expect(content).toContain("Progress: 5/10 (50%)");
      expect(content).toContain("█".repeat(10)); // half filled bar (50% of 20)
    });

    it("should render phases and tasks with status icons", () => {
      registerTodosRenderer(mockApi);

      const mockTheme = { fg: (c: string, t: string) => t };
      const details = {
        phases: [
          {
            name: "Phase 1",
            tasks: [
              { id: "t1", content: "Task 1", status: "pending" },
              { id: "t2", content: "Task 2", status: "in_progress" },
              { id: "t3", content: "Task 3", status: "completed" },
              { id: "t4", content: "Task 4", status: "abandoned" },
            ],
          },
        ],
      };

      const renderer = mockApi.registerMessageRenderer.mock.calls[0][1] as RendererFn;
      const result: any = renderer({ details }, {}, mockTheme);

      const content = result.content;
      expect(content).toContain("Phase 1");
      expect(content).toContain("⏳ Task 1");
      expect(content).toContain("🔄 Task 2");
      expect(content).toContain("✅ Task 3");
      expect(content).toContain("❌ Task 4");
      expect(content).toContain("ID: t1");
    });

    it("should handle empty phases", () => {
      registerTodosRenderer(mockApi);

      const mockTheme = { fg: (c: string, t: string) => t };
      const details = {
        totalTasks: 0,
        completedTasks: 0,
        phases: [],
      };

      const renderer = mockApi.registerMessageRenderer.mock.calls[0][1] as RendererFn;
      const result: any = renderer({ details }, {}, mockTheme);

      const content = result.content;
      expect(content).toContain("Progress: 0/0 (0%)");
    });

    it("should render message when present", () => {
      registerTodosRenderer(mockApi);

      const mockTheme = { fg: (c: string, t: string) => t };
      const details = {
        message: "Todo list retrieved",
        phases: [],
      };

      const renderer = mockApi.registerMessageRenderer.mock.calls[0][1] as RendererFn;
      const result: any = renderer({ details }, {}, mockTheme);

      const content = result.content;
      expect(content).toContain("Todo list retrieved");
    });

    it("should handle division by zero in progress", () => {
      registerTodosRenderer(mockApi);

      const mockTheme = { fg: (c: string, t: string) => t };
      const details = {
        totalTasks: 0,
        completedTasks: 0,
        phases: [],
      };

      const renderer = mockApi.registerMessageRenderer.mock.calls[0][1] as RendererFn;
      const result: any = renderer({ details }, {}, mockTheme);

      const content = result.content;
      expect(content).toContain("0%");
    });
  });
});
