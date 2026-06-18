/**
 * System Info Action
 *
 * Returns system information (OS, architecture, Node version, etc).
 */

import { platform, arch, release, uptime, totalmem, freemem, cpus } from "node:os";

export const systemInfoAction = {
  execute: async () => {
    const cpuInfo = cpus();
    const result = {
      platform: platform(),
      arch: arch(),
      osRelease: release(),
      nodeVersion: process.version,
      uptime: uptime(),
      totalMemoryMB: Math.round(totalmem() / 1024 / 1024),
      freeMemoryMB: Math.round(freemem() / 1024 / 1024),
      cpuCores: cpuInfo.length,
      cpuModel: cpuInfo[0]?.model || "unknown",
    };
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      details: result,
    };
  },
  getParameters: () => ({
    type: "object",
    properties: {}, // no input required
  }),
};
