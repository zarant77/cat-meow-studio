import type { SoundCommand, SoundProject } from "../model/soundProject.js";

export const soundSampleRate = 22050;

const twoPi = Math.PI * 2;

export function generateSoundSamples(project: SoundProject): Float32Array {
  const commandSamples = project.commands.map(generateCommandSamples).filter((samples) => samples.length > 0);
  const totalLength = commandSamples.reduce((length, samples) => length + samples.length, 0);
  const output = new Float32Array(totalLength);
  let writeOffset = 0;

  for (const samples of commandSamples) {
    output.set(samples, writeOffset);
    writeOffset += samples.length;
  }

  return output;
}

function generateCommandSamples(command: SoundCommand): Float32Array {
  if (!Number.isFinite(command.durationMs) || command.durationMs < 1) {
    return new Float32Array(0);
  }

  const sampleCount = Math.round((command.durationMs / 1000) * soundSampleRate);

  if (sampleCount < 1) {
    return new Float32Array(0);
  }

  const samples = new Float32Array(sampleCount);
  const frequencyStart = normalizeFrequency(command.frequencyStart);
  const frequencyEnd = normalizeFrequency(command.frequencyEnd);
  const volume = normalizeVolume(command.volume);
  let phase = 0;

  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
    const slideProgress = sampleCount === 1 ? 1 : sampleIndex / (sampleCount - 1);
    const frequency = interpolate(frequencyStart, frequencyEnd, slideProgress);
    samples[sampleIndex] = getWaveSample(command, phase) * volume;
    phase += frequency / soundSampleRate;
    phase -= Math.floor(phase);
  }

  return samples;
}

function getWaveSample(command: SoundCommand, phase: number): number {
  switch (command.wave) {
    case "square":
      return phase < 0.5 ? 1 : -1;
    case "sine":
      return Math.sin(phase * twoPi);
    case "triangle":
      return 4 * Math.abs(phase - 0.5) - 1;
    case "noise":
      return Math.random() * 2 - 1;
  }
}

function interpolate(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}

function normalizeFrequency(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.max(1, value);
}

function normalizeVolume(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(100, Math.max(0, value)) / 100;
}
