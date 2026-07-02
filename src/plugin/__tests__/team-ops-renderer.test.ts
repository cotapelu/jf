import { vi, describe, it, expect, beforeEach } from "vitest";
import { registerTeamOpsRenderer } from "../extensions/renderers/team-ops-renderer.js";
import { Text } from "@earendil-works/pi-tui";
import { createMockExtensionAPI } from "../tests/utils/mock-factory.js";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

type RendererFn = (message: { details?: unknown }, options: unknown, theme: unknown) => Text;

vi.mock("@earendil-works/pi-tui", () => ({
  Text: class Text {
    constructor(public content: string) {}
  },
}));

describe("Team Ops Renderer", () => {
  let mockApi: any;

  beforeEach(() => {
    mockApi = createMockExtensionAPI({ registerMessageRenderer: vi.fn() });
  });

  describe("registerTeamOpsRenderer", () => {
    it("should register renderer for 'team_ops_result' type", () => {
      registerTeamOpsRenderer(mockApi);
      expect(mockApi.registerMessageRenderer).toHaveBeenCalledWith(
        "team_ops_result",
        expect.any(Function)
      );
    });

    it("should return default text when details missing", () => {
      registerTeamOpsRenderer(mockApi);

      const mockTheme = { fg: (c: string, t: string) => t };
      const renderer = mockApi.registerMessageRenderer.mock.calls[0][1] as RendererFn;
      const result: any = renderer({}, {}, mockTheme);

      expect(result).toBeInstanceOf(Text);
      expect(result.content).toBe("👥 Team operation");
    });

    it("should render get_team_status action", () => {
      registerTeamOpsRenderer(mockApi);

      const mockTheme = { fg: (c: string, t: string) => t };
      const details = {
        action: "get_team_status",
        teamId: "team-123",
        totalAgents: 5,
        activeAgents: 3,
        pendingTasks: 7,
        completedTasks: 12,
        agents: [
          { id: "agent1", status: "working", currentTask: "Coding feature X" },
          { id: "agent2", status: "idle" },
        ],
      };

      const renderer = mockApi.registerMessageRenderer.mock.calls[0][1] as RendererFn;
      const result: any = renderer({ details }, {}, mockTheme);
      const content = result.content;

      expect(content).toContain("Team: team-123");
      expect(content).toContain("Agents: 3/5 active");
      expect(content).toContain("Tasks: 7 pending, 12 completed");
      expect(content).toContain("agent1");
      expect(content).toContain("Coding feature X");
      expect(content).toContain("agent2");
    });

    it("should render get_messages action", () => {
      registerTeamOpsRenderer(mockApi);

      const mockTheme = { fg: (c: string, t: string) => t };
      const details = {
        action: "get_messages",
        messages: [
          { from: "Alice", channel: "general", content: "Hello team!" },
          { from: "Bob", channel: "dev", content: "Code review needed" },
        ],
      };

      const renderer = mockApi.registerMessageRenderer.mock.calls[0][1] as RendererFn;
      const result: any = renderer({ details }, {}, mockTheme);
      const content = result.content;

      expect(content).toContain("Messages (2):");
      expect(content).toContain("Alice");
      expect(content).toContain("Hello team!");
      expect(content).toContain("Bob");
    });

    it("should truncate long message list", () => {
      registerTeamOpsRenderer(mockApi);

      const mockTheme = { fg: (c: string, t: string) => t };
      const messages = Array.from({ length: 15 }, (_, i) => ({
        from: `User${i}`,
        channel: "test",
        content: `Message ${i}`,
      }));
      const details = {
        action: "get_messages",
        messages,
      };

      const renderer = mockApi.registerMessageRenderer.mock.calls[0][1] as RendererFn;
      const result: any = renderer({ details }, {}, mockTheme);
      const content = result.content;

      expect(content).toContain("Messages (15):");
      expect(content).toContain("...and 5 more."); // 15 - 10 = 5
    });

    it("should render workspace_read action", () => {
      registerTeamOpsRenderer(mockApi);

      const mockTheme = { fg: (c: string, t: string) => t };
      const details = {
        action: "workspace_read",
        key: "config.json",
        value: '{"setting": "value"}',
      };

      const renderer = mockApi.registerMessageRenderer.mock.calls[0][1] as RendererFn;
      const result: any = renderer({ details }, {}, mockTheme);
      const content = result.content;

      expect(content).toContain("Workspace key: config.json");
      expect(content).toContain('{"setting": "value"}');
    });

    it("should render workspace_write action", () => {
      registerTeamOpsRenderer(mockApi);

      const mockTheme = { fg: (c: string, t: string) => t };
      const details = {
        action: "workspace_write",
        key: "notes.txt",
      };

      const renderer = mockApi.registerMessageRenderer.mock.calls[0][1] as RendererFn;
      const result: any = renderer({ details }, {}, mockTheme);
      const content = result.content;

      expect(content).toContain("✓ Wrote to workspace");
      expect(content).toContain("notes.txt");
    });

    it("should render send_message action", () => {
      registerTeamOpsRenderer(mockApi);

      const mockTheme = { fg: (c: string, t: string) => t };
      const details = {
        action: "send_message",
        channel: "team.chat",
      };

      const renderer = mockApi.registerMessageRenderer.mock.calls[0][1] as RendererFn;
      const result: any = renderer({ details }, {}, mockTheme);
      const content = result.content;

      expect(content).toContain("✓ Message sent");
      expect(content).toContain("team.chat");
    });

    it("should render claim_task action", () => {
      registerTeamOpsRenderer(mockApi);

      const mockTheme = { fg: (c: string, t: string) => t };
      const details = {
        action: "claim_task",
        taskIndex: 3,
      };

      const renderer = mockApi.registerMessageRenderer.mock.calls[0][1] as RendererFn;
      const result: any = renderer({ details }, {}, mockTheme);
      const content = result.content;

      expect(content).toContain("✓ Claimed task #3");
    });

    it("should render claim_task with warning when no tasks", () => {
      registerTeamOpsRenderer(mockApi);

      const mockTheme = { fg: (c: string, t: string) => t };
      const details = {
        action: "claim_task",
      };

      const renderer = mockApi.registerMessageRenderer.mock.calls[0][1] as RendererFn;
      const result: any = renderer({ details }, {}, mockTheme);
      const content = result.content;

      expect(content).toContain("No tasks available");
    });

    it("should render complete_task action", () => {
      registerTeamOpsRenderer(mockApi);

      const mockTheme = { fg: (c: string, t: string) => t };
      const details = {
        action: "complete_task",
        taskIndex: 5,
      };

      const renderer = mockApi.registerMessageRenderer.mock.calls[0][1] as RendererFn;
      const result: any = renderer({ details }, {}, mockTheme);
      const content = result.content;

      expect(content).toContain("✓ Completed task #5");
    });

    it("should render release_task action", () => {
      registerTeamOpsRenderer(mockApi);

      const mockTheme = { fg: (c: string, t: string) => t };
      const details = {
        action: "release_task",
        taskIndex: 2,
      };

      const renderer = mockApi.registerMessageRenderer.mock.calls[0][1] as RendererFn;
      const result: any = renderer({ details }, {}, mockTheme);
      const content = result.content;

      expect(content).toContain("↩ Released task #2");
    });

    it("should render update_status action", () => {
      registerTeamOpsRenderer(mockApi);

      const mockTheme = { fg: (c: string, t: string) => t };
      const details = {
        action: "update_status",
        status: "focusing",
      };

      const renderer = mockApi.registerMessageRenderer.mock.calls[0][1] as RendererFn;
      const result: any = renderer({ details }, {}, mockTheme);
      const content = result.content;

      expect(content).toContain("● Status updated");
      expect(content).toContain("focusing");
    });

    it("should handle error in details", () => {
      registerTeamOpsRenderer(mockApi);

      const mockTheme = { fg: (c: string, t: string) => t };
      const details = {
        error: "Connection failed",
      };

      const renderer = mockApi.registerMessageRenderer.mock.calls[0][1] as RendererFn;
      const result: any = renderer({ details }, {}, mockTheme);
      const content = result.content;

      expect(content).toContain("❌ Connection failed");
    });

    it("should handle isError flag", () => {
      registerTeamOpsRenderer(mockApi);

      const mockTheme = { fg: (c: string, t: string) => t };
      const msg = {
        isError: true,
        details: {},
      };

      const renderer = mockApi.registerMessageRenderer.mock.calls[0][1] as RendererFn;
      const result: any = renderer(msg, {}, mockTheme);
      const content = result.content;

      expect(content).toContain("❌ Error occurred");
    });

    it("should render content for non-error actions", () => {
      registerTeamOpsRenderer(mockApi);

      const mockTheme = { fg: (c: string, t: string) => t };
      const msg = {
        content: [{ type: "text", text: "Operation successful" }],
        details: { action: "custom_action" },
      };

      const renderer = mockApi.registerMessageRenderer.mock.calls[0][1] as RendererFn;
      const result: any = renderer(msg, {}, mockTheme);
      const content = result.content;

      expect(content).toContain("Operation successful");
    });

    it("should render warning for unknown action", () => {
      registerTeamOpsRenderer(mockApi);

      const mockTheme = { fg: (c: string, t: string) => t };
      const details = { action: "unknown_action" };

      const renderer = mockApi.registerMessageRenderer.mock.calls[0][1] as RendererFn;
      const result: any = renderer({ details }, {}, mockTheme);
      const content = result.content;

      expect(content).toContain("Unknown action: unknown_action");
    });
  });
});
