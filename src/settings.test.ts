import { describe, expect, it } from "vitest";
import { ensureCanvasExtension, getCanvasPathFromFolderPath, normalizePluginSettings } from "./settings";

describe("normalizePluginSettings", () => {
  it("uses defaults for empty settings", () => {
    expect(normalizePluginSettings(null)).toEqual({
      graphFolderPath: "",
      layerLimitCount: 4,
      dailyContextLimit: 2,
    });
  });

  it("normalizes folder paths and clamps numeric settings", () => {
    expect(
      normalizePluginSettings({
        graphFolderPath: " /Daily\\Graphs/ ",
        layerLimitCount: 99,
        dailyContextLimit: -3,
      }),
    ).toEqual({
      graphFolderPath: "Daily/Graphs",
      layerLimitCount: 20,
      dailyContextLimit: 0,
    });
  });

  it("migrates legacy canvas paths to graph folder paths", () => {
    expect(
      normalizePluginSettings({
        canvasPath: "Graphs/Local.canvas",
        neighborLimit: 8,
      }),
    ).toEqual({
      graphFolderPath: "Graphs",
      layerLimitCount: 8,
      dailyContextLimit: 2,
    });
  });

  it("ignores legacy experimental canvas paths", () => {
    expect(normalizePluginSettings({ canvasPath: ".roam-graph/Roam Graph.canvas" }).graphFolderPath).toBe("");
  });

  it("keeps the new default layer limit when migrating the legacy default neighbor limit", () => {
    expect(normalizePluginSettings({ neighborLimit: 18 }).layerLimitCount).toBe(4);
  });
});

describe("getCanvasPathFromFolderPath", () => {
  it("uses the vault root when no folder is configured", () => {
    expect(getCanvasPathFromFolderPath("")).toBe("Roam Graph.canvas");
  });

  it("builds the generated canvas path inside the configured folder", () => {
    expect(getCanvasPathFromFolderPath(" Graphs\\Local ")).toBe("Graphs/Local/Roam Graph.canvas");
  });
});

describe("ensureCanvasExtension", () => {
  it("adds the canvas extension only when it is missing", () => {
    expect(ensureCanvasExtension("Graph")).toBe("Graph.canvas");
    expect(ensureCanvasExtension("Graph.canvas")).toBe("Graph.canvas");
  });
});
