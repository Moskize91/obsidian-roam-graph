import { describe, expect, it, vi } from "vitest";
import { ensureGraphCanvasFile, writeCanvasFile } from "./canvas-file";
import type { TFile as ObsidianTFile, TFolder as ObsidianTFolder } from "obsidian";

vi.mock("obsidian", () => {
  class TFile {
    constructor(
      readonly path: string,
      readonly extension: string,
    ) {}
  }

  class TFolder {
    constructor(readonly path: string) {}
  }

  return {
    normalizePath: (path: string) => path.replace(/\\/g, "/").replace(/\/+/g, "/"),
    TFile,
    TFolder,
  };
});

type FakeVault = {
  getAbstractFileByPath: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  createFolder: ReturnType<typeof vi.fn>;
  modify: ReturnType<typeof vi.fn>;
};

function app(vault: Partial<FakeVault>) {
  return {
    vault: {
      getAbstractFileByPath: vi.fn(() => null),
      create: vi.fn(),
      createFolder: vi.fn(),
      modify: vi.fn(),
      ...vault,
    },
  };
}

async function fakeFile(path: string, extension: string): Promise<ObsidianTFile> {
  const { TFile } = await import("obsidian");
  const item = new TFile();
  Object.assign(item, { path, extension });
  return item;
}

async function fakeFolder(path: string): Promise<ObsidianTFolder> {
  const { TFolder } = await import("obsidian");
  const item = new TFolder();
  Object.assign(item, { path });
  return item;
}

describe("ensureGraphCanvasFile", () => {
  it("returns an existing canvas file", async () => {
    const existing = await fakeFile("Roam Graph.canvas", "canvas");
    const fakeApp = app({
      getAbstractFileByPath: vi.fn(() => existing),
    });

    await expect(ensureGraphCanvasFile(fakeApp as never, "Roam Graph.canvas")).resolves.toBe(existing);
    expect(fakeApp.vault.create).not.toHaveBeenCalled();
  });

  it("rejects an existing non-canvas file at the graph path", async () => {
    const existing = await fakeFile("Roam Graph.md", "md");
    const fakeApp = app({
      getAbstractFileByPath: vi.fn(() => existing),
    });

    await expect(ensureGraphCanvasFile(fakeApp as never, "Roam Graph.md")).rejects.toThrow("not a canvas file");
  });

  it("rejects an existing folder at the graph path", async () => {
    const existing = await fakeFolder("Graphs");
    const fakeApp = app({
      getAbstractFileByPath: vi.fn(() => existing),
    });

    await expect(ensureGraphCanvasFile(fakeApp as never, "Graphs")).rejects.toThrow("points to a folder");
  });

  it("creates missing parent folders and the initial canvas file", async () => {
    const created = await fakeFile("Graphs/Nested/Roam Graph.canvas", "canvas");
    const existingByPath = new Map<string, unknown>();
    const fakeApp = app({
      getAbstractFileByPath: vi.fn((path: string) => existingByPath.get(path) ?? null),
      createFolder: vi.fn(async (path: string) => {
        existingByPath.set(path, await fakeFolder(path));
      }),
      create: vi.fn(async () => created),
    });

    await expect(ensureGraphCanvasFile(fakeApp as never, "Graphs/Nested/Roam Graph.canvas")).resolves.toBe(created);
    expect(fakeApp.vault.createFolder).toHaveBeenCalledWith("Graphs");
    expect(fakeApp.vault.createFolder).toHaveBeenCalledWith("Graphs/Nested");
    expect(fakeApp.vault.create).toHaveBeenCalledWith("Graphs/Nested/Roam Graph.canvas", '{\n  "nodes": [],\n  "edges": []\n}\n');
  });

  it("tolerates already-exists races while creating parent folders", async () => {
    const created = await fakeFile("Graphs/Roam Graph.canvas", "canvas");
    const fakeApp = app({
      createFolder: vi.fn(async () => {
        throw new Error("Already exists");
      }),
      create: vi.fn(async () => created),
    });

    await expect(ensureGraphCanvasFile(fakeApp as never, "Graphs/Roam Graph.canvas")).resolves.toBe(created);
  });

  it("propagates unexpected folder creation errors", async () => {
    const fakeApp = app({
      createFolder: vi.fn(async () => {
        throw new Error("permission denied");
      }),
    });

    await expect(ensureGraphCanvasFile(fakeApp as never, "Graphs/Roam Graph.canvas")).rejects.toThrow("permission denied");
  });
});

describe("writeCanvasFile", () => {
  it("writes formatted canvas JSON", async () => {
    const file = await fakeFile("Roam Graph.canvas", "canvas");
    const fakeApp = app({});

    await writeCanvasFile(fakeApp as never, file as never, {
      nodes: [{ id: "center", type: "file", file: "Center.md", x: 0, y: 0, width: 100, height: 100 }],
      edges: [],
    });

    expect(fakeApp.vault.modify).toHaveBeenCalledWith(
      file,
      '{\n  "nodes": [\n    {\n      "id": "center",\n      "type": "file",\n      "file": "Center.md",\n      "x": 0,\n      "y": 0,\n      "width": 100,\n      "height": 100\n    }\n  ],\n  "edges": []\n}\n',
    );
  });
});
