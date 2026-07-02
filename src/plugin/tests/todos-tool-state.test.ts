import { describe, it, expect, beforeEach } from "vitest";
import { TodoState } from "../extensions/tools/todos-tool.js";
import type { TodoPhase } from "../extensions/tools/todos-tool.js";

describe("TodoState", () => {
  let s: TodoState;
  beforeEach(() => { s = new TodoState(); });

  it("addPhase creates phase", () => {
    const p = s.addPhase("Backlog");
    expect(p.name).toBe("Backlog");
    expect(s.getPhases().length).toBe(1);
  });

  it("addTask appends to phase and auto-promotes if no active", () => {
    const p = s.addPhase("Todo");
    const t = s.addTask(p.id, "Write tests");
    expect(t).not.toBeNull();
    expect(t!.content).toBe("Write tests");
    // auto-promotion: first task becomes in_progress when added
    expect(t!.status).toBe("in_progress");
    expect(s.getPhases()[0].tasks.length).toBe(1);
  });

  it("updateTask modifies", () => {
    const p = s.addPhase("Do");
    const t = s.addTask(p.id, "Task")!;
    const u = s.updateTask(t.id, { status: "in_progress" });
    expect(u!).not.toBeNull();
    expect(u!.status).toBe("in_progress");
    expect(s.getPhases()[0].tasks[0].status).toBe("in_progress");
  });

  it("removeTask deletes", () => {
    const p = s.addPhase("R");
    const t = s.addTask(p.id, "Delete")!;
    expect(s.removeTask(t.id)).toBe(true);
    expect(s.getPhases()[0].tasks.length).toBe(0);
  });

  it("replacePhases resets", () => {
    s.addPhase("Old");
    const newP = { id: "phase-2", name: "New", description: "", tasks: [] } as unknown as TodoPhase;
    s.replacePhases([newP]);
    expect(s.getPhases().length).toBe(1);
    expect(s.getPhases()[0].name).toBe("New");
  });
});
