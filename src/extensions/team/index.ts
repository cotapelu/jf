/**
 * Team System - Exports
 *
 * Simple team collaboration: one tool (team_run) that auto-executes tasks.
 */

// Core classes (if needed externally)
export { AgentTeam, type AgentTeamRuntime } from "./team-manager.js";
export { SharedWorkspace, type WorkspaceEntry } from "./workspace.js";

// Boot functions
export { bootPiclawTeam, executeTeamTasks } from "./team-manager.js";

// Tool registration
export { registerTeamTool } from "./team-tool.js";
