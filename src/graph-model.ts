export type GraphFile = {
  path: string;
  size: number;
  mtime: number;
};

export type GraphSide = "backlinks" | "outgoing";

export type LinkStrength = "weak" | "strong";

export type LinkRelationDirection = "backlink" | "outgoing" | "bidirectional";

export type LinkRelation = GraphFile & {
  direction: LinkRelationDirection;
  outgoingStrength?: LinkStrength;
  backlinkStrength?: LinkStrength;
};

export type LinkNeighborhood = {
  backlinks: LinkRelation[];
  outgoing: LinkRelation[];
};

export type DailyContext = {
  previous: GraphFile[];
  next: GraphFile[];
};
