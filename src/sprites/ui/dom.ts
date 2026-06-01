export function getCanvasContext(target: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = target.getContext("2d");

  if (!context) {
    throw new Error("Canvas 2D context is not available");
  }

  return context;
}
