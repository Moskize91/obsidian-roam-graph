import { describe, expect, it } from "vitest";
import { buildGraphCanvas } from "./graph-canvas";
import type { GraphFile, GraphSide, LinkRelation } from "./graph-model";

function graphFile(path: string, size: number, mtime: number): GraphFile {
  return { path, size, mtime };
}

function outgoing(path: string, size: number, mtime: number, strength: "weak" | "strong" = "weak"): LinkRelation {
  return { ...graphFile(path, size, mtime), direction: "outgoing", outgoingStrength: strength };
}

function backlink(path: string, size: number, mtime: number, strength: "weak" | "strong" = "weak"): LinkRelation {
  return { ...graphFile(path, size, mtime), direction: "backlink", backlinkStrength: strength };
}

function bidirectional(
  path: string,
  size: number,
  mtime: number,
  outgoingStrength: "weak" | "strong" = "weak",
  backlinkStrength: "weak" | "strong" = "weak",
): LinkRelation {
  return { ...graphFile(path, size, mtime), direction: "bidirectional", outgoingStrength, backlinkStrength };
}

describe("buildGraphCanvas", () => {
  it("builds a centered canvas with backlinks, outgoing links, daily context, and expand nodes", () => {
    const canvas = buildGraphCanvas({
      center: graphFile("Center.md", 1000, 500),
      backlinks: [backlink("Back Old.md", 100, 100), backlink("Back New.md", 200, 200)],
      outgoing: [outgoing("Out A.md", 300, 300), outgoing("Out B.md", 400, 400), outgoing("Out C.md", 500, 500)],
      dailyContext: {
        previous: [graphFile("Daily/2026-06-01.md", 150, 150)],
        next: [graphFile("Daily/2026-06-03.md", 250, 250)],
      },
      layerLimitCount: 1,
      expandedLayerCounts: new Map<GraphSide, number>([["backlinks", 0]]),
      buildExpandUrl: (side) => `obsidian://roam-graph?side=${side}`,
    });

    expect(canvas.nodes.find((node) => node.id === "center")).toMatchObject({
      type: "file",
      file: "Center.md",
      color: "#7951ED",
    });
    expect(canvas.nodes.find((node) => node.id === "backlink-1")).toMatchObject({
      type: "file",
      file: "Back New.md",
      color: "#07B64F",
    });
    expect(canvas.nodes.find((node) => node.id === "outgoing-1")).toMatchObject({
      type: "file",
      file: "Out A.md",
      color: "#EC7600",
    });
    expect(canvas.nodes.find((node) => node.id === "daily-next-1")).toMatchObject({
      type: "file",
      file: "Daily/2026-06-03.md",
    });
    expect(canvas.nodes.find((node) => node.id === "outgoing-expand")).toMatchObject({
      type: "text",
      text: expect.stringContaining("2 more outgoing links"),
    });
    expect(canvas.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fromNode: "backlink-1", toNode: "center" }),
        expect.objectContaining({ fromNode: "center", toNode: "outgoing-1" }),
        expect.objectContaining({ fromNode: "center", toNode: "outgoing-expand" }),
        expect.objectContaining({ fromNode: "daily-next-1", toNode: "center" }),
      ]),
    );
  });

  it("shows additional layers according to expanded layer counts", () => {
    const canvas = buildGraphCanvas({
      center: graphFile("Center.md", 1000, 500),
      backlinks: [],
      outgoing: [outgoing("Out A.md", 300, 300), outgoing("Out B.md", 400, 400)],
      dailyContext: { previous: [], next: [] },
      layerLimitCount: 1,
      expandedLayerCounts: new Map<GraphSide, number>([["outgoing", 1]]),
      buildExpandUrl: (side) => `obsidian://roam-graph?side=${side}`,
    });

    expect(canvas.nodes.find((node) => node.id === "outgoing-2")).toMatchObject({
      type: "file",
      file: "Out B.md",
    });
    expect(canvas.nodes.some((node) => node.id === "outgoing-expand")).toBe(false);
  });

  it("uses the midpoint size when all visible files have the same size", () => {
    const canvas = buildGraphCanvas({
      center: graphFile("Center.md", 100, 500),
      backlinks: [],
      outgoing: [],
      dailyContext: { previous: [], next: [] },
      layerLimitCount: 1,
      expandedLayerCounts: new Map(),
      buildExpandUrl: (side) => `obsidian://roam-graph?side=${side}`,
    });

    expect(canvas.nodes.find((node) => node.id === "center")).toMatchObject({
      width: 490,
      height: 630,
    });
  });

  it("styles relation edges by link strength and marks bidirectional edges with arrows on both ends", () => {
    const canvas = buildGraphCanvas({
      center: graphFile("Center.md", 1000, 500),
      backlinks: [backlink("Weak Back.md", 100, 200), backlink("Strong Back.md", 200, 100, "strong")],
      outgoing: [
        outgoing("Weak Out.md", 300, 300),
        outgoing("Strong Out.md", 400, 400, "strong"),
        bidirectional("Both.md", 500, 500, "weak", "strong"),
      ],
      dailyContext: { previous: [], next: [] },
      layerLimitCount: 10,
      expandedLayerCounts: new Map(),
      buildExpandUrl: (side) => `obsidian://roam-graph?side=${side}`,
    });

    expect(canvas.edges.find((edge) => edge.id === "edge-backlink-1")).toMatchObject({
      fromNode: "backlink-1",
      toNode: "center",
    });
    expect(canvas.edges.find((edge) => edge.id === "edge-backlink-1")).not.toHaveProperty("color");
    expect(canvas.edges.find((edge) => edge.id === "edge-backlink-2")).toMatchObject({
      color: "#07B64F",
    });
    expect(canvas.edges.find((edge) => edge.id === "edge-outgoing-1")).not.toHaveProperty("color");
    expect(canvas.edges.find((edge) => edge.id === "edge-outgoing-2")).toMatchObject({
      color: "#EC7600",
    });
    expect(canvas.edges.find((edge) => edge.id === "edge-outgoing-3")).toMatchObject({
      fromEnd: "arrow",
      toEnd: "arrow",
      color: "#EC7600",
    });
    expect(canvas.nodes.find((node) => node.id === "backlink-1")).toMatchObject({
      color: "#07B64F",
    });
    expect(canvas.nodes.find((node) => node.id === "backlink-2")).toMatchObject({
      color: "#07B64F",
    });
    expect(canvas.nodes.find((node) => node.id === "outgoing-3")).toMatchObject({
      color: "#EC7600",
    });
  });
});
