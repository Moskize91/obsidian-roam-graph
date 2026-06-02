export const PLUGIN_ID = "roam-graph";
export const GRAPH_CANVAS_FILE_NAME = "Roam Graph.canvas";
const INTERNAL_EXPERIMENT_CANVAS_PATH = `.obsidian/plugins/${PLUGIN_ID}/${GRAPH_CANVAS_FILE_NAME}`;
const HIDDEN_EXPERIMENT_CANVAS_PATH = `.roam-graph/${GRAPH_CANVAS_FILE_NAME}`;
const UNDERSCORE_EXPERIMENT_CANVAS_PATH = `_roam-graph/${GRAPH_CANVAS_FILE_NAME}`;
const LEGACY_DEFAULT_NEIGHBOR_LIMIT = 18;

export type PluginSettings = {
  graphFolderPath: string;
  neighborLimit: number;
  includeBacklinks: boolean;
  includeOutgoingLinks: boolean;
  openCanvasOnStartup: boolean;
  debounceMs: number;
};

type RawPluginSettings = Partial<PluginSettings>;
type LegacyRawPluginSettings = RawPluginSettings & {
  canvasPath?: string;
};

export function getDefaultPluginSettings(): PluginSettings {
  return {
    graphFolderPath: "",
    neighborLimit: 4,
    includeBacklinks: true,
    includeOutgoingLinks: true,
    openCanvasOnStartup: true,
    debounceMs: 150,
  };
}

export function normalizePluginSettings(raw: LegacyRawPluginSettings | null | undefined): PluginSettings {
  const defaults = getDefaultPluginSettings();
  const graphFolderPath =
    typeof raw?.graphFolderPath === "string"
      ? normalizeFolderPath(raw.graphFolderPath)
      : normalizeFolderPath(getFolderPathFromLegacyCanvasPath(raw?.canvasPath));
  const rawNeighborLimit = raw?.neighborLimit === LEGACY_DEFAULT_NEIGHBOR_LIMIT ? undefined : raw?.neighborLimit;
  const neighborLimit = clampInteger(rawNeighborLimit, defaults.neighborLimit, 1, 20);
  const debounceMs = clampInteger(raw?.debounceMs, defaults.debounceMs, 0, 2000);

  return {
    graphFolderPath,
    neighborLimit,
    includeBacklinks: raw?.includeBacklinks ?? defaults.includeBacklinks,
    includeOutgoingLinks: raw?.includeOutgoingLinks ?? defaults.includeOutgoingLinks,
    openCanvasOnStartup: raw?.openCanvasOnStartup ?? defaults.openCanvasOnStartup,
    debounceMs,
  };
}

export function ensureCanvasExtension(path: string): string {
  return path.endsWith(".canvas") ? path : `${path}.canvas`;
}

export function getCanvasPathFromFolderPath(folderPath: string): string {
  const normalizedFolderPath = normalizeFolderPath(folderPath);
  return normalizedFolderPath ? `${normalizedFolderPath}/${GRAPH_CANVAS_FILE_NAME}` : GRAPH_CANVAS_FILE_NAME;
}

function getFolderPathFromLegacyCanvasPath(path: unknown): string {
  if (typeof path !== "string") return "";
  const canvasPath = ensureCanvasExtension(path.trim());
  if (
    !canvasPath ||
    canvasPath === GRAPH_CANVAS_FILE_NAME ||
    canvasPath === INTERNAL_EXPERIMENT_CANVAS_PATH ||
    canvasPath === HIDDEN_EXPERIMENT_CANVAS_PATH ||
    canvasPath === UNDERSCORE_EXPERIMENT_CANVAS_PATH
  ) {
    return "";
  }
  const parts = canvasPath.split("/");
  parts.pop();
  return parts.join("/");
}

function normalizeFolderPath(path: string | undefined): string {
  return (path ?? "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "");
}

function clampInteger(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(value)));
}
