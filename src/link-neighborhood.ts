import type { App, CachedMetadata, ReferenceCache, TFile } from "obsidian";
import type { GraphFile, LinkNeighborhood, LinkRelation, LinkStrength } from "./graph-model";

export type ResolveLinkNeighborhoodOptions = {
  includeOutgoingLinks: boolean;
  includeBacklinks: boolean;
};

type NeighborRelation = {
  path: string;
  size: number;
  mtime: number;
  count?: number;
  firstOffset?: number;
  outgoingStrength?: LinkStrength;
  backlinkStrength?: LinkStrength;
};

type LinkReference = {
  reference: ReferenceCache;
  isEmbed: boolean;
};

export function resolveLinkNeighborhood(
  app: App,
  centerFile: TFile,
  options: ResolveLinkNeighborhoodOptions,
): LinkNeighborhood {
  const outgoing = options.includeOutgoingLinks ? resolveOutgoingLinks(app, centerFile) : [];
  const backlinks = options.includeBacklinks ? resolveBacklinks(app, centerFile) : [];
  const outgoingPaths = new Set(outgoing.map((item) => item.path));
  const backlinkByPath = new Map(backlinks.map((item) => [item.path, item]));

  return {
    backlinks: backlinks.filter((item) => !outgoingPaths.has(item.path)),
    outgoing: outgoing.map((item) => {
      const backlink = backlinkByPath.get(item.path);
      return backlink
        ? toBidirectionalRelation(item, backlink.backlinkStrength ?? "weak")
        : item;
    }),
  };
}

export function getGraphFile(file: TFile): GraphFile {
  return {
    path: file.path,
    size: file.stat.size,
    mtime: file.stat.mtime,
  };
}

function resolveOutgoingLinks(app: App, centerFile: TFile): LinkRelation[] {
  const byPath = new Map<string, NeighborRelation>();
  const cache = app.metadataCache.getFileCache(centerFile);
  const references = getLinkReferences(cache);
  for (const { reference, isEmbed } of references) {
    const file = resolveLinkDestination(app, reference.link, centerFile.path);
    if (!isMarkdownFile(file) || file.path === centerFile.path) continue;
    addOutgoingRelation(byPath, file, reference, getReferenceStrength(reference, isEmbed));
  }

  return sortOutgoingRelations(byPath);
}

function resolveBacklinks(app: App, centerFile: TFile): LinkRelation[] {
  const byPath = new Map<string, NeighborRelation>();
  for (const [sourcePath, targets] of Object.entries(app.metadataCache.resolvedLinks)) {
    if (!(centerFile.path in targets)) continue;
    const file = app.vault.getAbstractFileByPath(sourcePath);
    if (!isMarkdownFile(file) || file.path === centerFile.path) continue;
    byPath.set(file.path, {
      ...getNeighborRelation(file),
      backlinkStrength: resolveReferenceStrength(app, file, centerFile) ?? "weak",
    });
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

function addOutgoingRelation(
  byPath: Map<string, NeighborRelation>,
  file: TFile,
  reference: ReferenceCache,
  strength: LinkStrength,
): void {
  const existing = byPath.get(file.path);
  if (existing) {
    existing.count = (existing.count ?? 0) + 1;
    existing.firstOffset = Math.min(existing.firstOffset ?? reference.position.start.offset, reference.position.start.offset);
    existing.outgoingStrength = strongestLinkStrength(existing.outgoingStrength, strength);
    return;
  }
  byPath.set(file.path, {
    ...getNeighborRelation(file),
    count: 1,
    firstOffset: reference.position.start.offset,
    outgoingStrength: strength,
  });
}

function sortOutgoingRelations(byPath: Map<string, NeighborRelation>): LinkRelation[] {
  return [...byPath.values()]
    .sort((a, b) => {
      const countDiff = (b.count ?? 0) - (a.count ?? 0);
      if (countDiff !== 0) return countDiff;
      const offsetDiff = (a.firstOffset ?? Number.MAX_SAFE_INTEGER) - (b.firstOffset ?? Number.MAX_SAFE_INTEGER);
      if (offsetDiff !== 0) return offsetDiff;
      return a.path.localeCompare(b.path);
    })
    .map((relation) => ({
      ...toGraphFile(relation),
      direction: "outgoing",
      outgoingStrength: relation.outgoingStrength ?? "weak",
    }));
}

function sortBacklinkRelations(byPath: Map<string, NeighborRelation>): LinkRelation[] {
  return [...byPath.values()]
    .sort((a, b) => {
      if (a.mtime !== b.mtime) return b.mtime - a.mtime;
      return a.path.localeCompare(b.path);
    })
    .map((relation) => ({
      ...toGraphFile(relation),
      direction: "backlink",
      backlinkStrength: relation.backlinkStrength ?? "weak",
    }));
}

function toGraphFile({ path, size, mtime }: NeighborRelation): GraphFile {
  return { path, size, mtime };
}

function toBidirectionalRelation(relation: LinkRelation, backlinkStrength: LinkStrength): LinkRelation {
  return {
    ...relation,
    direction: "bidirectional",
    backlinkStrength,
  };
}

function getLinkReferences(cache: CachedMetadata | null): LinkReference[] {
  return [
    ...(cache?.links ?? []).map((reference) => ({ reference, isEmbed: false })),
    ...(cache?.embeds ?? []).map((reference) => ({ reference, isEmbed: true })),
  ];
}

function resolveReferenceStrength(app: App, sourceFile: TFile, targetFile: TFile): LinkStrength | null {
  const cache = app.metadataCache.getFileCache(sourceFile);
  let strength: LinkStrength | null = null;
  for (const { reference, isEmbed } of getLinkReferences(cache)) {
    const file = resolveLinkDestination(app, reference.link, sourceFile.path);
    if (!isMarkdownFile(file) || file.path !== targetFile.path) continue;
    strength = strongestLinkStrength(strength, getReferenceStrength(reference, isEmbed));
  }
  return strength;
}

function getReferenceStrength(reference: ReferenceCache, isEmbed: boolean): LinkStrength {
  return isEmbed || hasSubpath(reference.link) ? "strong" : "weak";
}

function strongestLinkStrength(current: LinkStrength | null | undefined, next: LinkStrength): LinkStrength {
  return current === "strong" || next === "strong" ? "strong" : "weak";
}

function hasSubpath(link: string): boolean {
  return link.includes("#");
}

function resolveLinkDestination(app: App, link: string, sourcePath: string): TFile | null {
  const file = app.metadataCache.getFirstLinkpathDest(stripSubpath(link), sourcePath);
  return isMarkdownFile(file) ? file : null;
}

function stripSubpath(link: string): string {
  return link.split("#", 1)[0] ?? link;
}

function isMarkdownFile(file: unknown): file is TFile {
  return Boolean(file && typeof file === "object" && "extension" in file && file.extension === "md");
}
