export type GraphFile = {
  path: string;
  size: number;
  mtime: number;
};

export type GraphSide = "backlinks" | "outgoing";

export type LinkNeighborhood = {
  backlinks: GraphFile[];
  outgoing: GraphFile[];
};

export type DailyContext = {
  previous: GraphFile[];
  next: GraphFile[];
};
