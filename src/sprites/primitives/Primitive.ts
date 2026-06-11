export type ShapePrimitiveKind = "rect" | "circle" | "triangle";
export type PrimitiveKind = ShapePrimitiveKind | "path";

export type CreateToolKind = PrimitiveKind;

export type EditToolKind = "fill" | "rotate" | "transform" | "scale" | "eyedropper" | "crop";

export type ToolKind = CreateToolKind | EditToolKind | null;

export type ShapePrimitive = {
  kind: ShapePrimitiveKind;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  color: string;
};

export type PathPoint = [number, number];

export type PathPrimitive = {
  kind: "path";
  points: PathPoint[];
  thickness: number;
  cap?: "butt" | "round";
  join?: "round";
  smoothing?: "none" | "quadratic";
  segments?: number;
  color: string;
};

export type Primitive = ShapePrimitive | PathPrimitive;

export type Point = {
  x: number;
  y: number;
};
