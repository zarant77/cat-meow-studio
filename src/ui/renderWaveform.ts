import { generateSoundSamples } from "../audio/soundGenerator.js";
import type { SoundProject } from "../model/soundProject.js";
import { createElement } from "./dom.js";

const canvasWidth = 960;
const canvasHeight = 112;
const verticalPadding = 14;

export function renderWaveform(project: SoundProject): HTMLCanvasElement {
  return renderWaveformSamples(generateSoundSamples(project));
}

export function renderWaveformSamples(samples: Float32Array): HTMLCanvasElement {
  const canvas = createElement("canvas", "waveform-canvas");
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  canvas.setAttribute("aria-label", "Generated sound waveform");

  const context = canvas.getContext("2d");

  if (context === null) {
    return canvas;
  }

  drawWaveform(context, samples);

  return canvas;
}

function drawWaveform(context: CanvasRenderingContext2D, samples: Float32Array): void {
  context.clearRect(0, 0, canvasWidth, canvasHeight);
  drawCenterLine(context);

  if (samples.length === 0) {
    return;
  }

  context.beginPath();
  context.strokeStyle = getCanvasColor("--color-accent", "#ffc71c");
  context.lineWidth = 2;
  context.lineJoin = "round";
  context.lineCap = "round";

  const centerY = canvasHeight / 2;
  const amplitude = centerY - verticalPadding;
  const pointCount = Math.min(canvasWidth, Math.max(2, samples.length));

  for (let pointIndex = 0; pointIndex < pointCount; pointIndex += 1) {
    const x = pointCount === 1 ? 0 : (pointIndex / (pointCount - 1)) * (canvasWidth - 1);
    const sample = getSampleForPoint(samples, pointIndex, pointCount);
    const y = centerY - sample * amplitude;

    if (pointIndex === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  }

  context.stroke();
}

function drawCenterLine(context: CanvasRenderingContext2D): void {
  const centerY = canvasHeight / 2;

  context.beginPath();
  context.strokeStyle = getCanvasColor("--color-border-strong", "rgba(255, 199, 28, 0.35)");
  context.globalAlpha = 0.45;
  context.lineWidth = 1;
  context.moveTo(0, centerY);
  context.lineTo(canvasWidth, centerY);
  context.stroke();
  context.globalAlpha = 1;
}

function getSampleForPoint(samples: Float32Array, pointIndex: number, pointCount: number): number {
  if (samples.length <= pointCount) {
    const sampleIndex = Math.min(samples.length - 1, pointIndex);
    return samples[sampleIndex] ?? 0;
  }

  const startIndex = Math.floor((pointIndex / pointCount) * samples.length);
  const endIndex = Math.max(startIndex + 1, Math.floor(((pointIndex + 1) / pointCount) * samples.length));
  let peakSample = 0;

  for (let sampleIndex = startIndex; sampleIndex < endIndex; sampleIndex += 1) {
    const sample = samples[sampleIndex] ?? 0;

    if (Math.abs(sample) > Math.abs(peakSample)) {
      peakSample = sample;
    }
  }

  return peakSample;
}

function getCanvasColor(customPropertyName: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(customPropertyName).trim();

  return value.length > 0 ? value : fallback;
}
