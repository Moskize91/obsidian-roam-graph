import { describe, expect, it } from "vitest";
import { getGraphFile, resolveLinkNeighborhood } from "./link-neighborhood";

type FakeFile = {
  path: string;
  extension: string;
  stat: {
    size: number;
    mtime: number;
  };
};

function file(path: string, size: number, mtime: number): FakeFile {
  return {
    path,
    extension: "md",
    stat: { size, mtime },
  };
}

function app(files: FakeFile[], links: Record<string, string[]>, resolvedLinks: Record<string, Record<string, number>>) {
  const byPath = new Map(files.map((item) => [item.path, item]));
  return {
    metadataCache: {
      resolvedLinks,
      getFileCache: (centerFile: FakeFile) => ({
        links: (links[centerFile.path] ?? []).map((link, index) => ({
          link,
          position: {
            start: {
              offset: index * 10,
            },
          },
        })),
      }),
      getFirstLinkpathDest: (link: string) => byPath.get(link) ?? null,
    },
    vault: {
      getAbstractFileByPath: (path: string) => byPath.get(path) ?? null,
    },
  };
}

describe("getGraphFile", () => {
  it("maps Obsidian file metadata into a graph file", () => {
    expect(getGraphFile(file("Daily/today.md", 123, 456) as never)).toEqual({
      path: "Daily/today.md",
      size: 123,
      mtime: 456,
    });
  });
});

describe("resolveLinkNeighborhood", () => {
  it("resolves outgoing links by count and first position, and excludes duplicate backlinks", () => {
    const center = file("Center.md", 100, 1000);
    const alpha = file("Alpha.md", 20, 200);
    const beta = file("Beta.md", 30, 300);
    const gamma = file("Gamma.md", 40, 900);
    const fakeApp = app(
      [center, alpha, beta, gamma],
      {
        "Center.md": ["Beta.md", "Alpha.md", "Beta.md", "Center.md", "Missing.md"],
      },
      {
        "Alpha.md": { "Center.md": 1 },
        "Gamma.md": { "Center.md": 1 },
        "Center.md": { "Center.md": 1 },
      },
    );

    expect(resolveLinkNeighborhood(fakeApp as never, center as never, { includeOutgoingLinks: true, includeBacklinks: true })).toEqual({
      outgoing: [
        { path: "Beta.md", size: 30, mtime: 300 },
        { path: "Alpha.md", size: 20, mtime: 200 },
      ],
      backlinks: [{ path: "Gamma.md", size: 40, mtime: 900 }],
    });
  });

  it("honors include options", () => {
    const center = file("Center.md", 100, 1000);
    const linked = file("Linked.md", 20, 200);
    const fakeApp = app([center, linked], { "Center.md": ["Linked.md"] }, { "Linked.md": { "Center.md": 1 } });

    expect(resolveLinkNeighborhood(fakeApp as never, center as never, { includeOutgoingLinks: false, includeBacklinks: false })).toEqual({
      outgoing: [],
      backlinks: [],
    });
  });

  it("sorts outgoing links by first reference offset when counts match", () => {
    const center = file("Center.md", 100, 1000);
    const first = file("First.md", 10, 100);
    const second = file("Second.md", 20, 200);
    const fakeApp = app([center, first, second], { "Center.md": ["Second.md", "First.md"] }, {});

    expect(resolveLinkNeighborhood(fakeApp as never, center as never, { includeOutgoingLinks: true, includeBacklinks: false }).outgoing).toEqual([
      { path: "Second.md", size: 20, mtime: 200 },
      { path: "First.md", size: 10, mtime: 100 },
    ]);
  });

  it("sorts backlinks alphabetically when mtimes match", () => {
    const center = file("Center.md", 100, 1000);
    const beta = file("Beta.md", 20, 500);
    const alpha = file("Alpha.md", 10, 500);
    const fakeApp = app([center, beta, alpha], {}, { "Beta.md": { "Center.md": 1 }, "Alpha.md": { "Center.md": 1 } });

    expect(resolveLinkNeighborhood(fakeApp as never, center as never, { includeOutgoingLinks: false, includeBacklinks: true }).backlinks).toEqual([
      { path: "Alpha.md", size: 10, mtime: 500 },
      { path: "Beta.md", size: 20, mtime: 500 },
    ]);
  });
});
