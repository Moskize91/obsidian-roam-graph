import {
  App,
  MarkdownView,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
  normalizePath,
  type WorkspaceLeaf,
} from "obsidian";
import { buildGraphCanvas } from "../lib/canvas";
import {
  ensureCanvasExtension,
  getDefaultPluginSettings,
  normalizePluginSettings,
  type PluginSettings,
} from "../lib/plugin-settings";
import { resolveNeighbors } from "../lib/graph";

export default class RoamGraphPlugin extends Plugin {
  settings: PluginSettings = getDefaultPluginSettings();
  private updateTimer: number | null = null;
  private canvasLeaf: WorkspaceLeaf | null = null;
  private managedGraphLeaves = new Set<WorkspaceLeaf>();
  private lastCenterPath: string | null = null;
  private redirectingCanvasLeaf = false;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.addSettingTab(new RoamGraphSettingTab(this.app, this));

    this.addRibbonIcon("waypoints", "Open Roam Graph", () => {
      void this.refreshFromActiveFile({ reveal: true });
    });

    this.addCommand({
      id: "open-roam-graph",
      name: "Open graph for active note",
      callback: () => {
        void this.refreshFromActiveFile({ reveal: true });
      },
    });

    this.addCommand({
      id: "refresh-roam-graph",
      name: "Refresh graph",
      callback: () => {
        void this.refreshFromActiveFile({ force: true });
      },
    });

    this.registerEvent(
      this.app.workspace.on("active-leaf-change", (leaf) => {
        void this.redirectManagedGraphLeafNavigation();
        if (leaf && this.isLeafInRightSidebar(leaf)) {
          return;
        }
        this.scheduleRefresh(this.getMarkdownFileFromLeaf(leaf));
      }),
    );

    this.registerEvent(
      this.app.workspace.on("file-open", () => {
        void this.redirectManagedGraphLeafNavigation();
      }),
    );

    this.registerEvent(
      this.app.workspace.on("layout-change", () => {
        void this.redirectManagedGraphLeafNavigation();
      }),
    );

    this.registerEvent(
      this.app.metadataCache.on("resolved", () => {
        if (this.lastCenterPath) {
          this.scheduleRefresh(this.app.vault.getAbstractFileByPath(this.lastCenterPath), { force: true });
        }
      }),
    );

