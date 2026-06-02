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
  size: number;
};

export type GraphCanvasInput = {
  center: GraphNeighbor;
  backlinks: GraphNeighbor[];
  outgoing: GraphNeighbor[];
};

const CENTER_NODE_ID = "center";
const LEFT_COLUMN_X = -560;
const CENTER_COLUMN_X = 0;
const RIGHT_COLUMN_X = 560;
const NODE_GAP_Y = 80;
const EMPTY_NODE_WIDTH = 320;
const EMPTY_NODE_HEIGHT = 120;
const NEIGHBOR_SIZE_RANGE = {
  minWidth: 260,
  maxWidth: 420,
  minHeight: 160,
  maxHeight: 300,
};
const CENTER_SIZE_RANGE = {
  minWidth: 360,
  maxWidth: 520,
  minHeight: 240,
  maxHeight: 380,
};

export function buildGraphCanvas(input: GraphCanvasInput): CanvasData {
  const sizeScale = buildSizeScale([input.center, ...input.backlinks, ...input.outgoing]);
  const centerSize = getNodeSize(input.center, CENTER_SIZE_RANGE, sizeScale);
  const center: CanvasFileNode = {
    id: CENTER_NODE_ID,
    type: "file",
    file: input.center.path,
    x: Math.round(CENTER_COLUMN_X - centerSize.width / 2),
    y: Math.round(-centerSize.height / 2),
    width: centerSize.width,
    height: centerSize.height,
  };

  const nodes: CanvasNode[] = [center];
  const edges: CanvasEdge[] = [];

  const backlinkNodes = buildNeighborColumn("backlink", input.backlinks, LEFT_COLUMN_X, sizeScale);
  const outgoingNodes = buildNeighborColumn("outgoing", input.outgoing, RIGHT_COLUMN_X, sizeScale);
  nodes.push(...backlinkNodes, ...outgoingNodes);

  backlinkNodes.forEach((node) => {
    edges.push({
      id: `edge-${node.id}`,
      fromNode: node.id,
      fromSide: "right",
      toNode: CENTER_NODE_ID,
      toSide: "left",
    });
  });

  outgoingNodes.forEach((node) => {
    edges.push({
      id: `edge-${node.id}`,
      fromNode: CENTER_NODE_ID,
      fromSide: "right",
      toNode: node.id,
      toSide: "left",
    });
  });

  if (input.backlinks.length === 0 && input.outgoing.length === 0) {
    nodes.push({
      id: "empty",
      type: "text",
      text: "No linked notes found.",
      x: Math.round(RIGHT_COLUMN_X - EMPTY_NODE_WIDTH / 2),
      y: Math.round(-EMPTY_NODE_HEIGHT / 2),
      width: EMPTY_NODE_WIDTH,
      height: EMPTY_NODE_HEIGHT,
    });
  }

  return { nodes, edges };
}

type NodeSizeRange = {
  minWidth: number;
  maxWidth: number;
  minHeight: number;
  maxHeight: number;
};

type NodeSize = {
  width: number;
  height: number;
};

type SizeScale = {
  minLogSize: number;
  maxLogSize: number;
};

function buildNeighborColumn(prefix: string, neighbors: GraphNeighbor[], columnX: number, sizeScale: SizeScale): CanvasFileNode[] {
  const nodes = neighbors.map((neighbor, index) => {
    const size = getNodeSize(neighbor, NEIGHBOR_SIZE_RANGE, sizeScale);
    return {
      id: `${prefix}-${index + 1}`,
      type: "file" as const,
      file: neighbor.path,
      x: Math.round(columnX - size.width / 2),
      y: 0,
      width: size.width,
      height: size.height,
    };
  });

  const columnHeight = nodes.reduce((total, node) => total + node.height, 0) + Math.max(nodes.length - 1, 0) * NODE_GAP_Y;
  let y = -columnHeight / 2;
  for (const node of nodes) {
    node.y = Math.round(y);
    y += node.height + NODE_GAP_Y;
  }
  return nodes;
}

function buildSizeScale(nodes: GraphNeighbor[]): SizeScale {
  const logSizes = nodes.map((node) => Math.log(Math.max(node.size, 0) + 1));
  return {
    minLogSize: Math.min(...logSizes),
    maxLogSize: Math.max(...logSizes),
  };
}

function getNodeSize(node: GraphNeighbor, range: NodeSizeRange, scale: SizeScale): NodeSize {
  const width = interpolateByLogSize(node.size, range.minWidth, range.maxWidth, scale);
  const height = interpolateByLogSize(node.size, range.minHeight, range.maxHeight, scale);
  return {
    width: Math.round(width),
    height: Math.round(height),
  };
}

function interpolateByLogSize(size: number, minValue: number, maxValue: number, scale: SizeScale): number {
  if (scale.maxLogSize === scale.minLogSize) {
    return (minValue + maxValue) / 2;
  }
  const logSize = Math.log(Math.max(size, 0) + 1);
  const ratio = (logSize - scale.minLogSize) / (scale.maxLogSize - scale.minLogSize);
  return minValue + ratio * (maxValue - minValue);
}
