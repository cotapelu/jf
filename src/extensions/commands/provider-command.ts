#!/usr/bin/env node

/**
 * Provider Management Command
 *
 * /providers list|add|remove|test
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Container, Text, Spacer } from "@earendil-works/pi-tui";
import { parseArgs } from "../utils/command-args.js";

function getProviderInfo(ctx: any): Array<{ name: string; displayName: string; modelCount: number; baseUrl?: string }> {
  const modelRegistry = ctx.modelRegistry;
  const allModels = modelRegistry.getAll();
  const providers = new Map<string, { name: string; baseUrl?: string; models: string[] }>();
  for (const m of allModels) {
    const provider = m.provider;
    if (!providers.has(provider)) {
      // @ts-ignore
      providers.set(provider, { name: provider, baseUrl: m.providerBaseUrl, models: [] });
    }
    providers.get(provider)!.models.push(m.id);
  }
  return Array.from(providers.values()).map(p => ({ name: p.name, displayName: p.name, modelCount: p.models.length, baseUrl: p.baseUrl }));
}

export function registerProviderCommand(api: ExtensionAPI): void {
  api.registerCommand("providers", {
    description: "Manage LLM providers: list, add, remove, test",
    handler: async (args: string, ctx) => {
      const parsed = parseArgs(args);
      const action = parsed.action || "list";

      if (action === "list") {
        const infos = getProviderInfo(ctx);
        if (infos.length === 0) {
          ctx.ui.notify("No providers registered", "info");
          return;
        }

        await ctx.ui.custom((_tui, theme, _kb, done) => {
          const container = new Container();
          container.addChild(new Text(theme.fg("accent", theme.bold("📦 Registered Providers")), 1, 0));
          container.addChild(new Spacer(1));

          for (const info of infos) {
            const line = `• ${info.displayName} (${info.name}) - ${info.modelCount} models`;
            if (info.baseUrl) {
              container.addChild(new Text(`${theme.fg("text", line)} ${theme.fg("dim", `[${info.baseUrl}]`)}`, 0, 0));
            } else {
              container.addChild(new Text(theme.fg("text", line), 0, 0));
            }
          }

          const component = {
            render(w: number) { return container.render(w); },
            invalidate() { container.invalidate(); },
            handleInput(_: string) { done(undefined); },
          };
          return component;
        });
        return;
      }

      if (action === "add") {
        const providerName = parsed.args[0];
        const baseUrl = parsed.args[1];
        const apiKey = parsed.args[2];

        if (!providerName || !baseUrl || !apiKey) {
          ctx.ui.notify("Usage: /providers add <name> <baseUrl> <apiKey>", "error");
          return;
        }

        try {
          ctx.modelRegistry.registerProvider(providerName, {
            name: providerName,
            baseUrl,
            apiKey,
          });
          ctx.ui.notify(`Added provider ${providerName}`, "info");
        } catch (e: any) {
          ctx.ui.notify(`Failed: ${e.message}`, "error");
        }
        return;
      }

      if (action === "remove") {
        const providerName = parsed.args[0];
        if (!providerName) {
          ctx.ui.notify("Usage: /providers remove <name>", "error");
          return;
        }
        ctx.modelRegistry.unregisterProvider(providerName);
        ctx.ui.notify(`Removed provider ${providerName}`, "info");
        return;
      }

      if (action === "test") {
        const providerName = parsed.args[0];
        if (!providerName) {
          ctx.ui.notify("Usage: /providers test <name>", "error");
          return;
        }
        try {
          const available = ctx.modelRegistry.getAvailable();
          const count = available.filter(m => m.provider === providerName).length;
          if (count === 0) {
            ctx.ui.notify(`No available models for ${providerName} (auth required)`, "warning");
          } else {
            ctx.ui.notify(`${providerName} OK: ${count} models available`, "info");
          }
        } catch (e: any) {
          ctx.ui.notify(`Test failed: ${e.message}`, "error");
        }
        return;
      }

      ctx.ui.notify(`Unknown action: ${action}`, "error");
    },
  });
}
