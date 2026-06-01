import type { App, TFile } from "obsidian";
import type { GraphNeighbor } from "./canvas";

export type ResolveGraphOptions = {
  includeOutgoingLinks: boolean;
  includeBacklinks: boolean;
  limit: number;
};

type MutableNeighbor = {
  path: string;
  outgoing: boolean;
  backlink: boolean;
};

export function resolveNeighbors(app: App, centerFile: TFile, options: ResolveGraphOptions): GraphNeighbor[] {
  const byPath = new Map<string, MutableNeighbor>();

  if (options.includeOutgoingLinks) {
    addOutgoingLinks(app, centerFile, byPath);
  }
  if (options.includeBacklinks) {
    addBacklinks(app, centerFile, byPath);
  }

  return [...byPath.values()]
    .sort((a, b) => {
      const aScore = Number(a.outgoing) + Number(a.backlink);
      const bScore = Number(b.outgoing) + Number(b.backlink);
      if (aScore !== bScore) return bScore - aScore;
      return a.path.localeCompare(b.path);
    })
    .slice(0, options.limit)
    .map((item) => ({
      path: item.path,
      direction: item.outgoing && item.backlink ? "bidirectional" : item.outgoing ? "outgoing" : "backlink",
    }));
}

function addOutgoingLinks(app: App, centerFile: TFile, byPath: Map<string, MutableNeighbor>): void {
  const resolved = app.metadataCache.resolvedLinks[centerFile.path] ?? {};
  for (const path of Object.keys(resolved)) {
    const file = app.vault.getAbstractFileByPath(path);
    if (!isMarkdownFile(file) || file.path === centerFile.path) continue;
    const item = byPath.get(file.path) ?? { path: file.path, outgoing: false, backlink: false };
    item.outgoing = true;
    byPath.set(file.path, item);
  }
}

function addBacklinks(app: App, centerFile: TFile, byPath: Map<string, MutableNeighbor>): void {
  for (const [sourcePath, targets] of Object.entries(app.metadataCache.resolvedLinks)) {
    if (!(centerFile.path in targets)) continue;
    const file = app.vault.getAbstractFileByPath(sourcePath);
    if (!isMarkdownFile(file) || file.path === centerFile.path) continue;
    const item = byPath.get(file.path) ?? { path: file.path, outgoing: false, backlink: false };
    item.backlink = true;
    byPath.set(file.path, item);
  }
}

function isMarkdownFile(file: unknown): file is TFile {
  return Boolean(file && typeof file === "object" && "extension" in file && file.extension === "md");
}
