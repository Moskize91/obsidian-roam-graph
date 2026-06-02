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
  mtime: number;
};

export type GraphCanvasInput = {
  center: GraphNeighbor;
  backlinks: GraphNeighbor[];
  outgoing: GraphNeighbor[];
  neighborLimit: number;
  neighborExpandStep: number;
  expandedCounts: ReadonlyMap<GraphSide, number>;
  buildExpandUrl: (side: GraphSide) => string;
};

export type GraphSide = "backlinks" | "outgoing";

const CENTER_NODE_ID = "center";
const LEFT_COLUMN_X = -560;
const CENTER_COLUMN_X = 0;
const RIGHT_COLUMN_X = 560;
const NODE_GAP_Y = 80;
const EXPAND_NODE_GAP_Y = 64;
const EMPTY_NODE_WIDTH = 320;
const EMPTY_NODE_HEIGHT = 120;
const EXPAND_NODE_WIDTH = 300;
const EXPAND_NODE_HEIGHT = 120;
const NEIGHBOR_SIZE_RANGE = {
  minWidth: 260,
  maxWidth: 420,
  minHeight: 160,
  maxHeight: 460,
};
const CENTER_SIZE_RANGE = {
  minWidth: 420,
  maxWidth: 560,
  minHeight: 460,
  maxHeight: 800,
};

export function buildGraphCanvas(input: GraphCanvasInput): CanvasData {
  const backlinks = sortNeighborsNewestFirst(input.backlinks);
  const outgoing = sortNeighborsNewestFirst(input.outgoing);
  const backlinkSkeleton = backlinks.slice(0, input.neighborLimit);
  const outgoingSkeleton = outgoing.slice(0, input.neighborLimit);
  const sizeScale = buildSizeScale([input.center, ...backlinkSkeleton, ...outgoingSkeleton]);
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

  const backlinkColumn = buildSideColumn({
    side: "backlinks",
    prefix: "backlink",
    neighbors: backlinks,
    columnX: LEFT_COLUMN_X,
    sizeScale,
    neighborLimit: input.neighborLimit,
    neighborExpandStep: input.neighborExpandStep,
    expandedCount: input.expandedCounts.get("backlinks") ?? 0,
    buildExpandUrl: input.buildExpandUrl,
  });
  const outgoingColumn = buildSideColumn({
    side: "outgoing",
    prefix: "outgoing",
    neighbors: outgoing,
    columnX: RIGHT_COLUMN_X,
    sizeScale,
    neighborLimit: input.neighborLimit,
    neighborExpandStep: input.neighborExpandStep,
    expandedCount: input.expandedCounts.get("outgoing") ?? 0,
    buildExpandUrl: input.buildExpandUrl,
  });
  nodes.push(...backlinkColumn.nodes, ...outgoingColumn.nodes);

  backlinkColumn.nodes.forEach((node) => {
    edges.push({
      id: `edge-${node.id}`,
      fromNode: node.id,
      fromSide: "right",
      toNode: CENTER_NODE_ID,
      toSide: "left",
    });
  });

  outgoingColumn.nodes.forEach((node) => {
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

type SideColumnInput = {
  side: GraphSide;
  prefix: string;
  neighbors: GraphNeighbor[];
  columnX: number;
  sizeScale: SizeScale;
  neighborLimit: number;
  neighborExpandStep: number;
  expandedCount: number;
  buildExpandUrl: (side: GraphSide) => string;
};

type SideColumn = {
  nodes: CanvasNode[];
};

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

function buildSideColumn(input: SideColumnInput): SideColumn {
  const skeletonNeighbors = input.neighbors.slice(0, input.neighborLimit);
  const overflowNeighbors = input.neighbors.slice(input.neighborLimit);
  const expandedCount = Math.max(0, Math.round(input.expandedCount));
  const visibleOverflowCount = Math.min(expandedCount, overflowNeighbors.length);
  const visibleOverflowNeighbors = overflowNeighbors.slice(0, visibleOverflowCount);
  const hiddenCount = overflowNeighbors.length - visibleOverflowCount;
  const expandStep = Math.max(1, Math.round(input.neighborExpandStep));
  const skeletonNodes = buildFileNodes(input.prefix, skeletonNeighbors, input.columnX, input.sizeScale, 0);
  const nodes: CanvasNode[] = [...skeletonNodes];

  const skeletonHeight = getColumnHeight(skeletonNodes, NODE_GAP_Y);
  let y = -skeletonHeight / 2;
  for (const node of skeletonNodes) {
    node.y = Math.round(y);
    y += node.height + NODE_GAP_Y;
  }

  let appendY = skeletonNodes.length > 0 ? y - NODE_GAP_Y + EXPAND_NODE_GAP_Y : EXPAND_NODE_GAP_Y;
  const overflowNodes = buildFileNodes(input.prefix, visibleOverflowNeighbors, input.columnX, input.sizeScale, skeletonNodes.length);
  for (const node of overflowNodes) {
    node.y = Math.round(appendY);
    appendY += node.height + NODE_GAP_Y;
    nodes.push(node);
  }

  if (hiddenCount > 0) {
    nodes.push(buildExpandNode(input.side, hiddenCount, expandStep, input.columnX, appendY, input.buildExpandUrl(input.side)));
  }

  return { nodes };
}

function sortNeighborsNewestFirst(neighbors: GraphNeighbor[]): GraphNeighbor[] {
  return [...neighbors].sort((a, b) => {
    if (a.mtime !== b.mtime) return b.mtime - a.mtime;
    return a.path.localeCompare(b.path);
  });
}

function buildFileNodes(
  prefix: string,
  neighbors: GraphNeighbor[],
  columnX: number,
  sizeScale: SizeScale,
  indexOffset: number,
): CanvasFileNode[] {
  return neighbors.map((neighbor, index) => {
    const size = getNodeSize(neighbor, NEIGHBOR_SIZE_RANGE, sizeScale);
    return {
      id: `${prefix}-${index + indexOffset + 1}`,
      type: "file" as const,
      file: neighbor.path,
      x: Math.round(columnX - size.width / 2),
      y: 0,
      width: size.width,
      height: size.height,
    };
  });
}

function buildExpandNode(
  side: GraphSide,
  hiddenCount: number,
  expandStep: number,
  columnX: number,
  y: number,
  expandUrl: string,
): CanvasTextNode {
  const label = side === "backlinks" ? "backlinks" : "outgoing links";
  const nextCount = Math.min(expandStep, hiddenCount);
  return {
    id: `${side}-expand`,
    type: "text",
    text: `${hiddenCount} more ${label}\n\n[Show ${nextCount} more](${expandUrl})`,
    x: Math.round(columnX - EXPAND_NODE_WIDTH / 2),
    y: Math.round(y),
    width: EXPAND_NODE_WIDTH,
    height: EXPAND_NODE_HEIGHT,
  };
}

function getColumnHeight(nodes: CanvasNode[], gap: number): number {
  return nodes.reduce((total, node) => total + node.height, 0) + Math.max(nodes.length - 1, 0) * gap;
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
  const ratio = clampRatio((logSize - scale.minLogSize) / (scale.maxLogSize - scale.minLogSize));
  return minValue + ratio * (maxValue - minValue);
}

function clampRatio(value: number): number {
  return Math.min(1, Math.max(0, value));
}
