import { moment as obsidianMoment, normalizePath, type App, type TFile } from "obsidian";
import type { GraphNeighbor } from "./canvas";
import { getGraphFileInfo } from "./graph";

export type DailyContext = {
  previous: GraphNeighbor[];
  next: GraphNeighbor[];
};

type DailyNotesSettings = {
  folder: string;
  format: string;
};

type DailyNoteEntry = {
  file: TFile;
  time: number;
};

type MomentParser = (input: string, format: string, strict: boolean) => {
  isValid: () => boolean;
  valueOf: () => number;
};

const parseMoment = obsidianMoment as unknown as MomentParser;

export async function resolveDailyContext(app: App, centerFile: TFile, limitPerSide: number): Promise<DailyContext> {
  const contextLimitPerSide = Math.max(0, Math.round(limitPerSide));
  if (contextLimitPerSide === 0) return { previous: [], next: [] };

  const settings = await readDailyNotesSettings(app);
  if (!settings) return { previous: [], next: [] };

  const entries = app.vault
    .getMarkdownFiles()
    .map((file) => getDailyNoteEntry(file, settings))
    .filter((entry): entry is DailyNoteEntry => Boolean(entry))
    .sort((a, b) => {
      if (a.time !== b.time) return a.time - b.time;
      return a.file.path.localeCompare(b.file.path);
    });
  const centerIndex = entries.findIndex((entry) => entry.file.path === centerFile.path);
  if (centerIndex < 0) return { previous: [], next: [] };

  const selected = selectNearbyEntries(entries, centerIndex, contextLimitPerSide);
  return {
    previous: selected.previous.map((entry) => getGraphFileInfo(entry.file)),
    next: selected.next.map((entry) => getGraphFileInfo(entry.file)),
  };
}

async function readDailyNotesSettings(app: App): Promise<DailyNotesSettings | null> {
  const path = normalizePath(`${app.vault.configDir}/daily-notes.json`);
  try {
    const raw = await app.vault.adapter.read(path);
    const parsed = JSON.parse(raw) as Partial<DailyNotesSettings>;
    if (typeof parsed.folder !== "string" || typeof parsed.format !== "string" || !parsed.format.trim()) {
      return null;
    }
    return {
      folder: normalizeFolderPath(parsed.folder),
      format: parsed.format.trim(),
    };
  } catch {
    return null;
  }
}

function getDailyNoteEntry(file: TFile, settings: DailyNotesSettings): DailyNoteEntry | null {
  const relativePath = getDailyNoteRelativePath(file, settings.folder);
  if (!relativePath) return null;

  const parsed = parseMoment(relativePath, settings.format, true);
  if (!parsed.isValid()) return null;

  return {
    file,
    time: parsed.valueOf(),
  };
}

function getDailyNoteRelativePath(file: TFile, folderPath: string): string | null {
  const expectedPrefix = folderPath ? `${folderPath}/` : "";
  if (expectedPrefix && !file.path.startsWith(expectedPrefix)) return null;
  const relativePath = expectedPrefix ? file.path.slice(expectedPrefix.length) : file.path;
  if (!relativePath.endsWith(".md")) return null;
  return relativePath.slice(0, -".md".length);
}

function selectNearbyEntries(
  entries: DailyNoteEntry[],
  centerIndex: number,
  limitPerSide: number,
): { previous: DailyNoteEntry[]; next: DailyNoteEntry[] } {
  return {
    previous: entries.slice(Math.max(0, centerIndex - limitPerSide), centerIndex),
    next: entries.slice(centerIndex + 1, centerIndex + 1 + limitPerSide),
  };
}

function normalizeFolderPath(path: string): string {
  return path
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "");
}
