import { Notice, Plugin, type ObsidianProtocolData } from "obsidian";
import { RefreshController } from "./refresh-controller";
import { RoamGraphSettingTab } from "./settings-tab";
import { getDefaultPluginSettings, normalizePluginSettings, type PluginSettings } from "./settings";

export default class RoamGraphPlugin extends Plugin {
  settings: PluginSettings = getDefaultPluginSettings();
  private refreshController: RefreshController | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();
    await this.saveSettings();

    this.refreshController = new RefreshController(this.app, () => this.settings);
    this.addSettingTab(new RoamGraphSettingTab(this.app, this));

    this.addRibbonIcon("waypoints", "Open Roam Graph", () => {
      this.runSafely(this.refreshFromActiveFile({ reveal: true, openIfMissing: true }));
    });

    this.addCommand({
      id: "open-roam-graph",
      name: "Open graph for active note",
      callback: () => {
        this.runSafely(this.refreshFromActiveFile({ reveal: true, openIfMissing: true }));
      },
    });

    this.addCommand({
      id: "refresh-roam-graph",
      name: "Refresh graph",
      callback: () => {
        this.runSafely(this.refreshFromActiveFile({ force: true }));
      },
    });

    this.registerObsidianProtocolHandler("roam-graph", (params) => {
      this.runSafely(this.handleProtocol(params));
    });

    this.registerEvent(
      this.app.workspace.on("active-leaf-change", (leaf) => {
        void this.controller.workspaceView.redirectManagedGraphLeafNavigation();
        if (leaf && this.controller.workspaceView.isLeafInRightSidebar(leaf)) {
          return;
        }
        this.controller.scheduleRefresh(this.controller.workspaceView.getMarkdownFileFromLeaf(leaf));
      }),
    );

    this.registerEvent(
      this.app.workspace.on("file-open", () => {
        void this.controller.workspaceView.redirectManagedGraphLeafNavigation();
      }),
    );

    this.registerEvent(
      this.app.workspace.on("layout-change", () => {
        void this.controller.workspaceView.redirectManagedGraphLeafNavigation();
      }),
    );

    this.app.workspace.onLayoutReady(() => {
      this.runSafely(this.refreshFromActiveFile({ openIfMissing: true }));
    });
  }

  onunload(): void {
    this.refreshController?.unload();
  }

  async loadSettings(): Promise<void> {
    this.settings = normalizePluginSettings((await this.loadData()) as Partial<PluginSettings> | null);
  }

  async saveSettings(): Promise<void> {
    this.settings = normalizePluginSettings(this.settings);
    await this.saveData(this.settings);
  }

  async refreshFromActiveFile(options: { force?: boolean; reveal?: boolean; openIfMissing?: boolean } = {}): Promise<void> {
    await this.controller.refreshFromActiveFile(options);
  }

  private async handleProtocol(params: ObsidianProtocolData): Promise<void> {
    await this.controller.handleProtocol(params);
  }

  private runSafely(task: Promise<void>): void {
    void task.catch((error) => {
      console.error("Roam Graph failed.", error);
      new Notice(error instanceof Error ? `Roam Graph failed: ${error.message}` : "Roam Graph failed.");
    });
  }

  private get controller(): RefreshController {
    if (!this.refreshController) {
      throw new Error("Roam Graph refresh controller is not initialized.");
    }
    return this.refreshController;
  }
}
