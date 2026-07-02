import { registerBranchSummaryRenderer } from "../extensions/renderers/branch-summary-renderer.js";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { Text } from "@earendil-works/pi-tui";
import { createMockExtensionAPI } from "../tests/utils/mock-factory.js";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

type RendererFn = (message: { details?: unknown }, options: unknown, theme: unknown) => Text;

// Mock pi-tui Text class
vi.mock("@earendil-works/pi-tui", () => ({
  Text: class Text {
    constructor(public content: string) {}
  },
}));

describe("Branch Summary Renderer", () => {
  let mockApi: any;

  beforeEach(() => {
    mockApi = createMockExtensionAPI({ registerMessageRenderer: vi.fn() });
  });

  describe("registerBranchSummaryRenderer", () => {
    it("should not register if api.registerMessageRenderer is not a function", () => {
      const apiWithoutRenderer = { registerMessageRenderer: null };
      registerBranchSummaryRenderer(apiWithoutRenderer as unknown as ExtensionAPI);
      // Nothing should be called
    });

    it("should register renderer for 'branch_summary' type", () => {
      registerBranchSummaryRenderer(mockApi);
      expect(mockApi.registerMessageRenderer).toHaveBeenCalledWith(
        "branch_summary",
        expect.any(Function)
      );
    });

    it("should return default text when details missing", () => {
      registerBranchSummaryRenderer(mockApi);

      const mockTheme = {
        fg: (color: string, text: string) => text,
      };

      const renderer = mockApi.registerMessageRenderer.mock.calls[0][1] as RendererFn;
      const result: any = renderer({}, {}, mockTheme);

      expect(result).toBeInstanceOf(Text);
      expect(result.content).toBe("🌿 Branch point");
    });

    it("should render full branch summary with details", () => {
      registerBranchSummaryRenderer(mockApi);

      const mockTheme = {
        fg: (color: string, text: string) => {
          if (color === "accent") return `[ACCENT]${text}[/]`;
          if (color === "text") return `[TEXT]${text}[/]`;
          if (color === "dim") return `[DIM]${text}[/]`;
          if (color === "border") return `[BORDER]${text}[/]`;
          return text;
        },
      };

      const details = {
        fromId: "entry-123",
        summary: "This is a branch summary",
        details: { branches: 3, commits: 5 },
      };

      const renderer = mockApi.registerMessageRenderer.mock.calls[0][1] as RendererFn;
      const result: any = renderer({ details }, {}, mockTheme);

      const content = result.content;

      // Check key components
      expect(content).toContain("Branch Summary");
      expect(content).toContain("This is a branch summary");
      expect(content).toContain("entry-123");
      expect(content).toContain("Additional context:");
      expect(content).toContain("branches");
      expect(content).toContain("commits");
      // Check separator exists
      expect(content).toContain("─".repeat(30));
    });

    it("should handle string details", () => {
      registerBranchSummaryRenderer(mockApi);

      const mockTheme = {
        fg: (color: string, text: string) => text,
      };

      const details = {
        fromId: "entry-456",
        summary: "Simple summary",
        details: "Some additional string context",
      };

      const renderer = mockApi.registerMessageRenderer.mock.calls[0][1] as RendererFn;
      const result: any = renderer({ details }, {}, mockTheme);

      const content = result.content;
      expect(content).toContain("Additional context:");
      expect(content).toContain("Some additional string context");
    });

    it("should handle missing summary", () => {
      registerBranchSummaryRenderer(mockApi);

      const mockTheme = {
        fg: (color: string, text: string) => text,
      };

      const details = {
        fromId: "entry-789",
      };

      const renderer = mockApi.registerMessageRenderer.mock.calls[0][1] as RendererFn;
      const result: any = renderer({ details }, {}, mockTheme);

      const content = result.content;
      expect(content).toContain("From entry: entry-789");
      expect(content).toContain("─".repeat(40));
    });

    it("should handle missing fromId", () => {
      registerBranchSummaryRenderer(mockApi);

      const mockTheme = {
        fg: (color: string, text: string) => text,
      };

      const details = {
        summary: "Only summary, no fromId",
      };

      const renderer = mockApi.registerMessageRenderer.mock.calls[0][1] as RendererFn;
      const result: any = renderer({ details }, {}, mockTheme);

      const content = result.content;
      expect(content).toContain("Only summary, no fromId");
      // Should not have "From entry:" section when fromId missing
      const lines = content.split("\n");
      const hasFromEntryLine = lines.some((line: string) => line.includes("From entry:"));
      expect(hasFromEntryLine).toBe(false);
    });

    it("should handle details as non-string object", () => {
      registerBranchSummaryRenderer(mockApi);

      const mockTheme = {
        fg: (color: string, text: string) => {
          if (color === "dim") return `[DIM]${text}[/]`;
          return text;
        },
      };

      const details = {
        fromId: "entry-999",
        details: { complex: { nested: [1, 2, 3] } },
      };

      const renderer = mockApi.registerMessageRenderer.mock.calls[0][1] as RendererFn;
      const result: any = renderer({ details }, {}, mockTheme);

      const content = result.content;
      expect(content).toContain("entry-999");
      expect(content).toContain("Additional context:");
      expect(content).toContain("complex");
      expect(content).toContain("nested");
    });
  });
});
