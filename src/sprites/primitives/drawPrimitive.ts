import type { Primitive } from "./Primitive.js";

export function drawPrimitive(ctx: CanvasRenderingContext2D, primitive: Primitive): void {
  ctx.save();

  ctx.translate(primitive.x, primitive.y);
  ctx.rotate(degreesToRadians(primitive.rotation));
  ctx.fillStyle = rgbaToCss(primitive.color);

  if (primitive.kind === "rect") {
    ctx.fillRect(-primitive.w / 2, -primitive.h / 2, primitive.w, primitive.h);
  }

  if (primitive.kind === "circle") {
    const radiusX = primitive.w / 2;
    const radiusY = primitive.h > 0 ? primitive.h / 2 : primitive.w / 2;

    ctx.beginPath();
    ctx.ellipse(0, 0, radiusX, radiusY, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  if (primitive.kind === "triangle") {
    ctx.beginPath();
    ctx.moveTo(0, -primitive.h / 2);
    ctx.lineTo(primitive.w / 2, primitive.h / 2);
    ctx.lineTo(-primitive.w / 2, primitive.h / 2);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function rgbaToCss(rgba: string): string {
  const normalizedRgba = /^[0-9a-f]{8}$/.test(rgba) ? rgba : "000000ff";
  const red = Number.parseInt(normalizedRgba.slice(0, 2), 16);
  const green = Number.parseInt(normalizedRgba.slice(2, 4), 16);
  const blue = Number.parseInt(normalizedRgba.slice(4, 6), 16);
  const alpha = Number.parseInt(normalizedRgba.slice(6, 8), 16) / 255;

  return `rgb(${red} ${green} ${blue} / ${alpha})`;
}
