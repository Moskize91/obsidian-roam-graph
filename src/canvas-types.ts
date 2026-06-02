export type CanvasFileNode = {
  id: string;
  type: "file";
  file: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
};

export type CanvasTextNode = {
  id: string;
  type: "text";
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
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
