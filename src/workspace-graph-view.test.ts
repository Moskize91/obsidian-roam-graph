import { describe, expect, it, vi } from "vitest";
import { WorkspaceGraphView } from "./workspace-graph-view";
import type { TFile as ObsidianTFile, WorkspaceLeaf } from "obsidian";

type FakeLeaf = {
  parent?: unknown;
  view: unknown;
  openFile: ReturnType<typeof vi.fn>;
  getViewState: ReturnType<typeof vi.fn>;
};

async function fakeFile(path: string, extension: string): Promise<ObsidianTFile> {
  const { TFile } = await import("obsidian");
  const item = new TFile();
  Object.assign(item, { path, extension });
  return item;
}

async function markdownView(file: ObsidianTFile): Promise<unknown> {
  const { MarkdownView } = await import("obsidian");
  const MarkdownViewCtor = MarkdownView as unknown as new (file: ObsidianTFile) => unknown;
  return new MarkdownViewCtor(file);
}

function leaf(parent: unknown, view: unknown = {}, stateFile?: string): FakeLeaf {
  const fakeLeaf = {
    parent,
    view,
    openFile: vi.fn(async (file: ObsidianTFile) => {
      fakeLeaf.view = { file };
    }),
    getViewState: vi.fn(() => ({ state: stateFile ? { file: stateFile } : {} })),
  };
  return fakeLeaf;
}

function app(leaves: FakeLeaf[], rootLeaf: FakeLeaf, rightSplit: object) {
  const getRightLeaf = vi.fn<() => WorkspaceLeaf | null>(() => null);
  return {
    workspace: {
      rightSplit,
      rootSplit: {},
      getMostRecentLeaf: vi.fn(() => rootLeaf),
      iterateRootLeaves: vi.fn((callback: (leaf: WorkspaceLeaf) => void) => callback(rootLeaf as unknown as WorkspaceLeaf)),
      iterateAllLeaves: vi.fn((callback: (leaf: WorkspaceLeaf) => void) =>
        leaves.forEach((item) => callback(item as unknown as WorkspaceLeaf)),
      ),
      getLeaf: vi.fn(() => rootLeaf),
      getRightLeaf,
      revealLeaf: vi.fn(),
    },
  };
}

describe("WorkspaceGraphView", () => {
  it("restores the graph canvas without refreshing when the managed graph leaf opens the current center file", async () => {
    const rightSplit = {};
    const canvasFile = await fakeFile("Roam Graph.canvas", "canvas");
    const centerFile = await fakeFile("Center.md", "md");
    const mainLeaf = leaf({}, {});
    const graphLeaf = leaf(rightSplit, { file: canvasFile });
    const refreshForFile = vi.fn();
    const restoreCanvasInLeaf = vi.fn(async (targetLeaf: WorkspaceLeaf) => {
      await targetLeaf.openFile(canvasFile, { active: false });
    });
    const fakeApp = app([mainLeaf, graphLeaf], mainLeaf, rightSplit);
    const view = new WorkspaceGraphView(
      fakeApp as never,
      () => canvasFile.path,
      () => centerFile.path,
      restoreCanvasInLeaf,
      refreshForFile,
    );

    await view.openCanvasInRightSidebar(canvasFile, {
      reveal: false,
      openIfMissing: false,
      targetLeaf: graphLeaf as unknown as WorkspaceLeaf,
    });
    graphLeaf.view = await markdownView(centerFile);
    await view.redirectManagedGraphLeafNavigation();

    expect(mainLeaf.openFile).toHaveBeenCalledWith(centerFile, { active: true });
    expect(restoreCanvasInLeaf).toHaveBeenCalledWith(graphLeaf);
    expect(graphLeaf.openFile).toHaveBeenLastCalledWith(canvasFile, { active: false });
    expect(refreshForFile).not.toHaveBeenCalled();
  });

  it("refreshes the graph when the managed graph leaf opens a different markdown file", async () => {
    const rightSplit = {};
    const canvasFile = await fakeFile("Roam Graph.canvas", "canvas");
    const centerFile = await fakeFile("Center.md", "md");
    const otherFile = await fakeFile("Other.md", "md");
    const mainLeaf = leaf({}, {});
    const graphLeaf = leaf(rightSplit, { file: canvasFile });
    const refreshForFile = vi.fn();
    const restoreCanvasInLeaf = vi.fn();
    const fakeApp = app([mainLeaf, graphLeaf], mainLeaf, rightSplit);
    const view = new WorkspaceGraphView(
      fakeApp as never,
      () => canvasFile.path,
      () => centerFile.path,
      restoreCanvasInLeaf,
      refreshForFile,
    );

    await view.openCanvasInRightSidebar(canvasFile, {
      reveal: false,
      openIfMissing: false,
      targetLeaf: graphLeaf as unknown as WorkspaceLeaf,
    });
    graphLeaf.view = await markdownView(otherFile);
    await view.redirectManagedGraphLeafNavigation();

    expect(mainLeaf.openFile).toHaveBeenCalledWith(otherFile, { active: true });
    expect(refreshForFile).toHaveBeenCalledWith(otherFile, { force: true, targetGraphLeaf: graphLeaf });
    expect(restoreCanvasInLeaf).not.toHaveBeenCalled();
  });

  it("reuses a deferred graph canvas leaf from the right sidebar", async () => {
    const rightSplit = {};
    const canvasFile = await fakeFile("Roam Graph.canvas", "canvas");
    const centerFile = await fakeFile("Center.md", "md");
    const mainLeaf = leaf({}, {});
    const graphLeaf = leaf(rightSplit, {}, canvasFile.path);
    const newRightLeaf = leaf(rightSplit, {});
    const fakeApp = app([mainLeaf, graphLeaf], mainLeaf, rightSplit);
    fakeApp.workspace.getRightLeaf.mockReturnValue(newRightLeaf as unknown as WorkspaceLeaf);
    const view = new WorkspaceGraphView(fakeApp as never, () => canvasFile.path, () => centerFile.path, vi.fn(), vi.fn());

    await view.openCanvasInRightSidebar(canvasFile, {
      reveal: false,
      openIfMissing: true,
    });

    expect(fakeApp.workspace.getRightLeaf).not.toHaveBeenCalled();
    expect(graphLeaf.openFile).toHaveBeenCalledWith(canvasFile, { active: false });
    expect(newRightLeaf.openFile).not.toHaveBeenCalled();
  });
});
