#!/usr/bin/env node

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Container, Text, Spacer, SettingsList } from "@earendil-works/pi-tui";
import { getSettingsListTheme, SettingsManager, getAgentDir } from "@earendil-works/pi-coding-agent";

interface SettingItem {
  id: string;
  label: string;
  currentValue: string;
  values: string[];
}

function isValidThinkingLevel(value: string): value is "off" | "minimal" | "low" | "medium" | "high" | "xhigh" {
  return ["off", "minimal", "low", "medium", "high", "xhigh"].includes(value);
}

function settingsToItems(settingsManager: SettingsManager): SettingItem[] {
  const items: SettingItem[] = [];

  const model = settingsManager.getDefaultModel() || "<unset>";
  items.push({
    id: "model",
    label: "Default Model",
    currentValue: model,
    values: ["<unset>", "anthropic:claude-opus-4-5", "openai:gpt-4o", "kilo:gpt-4o"],
  });

  const thinking = settingsManager.getDefaultThinkingLevel() || "medium";
  items.push({
    id: "thinking",
    label: "Thinking Level",
    currentValue: thinking,
    values: ["off", "minimal", "low", "medium", "high", "xhigh"],
  });

  return items;
}

function applySettingChange(settingsManager: SettingsManager, id: string, newValue: string): void {
  switch (id) {
    case "model":
      settingsManager.setDefaultModel(newValue === "<unset>" ? "" : newValue);
      break;
    case "thinking":
      if (isValidThinkingLevel(newValue)) {
        settingsManager.setDefaultThinkingLevel(newValue);
      } else {
        settingsManager.setDefaultThinkingLevel("medium");
      }
      break;
  }
}

export function registerSettingsCommand(api: ExtensionAPI): void {
  api.registerCommand("settings", {
    description: "Configure Piclaw settings (model, thinking)",
    handler: async (_args: string, ctx: ExtensionContext) => {
      if (!ctx.hasUI) {
        ctx.ui.notify("/settings requires TUI mode", "error");
        return;
      }

      const settingsManager = SettingsManager.create(ctx.cwd, getAgentDir());

      await ctx.ui.custom((_tui, theme, _kb, done) => {
        const container = new Container();

        container.addChild(new Text(theme.fg("accent", theme.bold("⚙️ Piclaw Settings")), 1, 0));
        container.addChild(new Spacer(1));

        let settingsList: SettingsList | null = null;

        function createSettingsList(): SettingsList {
          const items = settingsToItems(settingsManager);
          return new SettingsList(
            items,
            Math.min(items.length + 2, 15),
            getSettingsListTheme(),
            (id, newValue) => {
              try {
                applySettingChange(settingsManager, id, newValue);
                // Recreate list to show updated values
                if (settingsList) {
                  container.removeChild(settingsList);
                }
                settingsList = createSettingsList();
                container.addChild(settingsList);
                _tui.requestRender();
                ctx.ui.notify(`Saved ${id} = ${newValue}`, "info");
              } catch (err: any) {
                ctx.ui.notify(`Failed to save ${id}: ${err.message}`, "error");
              }
            },
            () => {
              done(undefined);
            },
            { enableSearch: true }
          );
        }

        settingsList = createSettingsList();
        container.addChild(settingsList);

        const component = {
          render(width: number) {
            return container.render(width);
          },
          invalidate() {
            container.invalidate();
          },
          handleInput(data: string) {
            settingsList?.handleInput?.(data);
            _tui.requestRender();
          },
        };

        return component;
      });

      ctx.ui.notify("Settings configuration complete", "info");
    },
  });
}
