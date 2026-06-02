import type { App, TFile } from "obsidian";
import type { GraphNeighbor } from "./canvas";

export type ResolveGraphOptions = {
  includeOutgoingLinks: boolean;
  includeBacklinks: boolean;
  limit: number;
};

export type ResolvedGraph = {
  backlinks: GraphNeighbor[];
  outgoing: GraphNeighbor[];
};

type NeighborRelation = {
  path: string;
  size: number;
  mtime: number;
};

export function resolveNeighbors(app: App, centerFile: TFile, options: ResolveGraphOptions): ResolvedGraph {
  const outgoing = options.includeOutgoingLinks ? resolveOutgoingLinks(app, centerFile, options.limit) : [];
  const outgoingPaths = new Set(outgoing.map((item) => item.path));
  const backlinks = options.includeBacklinks
    ? resolveBacklinks(app, centerFile, options.limit, {
        excludePaths: outgoingPaths,
      })
    : [];

  return {
    backlinks,
    outgoing,
  };
}

export function getGraphFileInfo(file: TFile): GraphNeighbor {
  return {
    path: file.path,
    size: file.stat.size,
  };
}

function resolveOutgoingLinks(app: App, centerFile: TFile, limit: number): GraphNeighbor[] {
  const byPath = new Map<string, NeighborRelation>();
  const resolved = app.metadataCache.resolvedLinks[centerFile.path] ?? {};
  for (const path of Object.keys(resolved)) {
    const file = app.vault.getAbstractFileByPath(path);
    if (!isMarkdownFile(file) || file.path === centerFile.path) continue;
    byPath.set(file.path, getNeighborRelation(file));
  }

  return sortAndLimitRelations(byPath, limit);
}

function resolveBacklinks(
  app: App,
  centerFile: TFile,
  limit: number,
  options: { excludePaths: ReadonlySet<string> },
): GraphNeighbor[] {
  const byPath = new Map<string, NeighborRelation>();
  for (const [sourcePath, targets] of Object.entries(app.metadataCache.resolvedLinks)) {
    if (!(centerFile.path in targets)) continue;
    const file = app.vault.getAbstractFileByPath(sourcePath);
    if (!isMarkdownFile(file) || file.path === centerFile.path) continue;
    if (options.excludePaths.has(file.path)) continue;
    byPath.set(file.path, getNeighborRelation(file));
  }

  return sortAndLimitRelations(byPath, limit);
}

function getNeighborRelation(file: TFile): NeighborRelation {
  return {
    path: file.path,
    size: file.stat.size,
    mtime: file.stat.mtime,
  };
}

function sortAndLimitRelations(byPath: Map<string, NeighborRelation>, limit: number): GraphNeighbor[] {
  return [...byPath.values()]
    .sort((a, b) => {
      if (a.mtime !== b.mtime) return b.mtime - a.mtime;
      return a.path.localeCompare(b.path);
    })
    .slice(0, limit)
    .map(({ path, size }) => ({ path, size }));
}

function isMarkdownFile(file: unknown): file is TFile {
  return Boolean(file && typeof file === "object" && "extension" in file && file.extension === "md");
}