    this.app.workspace.onLayoutReady(() => {
      if (this.settings.openCanvasOnStartup) {
        void this.refreshFromActiveFile();
      }
    });
  }

  onunload(): void {
    if (this.updateTimer) {
      window.clearTimeout(this.updateTimer);
      this.updateTimer = null;
    }
  }

  async loadSettings(): Promise<void> {
    this.settings = normalizePluginSettings((await this.loadData()) as Partial<PluginSettings> | null);
  }

  async saveSettings(): Promise<void> {
    this.settings = normalizePluginSettings(this.settings);
    await this.saveData(this.settings);
  }

  async refreshFromActiveFile(options: { force?: boolean; reveal?: boolean } = {}): Promise<void> {
    await this.refreshForFile(this.app.workspace.getActiveFile(), options);
  }

  private scheduleRefresh(file: unknown, options: { force?: boolean } = {}): void {
    if (this.updateTimer) {
      window.clearTimeout(this.updateTimer);
    }
    this.updateTimer = window.setTimeout(() => {
      this.updateTimer = null;
      void this.refreshForFile(file, options);
    }, this.settings.debounceMs);
  }

  private getMarkdownFileFromLeaf(leaf: WorkspaceLeaf | null): TFile | null {
    if (!(leaf?.view instanceof MarkdownView)) return null;
    return leaf.view.file;
  }

  private async refreshForFile(
    file: unknown,
    options: { force?: boolean; reveal?: boolean; targetGraphLeaf?: WorkspaceLeaf } = {},
  ): Promise<void> {
    if (!(file instanceof TFile)) return;
    if (file.extension !== "md") return;
    if (!options.force && file.path === this.lastCenterPath) return;

    this.lastCenterPath = file.path;

    const canvasFile = await this.ensureCanvasFile();
    const neighbors = resolveNeighbors(this.app, file, {
      includeOutgoingLinks: this.settings.includeOutgoingLinks,
      includeBacklinks: this.settings.includeBacklinks,
      limit: this.settings.neighborLimit,
    });
    const canvas = buildGraphCanvas({
      centerPath: file.path,
      neighbors,
    });

    await this.app.vault.modify(canvasFile, `${JSON.stringify(canvas, null, 2)}\n`);
    await this.openCanvasInRightSidebar(canvasFile, options.reveal ?? false, options.targetGraphLeaf);
  }

  private async ensureCanvasFile(): Promise<TFile> {
    const canvasPath = normalizePath(ensureCanvasExtension(this.settings.canvasPath));
    const existing = this.app.vault.getAbstractFileByPath(canvasPath);
    if (existing instanceof TFile) {
      if (existing.extension !== "canvas") {
        throw new Error(`Roam Graph path is not a canvas file: ${canvasPath}`);
      }
      return existing;
    }
    if (existing) {
      throw new Error(`Roam Graph path points to a folder: ${canvasPath}`);
    }

    const parentPath = canvasPath.split("/").slice(0, -1).join("/");
    if (parentPath) {
      await this.ensureFolder(parentPath);
    }
    return await this.app.vault.create(canvasPath, `${JSON.stringify({ nodes: [], edges: [] }, null, 2)}\n`);
  }

  private async ensureFolder(path: string): Promise<void> {
    const parts = normalizePath(path).split("/");
    let current = "";
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      if (!this.app.vault.getAbstractFileByPath(current)) {
        await this.app.vault.createFolder(current);
      }
    }
  }

  private async openCanvasInRightSidebar(file: TFile, reveal: boolean, targetLeaf?: WorkspaceLeaf): Promise<void> {
    const leaf =
      targetLeaf && this.isLeafInRightSidebar(targetLeaf)
        ? targetLeaf
        : this.findRightSidebarGeneratedCanvasLeaf() ??
          (this.canvasLeaf && this.isLeafInRightSidebar(this.canvasLeaf) ? this.canvasLeaf : null) ??
          this.app.workspace.getRightLeaf(false);
    if (!leaf) {
      new Notice("Roam Graph could not open the right sidebar.");
      return;
    }
    this.canvasLeaf = leaf;
    this.managedGraphLeaves.add(leaf);
    await leaf.openFile(file, { active: false });
    if (reveal) {
      await this.app.workspace.revealLeaf(leaf);
    }
  }

  private async redirectManagedGraphLeafNavigation(): Promise<void> {
    if (this.redirectingCanvasLeaf) return;

    const navigation = this.findManagedGraphLeafNavigation();
    if (!navigation) return;

    this.redirectingCanvasLeaf = true;
    try {
      const targetLeaf = this.getMainWorkspaceLeaf();
      await targetLeaf.openFile(navigation.file, { active: true });
      await this.refreshForFile(navigation.file, { force: true, targetGraphLeaf: navigation.leaf });
    } finally {
      this.redirectingCanvasLeaf = false;
    }
  }

  private findManagedGraphLeafNavigation(): { leaf: WorkspaceLeaf; file: TFile } | null {
    const rightLeaves = new Set<WorkspaceLeaf>();
    let navigation: { leaf: WorkspaceLeaf; file: TFile } | null = null;

    this.app.workspace.iterateAllLeaves((leaf) => {
      if (!this.isLeafInRightSidebar(leaf)) {
        this.managedGraphLeaves.delete(leaf);
        return;
      }

      rightLeaves.add(leaf);
      if (this.isGeneratedCanvasLeaf(leaf)) {
        this.managedGraphLeaves.add(leaf);
        return;
      }

      const file = this.getMarkdownFileFromLeaf(leaf);
      if (!navigation && file && this.managedGraphLeaves.has(leaf)) {
        navigation = { leaf, file };
        return;
      }

      if (!file) {
        this.managedGraphLeaves.delete(leaf);
      }
    });

    for (const leaf of this.managedGraphLeaves) {
      if (!rightLeaves.has(leaf)) {
        this.managedGraphLeaves.delete(leaf);
      }
    }

    return navigation;
  }

  private findRightSidebarGeneratedCanvasLeaf(): WorkspaceLeaf | null {
    let graphLeaf: WorkspaceLeaf | null = null;
    this.app.workspace.iterateAllLeaves((leaf) => {
      if (!graphLeaf && this.isLeafInRightSidebar(leaf) && this.isGeneratedCanvasLeaf(leaf)) {
        graphLeaf = leaf;
      }
    });
    return graphLeaf;
  }

  private isGeneratedCanvasLeaf(leaf: WorkspaceLeaf): boolean {
    const file = this.getFileFromLeaf(leaf);
    return file?.path === this.getCanvasPath();
  }

  private getFileFromLeaf(leaf: WorkspaceLeaf | null): TFile | null {
    const viewWithFile = leaf?.view as { file?: unknown } | undefined;
    return viewWithFile?.file instanceof TFile ? viewWithFile.file : null;
  }

  private getCanvasPath(): string {
    return normalizePath(ensureCanvasExtension(this.settings.canvasPath));
  }

  private isLeafInRightSidebar(leaf: WorkspaceLeaf): boolean {
    let item: unknown = leaf;
    while (item && typeof item === "object") {
      if (item === this.app.workspace.rightSplit) {
        return true;
      }
      item = "parent" in item ? (item as { parent?: unknown }).parent : null;
    }
    return false;
  }

  private getMainWorkspaceLeaf(): WorkspaceLeaf {
    const recentLeaf = this.app.workspace.getMostRecentLeaf(this.app.workspace.rootSplit);
    if (recentLeaf && recentLeaf !== this.canvasLeaf) {
      return recentLeaf;
    }

    let firstRootLeaf: WorkspaceLeaf | null = null;
    this.app.workspace.iterateRootLeaves((leaf) => {
      firstRootLeaf ??= leaf;
    });
    return firstRootLeaf ?? this.app.workspace.getLeaf("tab");
  }
}

