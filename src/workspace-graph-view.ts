import { MarkdownView, Notice, TFile, type App, type WorkspaceLeaf } from "obsidian";

export type OpenGraphCanvasOptions = {
  reveal: boolean;
  openIfMissing: boolean;
  targetLeaf?: WorkspaceLeaf;
};

export class WorkspaceGraphView {
  private canvasLeaf: WorkspaceLeaf | null = null;
  private managedGraphLeaves = new Set<WorkspaceLeaf>();
  private redirectingCanvasLeaf = false;

  constructor(
    private readonly app: App,
    private readonly getCanvasPath: () => string,
    private readonly getCurrentCenterPath: () => string | null,
    private readonly restoreCanvasInLeaf: (targetLeaf: WorkspaceLeaf) => Promise<void>,
    private readonly refreshForFile: (file: TFile, options: { force?: boolean; targetGraphLeaf?: WorkspaceLeaf }) => Promise<void>,
  ) {}

  getMarkdownFileFromLeaf(leaf: WorkspaceLeaf | null): TFile | null {
    if (!(leaf?.view instanceof MarkdownView)) return null;
    return leaf.view.file;
  }

  async openCanvasInRightSidebar(file: TFile, options: OpenGraphCanvasOptions): Promise<void> {
    const leaf =
      options.targetLeaf && this.isLeafInRightSidebar(options.targetLeaf)
        ? options.targetLeaf
        : this.findRightSidebarGeneratedCanvasLeaf() ?? (options.openIfMissing ? this.app.workspace.getRightLeaf(false) : null);
    if (!leaf) {
      if (options.openIfMissing) {
        new Notice("Roam Graph could not open the right sidebar.");
      }
      return;
    }
    this.canvasLeaf = leaf;
    this.managedGraphLeaves.add(leaf);
    await leaf.openFile(file, { active: false });
    if (options.reveal) {
      await this.app.workspace.revealLeaf(leaf);
    }
  }

  async redirectManagedGraphLeafNavigation(): Promise<void> {
    if (this.redirectingCanvasLeaf) return;

    const navigation = this.findManagedGraphLeafNavigation();
    if (!navigation) return;

    this.redirectingCanvasLeaf = true;
    try {
      const targetLeaf = this.getMainWorkspaceLeaf();
      await targetLeaf.openFile(navigation.file, { active: true });
      if (navigation.file.path === this.getCurrentCenterPath()) {
        await this.restoreCanvasInLeaf(navigation.leaf);
        return;
      }
      await this.refreshForFile(navigation.file, { force: true, targetGraphLeaf: navigation.leaf });
    } finally {
      this.redirectingCanvasLeaf = false;
    }
  }

  isLeafInRightSidebar(leaf: WorkspaceLeaf): boolean {
    let item: unknown = leaf;
    while (item && typeof item === "object") {
      if (item === this.app.workspace.rightSplit) {
        return true;
      }
      item = "parent" in item ? (item as { parent?: unknown }).parent : null;
    }
    return false;
  }

  getMainWorkspaceMarkdownFile(): TFile | null {
    const recentLeaf = this.app.workspace.getMostRecentLeaf(this.app.workspace.rootSplit);
    const recentFile = this.getMarkdownFileFromLeaf(recentLeaf);
    if (recentFile) return recentFile;

    let firstMarkdownFile: TFile | null = null;
    this.app.workspace.iterateRootLeaves((leaf) => {
      firstMarkdownFile ??= this.getMarkdownFileFromLeaf(leaf);
    });
    return firstMarkdownFile;
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
