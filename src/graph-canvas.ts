import type { CanvasData, CanvasEdge, CanvasFileNode, CanvasNode, CanvasTextNode } from "./canvas-types";
import type { DailyContext, GraphFile, GraphSide } from "./graph-model";

export type GraphCanvasInput = {
  center: GraphFile;
  backlinks: GraphFile[];
  outgoing: GraphFile[];
  dailyContext: DailyContext;
  layerLimitCount: number;
  expandedLayerCounts: ReadonlyMap<GraphSide, number>;
  buildExpandUrl: (side: GraphSide) => string;
};

const CENTER_NODE_ID = "center";
const CENTER_COLUMN_X = 0;
const INNER_LAYER_GAP_X = 216;
const LAYER_GAP_X = 173;
const NODE_GAP_Y = 80;
const DAILY_NODE_GAP_Y = 96;
const EXPAND_NODE_WIDTH = 300;
const EXPAND_NODE_HEIGHT = 120;
const NODE_COLORS = {
  center: "#7951ED",
  backlinks: "#07B64F",
  outgoing: "#EC7600",
};
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
  const layerLimitCount = Math.max(1, Math.round(input.layerLimitCount));
  const backlinks = sortNeighborsNewestFirst(input.backlinks);
  const outgoing = input.outgoing;
  const backlinkLayers = buildNeighborLayers(backlinks, layerLimitCount);
  const outgoingLayers = buildNeighborLayers(outgoing, layerLimitCount);
  const dailyContext = {
    previous: input.dailyContext.previous,
    next: input.dailyContext.next,
  };
  const dailyContextNodes = [...dailyContext.previous, ...dailyContext.next];
  const sizeScale = buildSizeScale([input.center, ...(backlinkLayers[0] ?? []), ...(outgoingLayers[0] ?? []), ...dailyContextNodes]);
  const centerSize = getNodeSize(input.center, CENTER_SIZE_RANGE, sizeScale);
  const center: CanvasFileNode = {
    id: CENTER_NODE_ID,
    type: "file",
    file: input.center.path,
    x: Math.round(CENTER_COLUMN_X - centerSize.width / 2),
    y: Math.round(-centerSize.height / 2),
    width: centerSize.width,
    height: centerSize.height,
    color: NODE_COLORS.center,
  };

  const nodes: CanvasNode[] = [center];
  const edges: CanvasEdge[] = [];
  const dailyColumn = buildDailyColumn({
    previous: dailyContext.previous,
    next: dailyContext.next,
    center,
    sizeScale,
  });

  const backlinkColumn = buildSideLayers({
    side: "backlinks",
    prefix: "backlink",
    layers: backlinkLayers,
    center,
    sizeScale,
    expandedLayerCount: input.expandedLayerCounts.get("backlinks") ?? 0,
    buildExpandUrl: input.buildExpandUrl,
  });
  const outgoingColumn = buildSideLayers({
    side: "outgoing",
    prefix: "outgoing",
    layers: outgoingLayers,
    center,
    sizeScale,
    expandedLayerCount: input.expandedLayerCounts.get("outgoing") ?? 0,
    buildExpandUrl: input.buildExpandUrl,
  });
  nodes.push(...dailyColumn.nodes, ...backlinkColumn.nodes, ...outgoingColumn.nodes);
  edges.push(...dailyColumn.edges);

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

  return { nodes, edges };
}

type SideLayerInput = {
  side: GraphSide;
  prefix: string;
  layers: GraphFile[][];
  center: CanvasFileNode;
  sizeScale: SizeScale;
  expandedLayerCount: number;
  buildExpandUrl: (side: GraphSide) => string;
};

type SideColumn = {
  nodes: CanvasNode[];
};

type DailyColumnInput = {
  previous: GraphFile[];
  next: GraphFile[];
  center: CanvasFileNode;
  sizeScale: SizeScale;
};

