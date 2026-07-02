#!/usr/bin/env node

/**
 * System Info Command - Simple version
 *
 * Collects basic system information.
 * Category: system
 */

import { Type } from "typebox";
import * as os from "node:os";
import { Text } from "@earendil-works/pi-tui";

export const metadata = {
  name: "system.info",
  category: "system",
  description: "Display basic system information (OS, CPU, memory, Node.js)",
  longDescription: `
Collects system information:
- OS: platform, arch, hostname
- CPU: model, cores
- Memory: total, free, used, usage %
- Node.js: version, uptime
  `.trim(),
  examples: [
    "master_tool({ command: 'system.info', args: {} })",
    "master_tool({ command: 'system.info', args: { detailed: true } })"
  ],
  tags: ["system", "monitoring"],
  permissions: []
};

export const schema = Type.Object({
  detailed: Type.Optional(Type.Boolean({ description: "Include more details" }))
}, { additionalProperties: false });

interface SystemInfo {
  platform: string;
  arch: string;
  hostname: string;
  cpu: {
    model: string;
    cores: number;
  };
  memory: {
    totalMB: number;
    freeMB: number;
    usedMB: number;
    usagePercent: number;
  };
  node: {
    version: string;
    uptime: number; // seconds
  };
}

export async function execute(
  args: { detailed?: boolean },
  cwd: string,
  signal?: AbortSignal,
  ctx?: any
): Promise<{ code: number; stdout: string; stderr: string; data?: SystemInfo }> {
  try {
    const cpus = os.cpus();
    const totalmem = os.totalmem();
    const freemem = os.freemem();
    const usedmem = totalmem - freemem;

    const info: SystemInfo = {
      platform: os.platform(),
      arch: os.arch(),
      hostname: os.hostname(),
      cpu: {
        model: cpus[0]?.model || "Unknown",
        cores: cpus.length
      },
      memory: {
        totalMB: Math.round(totalmem / (1024 * 1024)),
        freeMB: Math.round(freemem / (1024 * 1024)),
        usedMB: Math.round(usedmem / (1024 * 1024)),
        usagePercent: Number(((usedmem / totalmem) * 100).toFixed(1))
      },
      node: {
        version: process.version,
        uptime: os.uptime()
      }
    };

    const output = formatOutput(info, args.detailed);
    return { code: 0, stdout: output, stderr: "", data: info };

  } catch (error: any) {
    return { code: 1, stdout: "", stderr: `system.info error: ${error.message}`, data: undefined };
  }
}

function formatOutput(info: SystemInfo, detailed?: boolean): string {
  const lines: string[] = [
    "🖥️  System Information",
    "─".repeat(40),
    "",
    `OS:     ${info.platform} (${info.arch})`,
    `Host:   ${info.hostname}`,
    `CPU:    ${info.cpu.model}`,
    `        ${info.cpu.cores} cores`,
    `Memory: ${info.memory.usedMB}MB / ${info.memory.totalMB}MB (${info.memory.usagePercent}%)`,
    `Node:   ${info.node.version}`,
    `Uptime: ${formatUptime(info.node.uptime)}`
  ];

  if (detailed) {
    lines.push("");
    lines.push("📊 Detailed:");
    lines.push(`  Total memory: ${info.memory.totalMB} MB`);
    lines.push(`  Free memory:  ${info.memory.freeMB} MB`);
    lines.push(`  Used memory:  ${info.memory.usedMB} MB`);
  }

  return lines.join("\n");
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

// Optional custom renderer
export function renderResult(result: any, options: any, theme: any): any {
  if (result.code !== 0) {
    return new Text(theme.fg("error", `❌ ${result.stderr}`));
  }

  const data = result.data;
  if (!data) {
    return new Text(theme.fg("text", result.stdout));
  }

  const lines: string[] = [];
  lines.push(theme.fg("accent", "🖥️  System Info").bold());
  lines.push("");
  lines.push(`CPU: ${theme.fg("highlight", data.cpu.model)} (${data.cpu.cores} cores)`);

  const memPct = data.memory.usagePercent;
  const memBar = createBar(memPct / 100, 20);
  lines.push(`RAM: ${memBar} ${memPct}%`);
  lines.push(`     ${theme.fg("muted", `${data.memory.usedMB}MB / ${data.memory.totalMB}MB`)}`);

  lines.push(`OS:  ${theme.fg("text", `${data.platform} ${data.arch}`)}`);
  lines.push(`Node: ${theme.fg("text", data.node.version)}`);
  lines.push(`Up:   ${formatUptime(data.node.uptime)}`);

  return new Text(lines.join("\n"));
}

function createBar(percent: number, length: number): string {
  const filled = Math.round(length * percent);
  const empty = length - filled;
  return "█".repeat(filled) + "░".repeat(empty);
}

export default { metadata, schema, execute, renderResult };
