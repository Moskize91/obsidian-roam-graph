import type { App, ReferenceCache, TFile } from "obsidian";
import type { GraphNeighbor } from "./canvas";

export type ResolveGraphOptions = {
  includeOutgoingLinks: boolean;
  includeBacklinks: boolean;
};

export type ResolvedGraph = {
  backlinks: GraphNeighbor[];
  outgoing: GraphNeighbor[];
};

type NeighborRelation = {
  path: string;
  size: number;
  mtime: number;
  count?: number;
  firstOffset?: number;
};

export function resolveNeighbors(app: App, centerFile: TFile, options: ResolveGraphOptions): ResolvedGraph {
  const outgoing = options.includeOutgoingLinks ? resolveOutgoingLinks(app, centerFile) : [];
  const outgoingPaths = new Set(outgoing.map((item) => item.path));
  const backlinks = options.includeBacklinks
    ? resolveBacklinks(app, centerFile, {
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
    mtime: file.stat.mtime,
  };
}

function resolveOutgoingLinks(app: App, centerFile: TFile): GraphNeighbor[] {
  const byPath = new Map<string, NeighborRelation>();
  const cache = app.metadataCache.getFileCache(centerFile);
  const references = cache?.links ?? [];
  for (const reference of references) {
    const file = app.metadataCache.getFirstLinkpathDest(reference.link, centerFile.path);
    if (!isMarkdownFile(file) || file.path === centerFile.path) continue;
    addOutgoingRelation(byPath, file, reference);
  }

  return sortOutgoingRelations(byPath);
}

function resolveBacklinks(
  app: App,
  centerFile: TFile,
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

  return sortBacklinkRelations(byPath);
}

function getNeighborRelation(file: TFile): NeighborRelation {
  return {
    path: file.path,
    size: file.stat.size,
    mtime: file.stat.mtime,
  };
}

function addOutgoingRelation(byPath: Map<string, NeighborRelation>, file: TFile, reference: ReferenceCache): void {
  const existing = byPath.get(file.path);
  if (existing) {
    existing.count = (existing.count ?? 0) + 1;
    existing.firstOffset = Math.min(existing.firstOffset ?? reference.position.start.offset, reference.position.start.offset);
    return;
  }
  byPath.set(file.path, {
    ...getNeighborRelation(file),
    count: 1,
    firstOffset: reference.position.start.offset,
  });
}

function sortOutgoingRelations(byPath: Map<string, NeighborRelation>): GraphNeighbor[] {
  return [...byPath.values()]
    .sort((a, b) => {
      const countDiff = (b.count ?? 0) - (a.count ?? 0);
      if (countDiff !== 0) return countDiff;
      const offsetDiff = (a.firstOffset ?? Number.MAX_SAFE_INTEGER) - (b.firstOffset ?? Number.MAX_SAFE_INTEGER);
      if (offsetDiff !== 0) return offsetDiff;
      return a.path.localeCompare(b.path);
    })
    .map(toGraphNeighbor);
}

function sortBacklinkRelations(byPath: Map<string, NeighborRelation>): GraphNeighbor[] {
  return [...byPath.values()]
    .sort((a, b) => {
      if (a.mtime !== b.mtime) return b.mtime - a.mtime;
      return a.path.localeCompare(b.path);
    })
    .map(toGraphNeighbor);
}

function toGraphNeighbor({ path, size, mtime }: NeighborRelation): GraphNeighbor {
  return { path, size, mtime };
}

function isMarkdownFile(file: unknown): file is TFile {
  return Boolean(file && typeof file === "object" && "extension" in file && file.extension === "md");
}