type DailyColumn = {
  nodes: CanvasFileNode[];
  edges: CanvasEdge[];
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

function buildSideLayers(input: SideLayerInput): SideColumn {
  const expandedLayerCount = Math.max(0, Math.round(input.expandedLayerCount));
  const visibleLayerCount = Math.min(input.layers.length, input.layers.length === 0 ? 0 : expandedLayerCount + 1);
  const nodes: CanvasNode[] = [];
  let indexOffset = 0;
  let edgeX = getFirstLayerEdgeX(input.side, input.center);
  let previousLayerMaxWidth = 0;

  for (let layerIndex = 0; layerIndex < visibleLayerCount; layerIndex += 1) {
    if (layerIndex > 0) {
      edgeX = getNextLayerEdgeX(input.side, edgeX, previousLayerMaxWidth);
    }
    const layerNodes = buildFileNodes(input.prefix, input.layers[layerIndex] ?? [], input.side, edgeX, input.sizeScale, indexOffset);
    positionLayerNodes(layerNodes, input.side, edgeX);
    nodes.push(...layerNodes);
    previousLayerMaxWidth = getMaxNodeWidth(layerNodes);
    indexOffset += layerNodes.length;
  }

  if (input.layers.length > visibleLayerCount) {
    edgeX = getNextLayerEdgeX(input.side, edgeX, previousLayerMaxWidth);
    const hiddenCount = input.layers.slice(visibleLayerCount).reduce((total, layer) => total + layer.length, 0);
    const nextLayerCount = input.layers[visibleLayerCount]?.length ?? 0;
    const expandNode = buildExpandNode(input.side, hiddenCount, nextLayerCount, edgeX, input.buildExpandUrl(input.side));
    positionLayerNodes([expandNode], input.side, edgeX);
    nodes.push(expandNode);
  }

  return { nodes };
}

function buildNeighborLayers(neighbors: GraphFile[], layerLimitCount: number): GraphFile[][] {
  const layers: GraphFile[][] = [];
  for (let index = 0; index < neighbors.length; index += layerLimitCount) {
    layers.push(neighbors.slice(index, index + layerLimitCount));
  }
  return layers;
}

function buildDailyColumn(input: DailyColumnInput): DailyColumn {
  const newerNodes = buildDailyFileNodes(
    "daily-next",
    [...input.next].reverse(),
    input.center.x + input.center.width / 2,
    input.sizeScale,
    0,
  );
  const olderNodes = buildDailyFileNodes(
    "daily-previous",
    [...input.previous].reverse(),
    input.center.x + input.center.width / 2,
    input.sizeScale,
    newerNodes.length,
  );
  positionDailyColumn(newerNodes, input.center, olderNodes);
  return {
    nodes: [...newerNodes, ...olderNodes],
    edges: buildDailyEdges(newerNodes, input.center, olderNodes),
  };
}

function buildDailyFileNodes(
  prefix: string,
  neighbors: GraphFile[],
  centerX: number,
  sizeScale: SizeScale,
  indexOffset: number,
): CanvasFileNode[] {
  return neighbors.map((neighbor, index) => {
    const size = getNodeSize(neighbor, NEIGHBOR_SIZE_RANGE, sizeScale);
    return {
      id: `${prefix}-${index + indexOffset + 1}`,
      type: "file" as const,
      file: neighbor.path,
      x: Math.round(centerX - size.width / 2),
      y: 0,
      width: size.width,
      height: size.height,
    };
  });
}

function positionDailyColumn(newerNodes: CanvasFileNode[], center: CanvasFileNode, olderNodes: CanvasFileNode[]): void {
  let newerY = center.y - DAILY_NODE_GAP_Y;
  for (let index = newerNodes.length - 1; index >= 0; index -= 1) {
    const node = newerNodes[index];
    if (!node) continue;
    newerY -= node.height;
    node.y = Math.round(newerY);
    newerY -= DAILY_NODE_GAP_Y;
  }

  let olderY = center.y + center.height + DAILY_NODE_GAP_Y;
  for (const node of olderNodes) {
    node.y = Math.round(olderY);
    olderY += node.height + DAILY_NODE_GAP_Y;
  }
}

function buildDailyEdges(newerNodes: CanvasFileNode[], center: CanvasFileNode, olderNodes: CanvasFileNode[]): CanvasEdge[] {
  const orderedNodes: Array<CanvasFileNode | typeof center> = [...newerNodes, center, ...olderNodes];
  const edges: CanvasEdge[] = [];
  for (let index = 0; index < orderedNodes.length - 1; index += 1) {
    const fromNode = orderedNodes[index];
    const toNode = orderedNodes[index + 1];
    if (!fromNode || !toNode) continue;
    edges.push({
      id: `edge-daily-${fromNode.id}-${toNode.id}`,
      fromNode: fromNode.id,
      fromSide: "bottom",
      toNode: toNode.id,
      toSide: "top",
    });
  }
  return edges;
}

function getFirstLayerEdgeX(side: GraphSide, center: CanvasFileNode): number {
  return side === "backlinks" ? center.x - INNER_LAYER_GAP_X : center.x + center.width + INNER_LAYER_GAP_X;
}

function getNextLayerEdgeX(side: GraphSide, currentEdgeX: number, previousLayerMaxWidth: number): number {
  return side === "backlinks"
    ? currentEdgeX - previousLayerMaxWidth - LAYER_GAP_X
    : currentEdgeX + previousLayerMaxWidth + LAYER_GAP_X;
}

function sortNeighborsNewestFirst(neighbors: GraphFile[]): GraphFile[] {
  return [...neighbors].sort((a, b) => {
    if (a.mtime !== b.mtime) return b.mtime - a.mtime;
    return a.path.localeCompare(b.path);
  });
}

function buildFileNodes(
  prefix: string,
  neighbors: GraphFile[],
  side: GraphSide,
  edgeX: number,
  sizeScale: SizeScale,
  indexOffset: number,
): CanvasFileNode[] {
  return neighbors.map((neighbor, index) => {
    const size = getNodeSize(neighbor, NEIGHBOR_SIZE_RANGE, sizeScale);
    return {
      id: `${prefix}-${index + indexOffset + 1}`,
      type: "file" as const,
      file: neighbor.path,
      x: getNodeX(side, edgeX, size.width),
      y: 0,
      width: size.width,
      height: size.height,
      color: NODE_COLORS[side],
    };
  });
}

function buildExpandNode(
  side: GraphSide,
  hiddenCount: number,
  nextLayerCount: number,
  edgeX: number,
  expandUrl: string,
): CanvasTextNode {
  const label = side === "backlinks" ? "backlinks" : "outgoing links";
  return {
    id: `${side}-expand`,
    type: "text",
    text: `${hiddenCount} more ${label}\n\n[Show ${nextLayerCount} more](${expandUrl})`,
    x: getNodeX(side, edgeX, EXPAND_NODE_WIDTH),
    y: 0,
    width: EXPAND_NODE_WIDTH,
    height: EXPAND_NODE_HEIGHT,
    color: NODE_COLORS[side],
  };
}

function positionLayerNodes(nodes: CanvasNode[], side: GraphSide, edgeX: number): void {
  const layerHeight = getLayerHeight(nodes, NODE_GAP_Y);
  let y = -layerHeight / 2;
  for (const node of nodes) {
    node.x = getNodeX(side, edgeX, node.width);
    node.y = Math.round(y);
    y += node.height + NODE_GAP_Y;
  }
}

function getNodeX(side: GraphSide, edgeX: number, width: number): number {
  return Math.round(side === "backlinks" ? edgeX - width : edgeX);
}

function getMaxNodeWidth(nodes: CanvasNode[]): number {
  return nodes.reduce((maxWidth, node) => Math.max(maxWidth, node.width), 0);
}

function getLayerHeight(nodes: CanvasNode[], gap: number): number {
  return nodes.reduce((total, node) => total + node.height, 0) + Math.max(nodes.length - 1, 0) * gap;
}

function buildSizeScale(nodes: GraphFile[]): SizeScale {
  const logSizes = nodes.map((node) => Math.log(Math.max(node.size, 0) + 1));
  return {
    minLogSize: Math.min(...logSizes),
    maxLogSize: Math.max(...logSizes),
  };
}

function getNodeSize(node: GraphFile, range: NodeSizeRange, scale: SizeScale): NodeSize {
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
