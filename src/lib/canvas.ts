export type CanvasFileNode = {
  id: string;
  type: "file";
  file: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CanvasTextNode = {
  id: string;
  type: "text";
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CanvasNode = CanvasFileNode | CanvasTextNode;

export type CanvasEdge = {
  id: string;
  fromNode: string;
  fromSide: "top" | "right" | "bottom" | "left";
  toNode: string;
  toSide: "top" | "right" | "bottom" | "left";
};

export type CanvasData = {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
};

export type GraphNeighbor = {
  path: string;
  direction: "outgoing" | "backlink" | "bidirectional";
};

export type GraphCanvasInput = {
  centerPath: string;
  neighbors: GraphNeighbor[];
};

const CENTER_NODE_ID = "center";
const CENTER_WIDTH = 460;
const CENTER_HEIGHT = 320;
const NEIGHBOR_WIDTH = 300;
const NEIGHBOR_HEIGHT = 220;
const RADIUS_X = 680;
const RADIUS_Y = 480;

export function buildGraphCanvas(input: GraphCanvasInput): CanvasData {
  const center: CanvasFileNode = {
    id: CENTER_NODE_ID,
    type: "file",
    file: input.centerPath,
    x: -CENTER_WIDTH / 2,
    y: -CENTER_HEIGHT / 2,
    width: CENTER_WIDTH,
    height: CENTER_HEIGHT,
  };

  const nodes: CanvasNode[] = [center];
  const edges: CanvasEdge[] = [];

  input.neighbors.forEach((neighbor, index) => {
    const angle = (Math.PI * 2 * index) / Math.max(input.neighbors.length, 1) - Math.PI / 2;
    const x = Math.round(Math.cos(angle) * RADIUS_X - NEIGHBOR_WIDTH / 2);
    const y = Math.round(Math.sin(angle) * RADIUS_Y - NEIGHBOR_HEIGHT / 2);
    const id = `neighbor-${index + 1}`;

    nodes.push({
      id,
      type: "file",
      file: neighbor.path,
      x,
      y,
      width: NEIGHBOR_WIDTH,
      height: NEIGHBOR_HEIGHT,
    });

    const sides = getConnectionSides(angle);
    const edge = buildEdge(id, neighbor.direction, sides);
    edges.push(edge);
  });

  if (input.neighbors.length === 0) {
    nodes.push({
      id: "empty",
      type: "text",
      text: "No linked notes found.",
      x: 320,
      y: -80,
      width: 320,
      height: 120,
    });
  }

  return { nodes, edges };
}

function buildEdge(
  neighborNodeId: string,
  direction: GraphNeighbor["direction"],
  sides: { centerSide: CanvasEdge["fromSide"]; neighborSide: CanvasEdge["toSide"] },
): CanvasEdge {
  if (direction === "backlink") {
    return {
      id: `edge-${neighborNodeId}`,
      fromNode: neighborNodeId,
      fromSide: sides.neighborSide,
      toNode: CENTER_NODE_ID,
      toSide: sides.centerSide,
    };
  }

  return {
    id: `edge-${neighborNodeId}`,
    fromNode: CENTER_NODE_ID,
    fromSide: sides.centerSide,
    toNode: neighborNodeId,
    toSide: sides.neighborSide,
  };
}

function getConnectionSides(angle: number): { centerSide: CanvasEdge["fromSide"]; neighborSide: CanvasEdge["toSide"] } {
  const normalized = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

  if (normalized >= Math.PI / 4 && normalized < (Math.PI * 3) / 4) {
    return { centerSide: "bottom", neighborSide: "top" };
  }
  if (normalized >= (Math.PI * 3) / 4 && normalized < (Math.PI * 5) / 4) {
    return { centerSide: "left", neighborSide: "right" };
  }
  if (normalized >= (Math.PI * 5) / 4 && normalized < (Math.PI * 7) / 4) {
    return { centerSide: "top", neighborSide: "bottom" };
  }
  return { centerSide: "right", neighborSide: "left" };
}
