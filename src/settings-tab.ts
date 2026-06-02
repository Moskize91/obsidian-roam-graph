import { App, PluginSettingTab, Setting } from "obsidian";
import type RoamGraphPlugin from "./main";

export class RoamGraphSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private readonly plugin: RoamGraphPlugin,
  ) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Graph folder")
      .setDesc("Folder for the generated Roam Graph Canvas. Leave empty to use the vault root.")
      .addText((text) => {
        text
          .setPlaceholder("Daily")
          .setValue(this.plugin.settings.graphFolderPath)
          .onChange((value) => {
            void (async () => {
              this.plugin.settings.graphFolderPath = value.trim();
              await this.plugin.saveSettings();
            })();
          });
      });

    new Setting(containerEl)
      .setName("Layer limit")
      .setDesc("Maximum linked notes to show in each layer on both sides of the active note.")
      .addSlider((slider) => {
        slider
          .setLimits(1, 20, 1)
          .setDynamicTooltip()
          .setValue(this.plugin.settings.layerLimitCount)
          .onChange((value) => {
            void (async () => {
              this.plugin.settings.layerLimitCount = value;
              await this.plugin.saveSettings();
              await this.plugin.refreshFromActiveFile({ force: true });
            })();
          });
      });

    new Setting(containerEl)
      .setName("Daily context limit")
      .setDesc("Maximum nearby daily notes to show on each side of the active daily note.")
      .addSlider((slider) => {
        slider
          .setLimits(0, 20, 1)
          .setDynamicTooltip()
          .setValue(this.plugin.settings.dailyContextLimit)
          .onChange((value) => {
            void (async () => {
              this.plugin.settings.dailyContextLimit = value;
              await this.plugin.saveSettings();
              await this.plugin.refreshFromActiveFile({ force: true });
            })();
          });
      });

    containerEl.createEl("p", {
      cls: "roam-graph-setting-hint",
      text: "Roam Graph rewrites this Canvas whenever the active Markdown note changes. Native Canvas remains editable; manual edits may be overwritten.",
    });
  }
}
