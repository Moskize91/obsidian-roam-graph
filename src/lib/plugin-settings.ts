export const PLUGIN_ID = "roam-graph";

export type PluginSettings = {
  canvasPath: string;
  neighborLimit: number;
  includeBacklinks: boolean;
  includeOutgoingLinks: boolean;
  openCanvasOnStartup: boolean;
  debounceMs: number;
};

type RawPluginSettings = Partial<PluginSettings>;

export function getDefaultPluginSettings(): PluginSettings {
  return {
    canvasPath: "Roam Graph.canvas",
    neighborLimit: 18,
    includeBacklinks: true,
    includeOutgoingLinks: true,
    openCanvasOnStartup: true,
    debounceMs: 150,
  };
}

export function normalizePluginSettings(raw: RawPluginSettings | null | undefined): PluginSettings {
  const defaults = getDefaultPluginSettings();
  const canvasPath =
    typeof raw?.canvasPath === "string" && raw.canvasPath.trim().length > 0
      ? ensureCanvasExtension(raw.canvasPath.trim())
      : defaults.canvasPath;
  const neighborLimit = clampInteger(raw?.neighborLimit, defaults.neighborLimit, 1, 80);
  const debounceMs = clampInteger(raw?.debounceMs, defaults.debounceMs, 0, 2000);

  return {
    canvasPath,
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

function clampInteger(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(value)));
}