class RoamGraphSettingTab extends PluginSettingTab {
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
      .setName("Canvas file")
      .setDesc("The generated Canvas file used by the sidebar graph.")
      .addText((text) => {
        text
          .setPlaceholder("Roam Graph.canvas")
          .setValue(this.plugin.settings.canvasPath)
          .onChange((value) => {
            void (async () => {
              this.plugin.settings.canvasPath = ensureCanvasExtension(value.trim() || getDefaultPluginSettings().canvasPath);
              await this.plugin.saveSettings();
            })();
          });
      });

    new Setting(containerEl)
      .setName("Neighbor limit")
      .setDesc("Maximum linked notes to show around the active note.")
      .addSlider((slider) => {
        slider
          .setLimits(1, 80, 1)
          .setDynamicTooltip()
          .setValue(this.plugin.settings.neighborLimit)
          .onChange((value) => {
            void (async () => {
              this.plugin.settings.neighborLimit = value;
              await this.plugin.saveSettings();
              await this.plugin.refreshFromActiveFile({ force: true });
            })();
          });
      });

    new Setting(containerEl)
      .setName("Outgoing links")
      .setDesc("Show notes linked from the active note.")
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.includeOutgoingLinks).onChange((value) => {
          void (async () => {
            this.plugin.settings.includeOutgoingLinks = value;
            await this.plugin.saveSettings();
            await this.plugin.refreshFromActiveFile({ force: true });
          })();
        });
      });

    new Setting(containerEl)
      .setName("Backlinks")
      .setDesc("Show notes linking back to the active note.")
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.includeBacklinks).onChange((value) => {
          void (async () => {
            this.plugin.settings.includeBacklinks = value;
            await this.plugin.saveSettings();
            await this.plugin.refreshFromActiveFile({ force: true });
          })();
        });
      });

    new Setting(containerEl)
      .setName("Open on startup")
      .setDesc("Open the generated Canvas in the right sidebar when Obsidian is ready.")
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.openCanvasOnStartup).onChange((value) => {
          void (async () => {
            this.plugin.settings.openCanvasOnStartup = value;
            await this.plugin.saveSettings();
          })();
        });
      });

    new Setting(containerEl)
      .setName("Refresh delay")
      .setDesc("Debounce delay after active note changes, in milliseconds.")
      .addText((text) => {
        text
          .setPlaceholder("150")
          .setValue(String(this.plugin.settings.debounceMs))
          .onChange((value) => {
            void (async () => {
              this.plugin.settings.debounceMs = Number.parseInt(value, 10);
              await this.plugin.saveSettings();
            })();
          });
      });

    containerEl.createEl("p", {
      cls: "roam-graph-setting-hint",
      text: "Roam Graph rewrites this Canvas whenever the active Markdown note changes. Native Canvas remains editable; manual edits may be overwritten.",
    });
  }
}
