import { normalizePath, TFile, type App, type ObsidianProtocolData, type WorkspaceLeaf } from "obsidian";
import { ensureGraphCanvasFile, writeCanvasFile } from "./canvas-file";
import { resolveDailyContext } from "./daily-context";
import { buildGraphCanvas } from "./graph-canvas";
import type { GraphSide } from "./graph-model";
import { getGraphFile, resolveLinkNeighborhood } from "./link-neighborhood";
import { getCanvasPathFromFolderPath, type PluginSettings } from "./settings";
import { WorkspaceGraphView } from "./workspace-graph-view";

const REFRESH_DEBOUNCE_MS = 150;

export class RefreshController {
  readonly workspaceView: WorkspaceGraphView;
  private updateTimer: number | null = null;
  private lastCenterPath: string | null = null;
  private expandedCenterPath: string | null = null;
  private expandedLayerCounts = new Map<GraphSide, number>();

  constructor(
    private readonly app: App,
    private readonly getSettings: () => PluginSettings,
  ) {
    this.workspaceView = new WorkspaceGraphView(
      app,
      () => this.getCanvasPath(),
      () => this.lastCenterPath,
      (targetLeaf) => this.restoreCanvasInLeaf(targetLeaf),
      (file, options) => this.refreshForFile(file, options),
    );
  }

  unload(): void {
    if (this.updateTimer) {
      window.clearTimeout(this.updateTimer);
      this.updateTimer = null;
    }
  }

  async refreshFromActiveFile(options: { force?: boolean; reveal?: boolean; openIfMissing?: boolean } = {}): Promise<void> {
    await this.refreshForFile(this.workspaceView.getMainWorkspaceMarkdownFile() ?? this.app.workspace.getActiveFile(), options);
  }

  scheduleRefresh(file: unknown, options: { force?: boolean } = {}): void {
    if (this.updateTimer) {
      window.clearTimeout(this.updateTimer);
    }
    this.updateTimer = window.setTimeout(() => {
      this.updateTimer = null;
      void this.refreshForFile(file, options);
    }, REFRESH_DEBOUNCE_MS);
  }

  async refreshForFile(
    file: unknown,
    options: { force?: boolean; reveal?: boolean; openIfMissing?: boolean; targetGraphLeaf?: WorkspaceLeaf } = {},
  ): Promise<void> {
    if (!(file instanceof TFile)) return;
    if (file.extension !== "md") return;
    if (!options.force && !options.openIfMissing && file.path === this.lastCenterPath) return;

    this.lastCenterPath = file.path;

    const settings = this.getSettings();
    const canvasFile = await ensureGraphCanvasFile(this.app, this.getCanvasPath());
    const neighbors = resolveLinkNeighborhood(this.app, file, {
      includeOutgoingLinks: true,
      includeBacklinks: true,
    });
    const dailyContext = await resolveDailyContext(this.app, file, settings.dailyContextLimit);
    const canvas = buildGraphCanvas({
      center: getGraphFile(file),
      backlinks: neighbors.backlinks,
      outgoing: neighbors.outgoing,
      dailyContext,
      layerLimitCount: settings.layerLimitCount,
      expandedLayerCounts: this.getExpandedLayerCountsForFile(file),
      buildExpandUrl: (side) => this.buildExpandUrl(file, side),
    });

    await writeCanvasFile(this.app, canvasFile, canvas);
    const openOptions: { reveal: boolean; openIfMissing: boolean; targetLeaf?: WorkspaceLeaf } = {
      reveal: options.reveal ?? false,
      openIfMissing: options.openIfMissing ?? false,
    };
    if (options.targetGraphLeaf) {
      openOptions.targetLeaf = options.targetGraphLeaf;
    }
    await this.workspaceView.openCanvasInRightSidebar(canvasFile, openOptions);
  }

  async handleProtocol(params: ObsidianProtocolData): Promise<void> {
    const side = parseGraphSide(params.side);
    const centerPath = typeof params.center === "string" ? params.center : "";
    if (!side || !centerPath) return;

    const currentCenterPath = this.lastCenterPath;
    if (currentCenterPath !== centerPath) {
      return;
    }

    const file = this.app.vault.getAbstractFileByPath(centerPath);
    if (!(file instanceof TFile) || file.extension !== "md") {
      return;
    }

    this.expandedCenterPath = centerPath;
    this.expandedLayerCounts.set(side, (this.expandedLayerCounts.get(side) ?? 0) + 1);
    await this.refreshForFile(file, { force: true });
  }

  private getCanvasPath(): string {
    return normalizePath(getCanvasPathFromFolderPath(this.getSettings().graphFolderPath));
  }

  private async restoreCanvasInLeaf(targetLeaf: WorkspaceLeaf): Promise<void> {
    const canvasFile = await ensureGraphCanvasFile(this.app, this.getCanvasPath());
    await this.workspaceView.openCanvasInRightSidebar(canvasFile, {
      reveal: false,
      openIfMissing: false,
      targetLeaf,
    });
  }

  private getExpandedLayerCountsForFile(file: TFile): ReadonlyMap<GraphSide, number> {
    if (this.expandedCenterPath !== file.path) {
      this.expandedCenterPath = file.path;
      this.expandedLayerCounts.clear();
    }
    return this.expandedLayerCounts;
  }

  private buildExpandUrl(file: TFile, side: GraphSide): string {
    return `obsidian://roam-graph?side=${encodeURIComponent(side)}&center=${encodeURIComponent(file.path)}`;
  }
}

function parseGraphSide(value: unknown): GraphSide | null {
  return value === "backlinks" || value === "outgoing" ? value : null;
}
