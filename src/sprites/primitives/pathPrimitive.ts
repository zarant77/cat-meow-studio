import type { PathPoint, PathPrimitive, Point, ShapePrimitive } from "./Primitive.js";

export type PathBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export const defaultPathCap: NonNullable<PathPrimitive["cap"]> = "round";
export const defaultPathJoin: NonNullable<PathPrimitive["join"]> = "round";
export const defaultPathSmoothing: NonNullable<PathPrimitive["smoothing"]> = "none";
export const defaultPathSegments = 8;

export function normalizePathPrimitive(path: PathPrimitive): PathPrimitive {
  return {
    kind: "path",
    points: path.points.map((point) => [Math.round(point[0]), Math.round(point[1])]),
    thickness: clampInteger(path.thickness, 1, 256, 1),
    cap: path.cap === "butt" ? "butt" : defaultPathCap,
    join: defaultPathJoin,
    smoothing: path.smoothing === "quadratic" ? "quadratic" : defaultPathSmoothing,
    segments: clampInteger(path.segments ?? defaultPathSegments, 1, 64, defaultPathSegments),
    color: path.color,
  };
}

export function getPathRenderablePoints(path: PathPrimitive): Point[] {
  const normalized = normalizePathPrimitive(path);
  const points = normalized.points.map(([x, y]) => ({ x, y }));

  if (normalized.smoothing !== "quadratic" || points.length < 3) {
    return points;
  }

  return smoothQuadraticPath(points, normalized.segments ?? defaultPathSegments);
}

export function pathToShapePrimitives(path: PathPrimitive): ShapePrimitive[] {
  const normalized = normalizePathPrimitive(path);
  const points = getPathRenderablePoints(normalized);
  const primitives: ShapePrimitive[] = [];

  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];

    if (!start || !end) {
      continue;
    }

    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy);

    if (length <= 0) {
      continue;
    }

    primitives.push({
      kind: "rect",
      x: Math.round((start.x + end.x) / 2),
      y: Math.round((start.y + end.y) / 2),
      w: Math.max(1, Math.round(length)),
      h: normalized.thickness,
      rotation: radiansToDegrees(Math.atan2(dy, dx)),
      color: normalized.color,
    });
  }

  if (normalized.cap === "round" || normalized.join === "round") {
    for (let index = 0; index < points.length; index += 1) {
      const point = points[index];

      if (!point) {
        continue;
      }

      const isEndpoint = index === 0 || index === points.length - 1;

      if (!isEndpoint && normalized.join !== "round") {
        continue;
      }

      if (isEndpoint && normalized.cap !== "round") {
        continue;
      }

      primitives.push({
        kind: "circle",
        x: Math.round(point.x),
        y: Math.round(point.y),
        w: normalized.thickness,
        h: normalized.thickness,
        rotation: 0,
        color: normalized.color,
      });
    }
  }

  return primitives;
}

export function getPathBounds(path: PathPrimitive): PathBounds | null {
  const normalized = normalizePathPrimitive(path);
  const points = getPathRenderablePoints(normalized);

  if (points.length === 0) {
    return null;
  }

  const radius = normalized.thickness / 2;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const point of points) {
    minX = Math.min(minX, point.x - radius);
    minY = Math.min(minY, point.y - radius);
    maxX = Math.max(maxX, point.x + radius);
    maxY = Math.max(maxY, point.y + radius);
  }

  return { minX, minY, maxX, maxY };
}

export function isPointNearPath(point: Point, path: PathPrimitive): boolean {
  const normalized = normalizePathPrimitive(path);
  const points = getPathRenderablePoints(normalized);
  const radius = Math.max(normalized.thickness / 2, 3);

  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];

    if (start && end && distanceToSegment(point, start, end) <= radius) {
      return true;
    }
  }

  return points.some((pathPoint) => getDistance(point, pathPoint) <= radius);
}

export function translatePath(path: PathPrimitive, dx: number, dy: number): void {
  path.points = path.points.map(([x, y]) => [x + dx, y + dy]);
}

export function scalePathFromStart(path: PathPrimitive, start: PathPrimitive, pivot: Point, factor: number): void {
  path.points = start.points.map(([x, y]) => [
    toFiniteInteger(pivot.x + (x - pivot.x) * factor, x),
    toFiniteInteger(pivot.y + (y - pivot.y) * factor, y),
  ]);
  path.thickness = Math.max(1, Math.round(start.thickness * factor));
}

export function rotatePathFromStart(path: PathPrimitive, start: PathPrimitive, pivot: Point, radians: number): void {
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  path.points = start.points.map(([x, y]) => {
    const offsetX = x - pivot.x;
    const offsetY = y - pivot.y;

    return [
      Math.round(pivot.x + offsetX * cos - offsetY * sin),
      Math.round(pivot.y + offsetX * sin + offsetY * cos),
    ];
  });
}

export function pathPointToPoint(point: PathPoint): Point {
  return { x: point[0], y: point[1] };
}

function smoothQuadraticPath(points: Point[], segments: number): Point[] {
  if (points.length < 3) {
    return points;
  }

  const result: Point[] = [points[0]];
  const segmentCount = clampInteger(segments, 1, 64, defaultPathSegments);

  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const next = points[index + 1];

    if (!previous || !current || !next) {
      continue;
    }

    const start = index === 1 ? previous : midpoint(previous, current);
    const end = index === points.length - 2 ? next : midpoint(current, next);

    for (let step = 1; step <= segmentCount; step += 1) {
      result.push(quadraticPoint(start, current, end, step / segmentCount));
    }
  }

  return result;
}

function quadraticPoint(start: Point, control: Point, end: Point, t: number): Point {
  const mt = 1 - t;

  return {
    x: mt * mt * start.x + 2 * mt * t * control.x + t * t * end.x,
    y: mt * mt * start.y + 2 * mt * t * control.y + t * t * end.y,
  };
}

function midpoint(left: Point, right: Point): Point {
  return {
    x: (left.x + right.x) / 2,
    y: (left.y + right.y) / 2,
  };
}

function distanceToSegment(point: Point, start: Point, end: Point): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared <= 0) {
    return getDistance(point, start);
  }

  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  const projection = {
    x: start.x + t * dx,
    y: start.y + t * dy,
  };

  return getDistance(point, projection);
}

function getDistance(left: Point, right: Point): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function radiansToDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

function toFiniteInteger(value: number, fallback: number): number {
  return Number.isFinite(value) ? Math.round(value) : Math.round(fallback);
}

function clampInteger(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(value)));
}
