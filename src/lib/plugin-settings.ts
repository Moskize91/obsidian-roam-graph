export const PLUGIN_ID = "roam-graph";
export const GRAPH_CANVAS_FILE_NAME = "Roam Graph.canvas";
const INTERNAL_EXPERIMENT_CANVAS_PATH = `.obsidian/plugins/${PLUGIN_ID}/${GRAPH_CANVAS_FILE_NAME}`;
const HIDDEN_EXPERIMENT_CANVAS_PATH = `.roam-graph/${GRAPH_CANVAS_FILE_NAME}`;
const UNDERSCORE_EXPERIMENT_CANVAS_PATH = `_roam-graph/${GRAPH_CANVAS_FILE_NAME}`;
const LEGACY_DEFAULT_NEIGHBOR_LIMIT = 18;

export type PluginSettings = {
  graphFolderPath: string;
  layerLimitCount: number;
  dailyContextLimit: number;
};

type RawPluginSettings = Partial<PluginSettings>;
type LegacyRawPluginSettings = RawPluginSettings & {
  canvasPath?: string;
  neighborLimit?: number;
  neighborExpandStep?: number;
  includeBacklinks?: boolean;
  includeOutgoingLinks?: boolean;
  openCanvasOnStartup?: boolean;
  debounceMs?: number;
};

export function getDefaultPluginSettings(): PluginSettings {
  return {
    graphFolderPath: "",
    layerLimitCount: 4,
    dailyContextLimit: 2,
  };
}

export function normalizePluginSettings(raw: LegacyRawPluginSettings | null | undefined): PluginSettings {
  const defaults = getDefaultPluginSettings();
  const graphFolderPath =
    typeof raw?.graphFolderPath === "string"
      ? normalizeFolderPath(raw.graphFolderPath)
      : normalizeFolderPath(getFolderPathFromLegacyCanvasPath(raw?.canvasPath));
  const rawLayerLimitCount =
    raw?.layerLimitCount ?? (raw?.neighborLimit === LEGACY_DEFAULT_NEIGHBOR_LIMIT ? undefined : raw?.neighborLimit);
  const layerLimitCount = clampInteger(rawLayerLimitCount, defaults.layerLimitCount, 1, 20);
  const dailyContextLimit = clampInteger(raw?.dailyContextLimit, defaults.dailyContextLimit, 0, 20);

  return {
    graphFolderPath,
    layerLimitCount,
    dailyContextLimit,
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
