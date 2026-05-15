import { SettingsManager } from "../src/core/settings-manager";
import { DefaultPackageManager } from "../src/core/package-manager";
import { AgentHost } from "../src/core/agent-host";
import { reportSettingsErrors } from "../src/core/package-manager-cli";

/**
 * Helper to create a DefaultPackageManager for tests.
 * Replaces repetitive setup in multiple test files.
 */
export function createTestPackageManager(cwd: string, agentDir: string, agentHost: AgentHost) {
  const settingsManager = SettingsManager.create(cwd, agentDir);
  reportSettingsErrors(settingsManager, "package command");
  return DefaultPackageManager.create(settingsManager, agentHost);
}

// Add more test helpers here as needed to reduce duplication.
