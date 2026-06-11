import { soundSampleRate } from "./soundGenerator.js";
import type { MusicInstrument, MusicNote, MusicProject } from "../model/musicProject.js";
import { getEffectiveNoteVolume, getTrackVolumeStats, type MusicVolumeStats } from "../model/musicLoudness.js";

const twoPi = Math.PI * 2;
const softLimiterDrive = 0.9;
const preLimiterPeak = 0.88;
const normalizedPeak = 0.78;
const masterGain = 0.92;
const clickFadeSeconds = 0.005;
const echoWet = 0.055;
const reverbWet = 0.095;
const reverbFeedback = 0.31;
const lowPassCutoffHz = 9200;
const highPassCutoffHz = 36;

interface InstrumentStats {
  averageNote: number;
  minimumNote: number;
  maximumNote: number;
  noteCount: number;
}

interface InstrumentProfile {
  role: InstrumentRole;
  baseGain: number;
}

interface SynthVoiceLayer {
  wave: SynthWave;
  gain: number;
  detuneCents: number;
  octaveOffset: number;
  phaseOffset: number;
}

interface LayerState {
  wave: SynthWave;
  gain: number;
  phase: number;
  phaseStep: number;
}

type SynthWave = "sine" | "triangle" | "softSquare" | "warmTriangle" | "noise";

type InstrumentRole = "bass" | "lead" | "harmony" | "spark" | "noise";

export type MusicPreviewQuality = "fast" | "rich";

export interface MusicGenerationOptions {
  quality?: MusicPreviewQuality;
}

export function generateMusicSamples(project: MusicProject, options: MusicGenerationOptions = {}): Float32Array {
  const quality = options.quality ?? "rich";
  const lengthSamples = getProjectSampleCount(project);
  const samples = new Float32Array(lengthSamples);

  if (lengthSamples === 0) {
    return samples;
  }

  const tickSeconds = getTickSeconds(project);
  const profiles = getInstrumentProfiles(project);
  const volumeStats = getTrackVolumeStats(project);

  for (const note of project.notes) {
    const instrument = project.instruments[note.instrument];
    const profile = profiles[note.instrument];

    if (instrument !== undefined && profile !== undefined) {
      mixNote(samples, project, instrument, note, profile, tickSeconds, quality, volumeStats);
    }
  }

  applyHighPass(samples, highPassCutoffHz);
  normalizeSamples(samples, preLimiterPeak);
  if (quality === "rich") {
    applyFastSpace(samples, project);
    applyLowPass(samples, lowPassCutoffHz);
  }
  applySoftLimiter(samples);
  normalizeSamples(samples, normalizedPeak);
  applyFadeEdges(samples);

  return samples;
}

function getProjectSampleCount(project: MusicProject): number {
  const seconds = getTickSeconds(project) * Math.max(1, project.lengthTicks);

  return Math.max(1, Math.round(seconds * soundSampleRate));
}

function mixNote(
  output: Float32Array,
  project: MusicProject,
  instrument: MusicInstrument,
  note: MusicNote,
  profile: InstrumentProfile,
  tickSeconds: number,
  quality: MusicPreviewQuality,
  volumeStats: MusicVolumeStats,
): void {
  const startSample = Math.max(0, Math.round(note.startTick * tickSeconds * soundSampleRate));
  const durationSamples = Math.max(1, Math.round(note.durationTicks * tickSeconds * soundSampleRate));

  if (startSample >= output.length) {
    return;
  }

  const endSample = Math.min(output.length, startSample + durationSamples);
  const layerStates = createLayerStates(note, getVoiceLayers(instrument, note, profile.role, quality));
  const volume = getNoteVolume(project, instrument, note, profile, volumeStats) * masterGain;
  const envelopeSettings = getEnvelopeSettings(instrument, profile.role, durationSamples);

  for (let sampleIndex = startSample; sampleIndex < endSample; sampleIndex += 1) {
    const offset = sampleIndex - startSample;
    const envelope = getEnvelope(envelopeSettings, offset, durationSamples);

    if (envelope <= 0) {
      continue;
    }

    let sample = 0;

    for (const layer of layerStates) {
      sample += getSynthWaveSample(layer.wave, layer.phase, note.startTick + offset) * layer.gain;
      layer.phase += layer.phaseStep;

      if (layer.phase >= 1) {
        layer.phase -= Math.floor(layer.phase);
      }
    }

    output[sampleIndex] += sample * volume * envelope;
  }
}

export function getTickSeconds(project: MusicProject): number {
  return 60 / Math.max(20, project.bpm) / Math.max(1, project.ticksPerBeat);
}

function getInstrumentProfiles(project: MusicProject): Array<InstrumentProfile | undefined> {
  const stats = getInstrumentStats(project);

  return project.instruments.map((instrument, instrumentIndex) => {
    const role = getInstrumentRole(instrument, stats[instrumentIndex]);

    return {
      role,
      baseGain: getRoleGain(role),
    };
  });
}

function getInstrumentStats(project: MusicProject): Array<InstrumentStats | undefined> {
  const stats = project.instruments.map(() => ({
    noteCount: 0,
    noteSum: 0,
    minimumNote: Number.POSITIVE_INFINITY,
    maximumNote: Number.NEGATIVE_INFINITY,
  }));

  for (const note of project.notes) {
    const item = stats[note.instrument];

    if (item === undefined) {
      continue;
    }

    item.noteCount += 1;
    item.noteSum += note.note;
    item.minimumNote = Math.min(item.minimumNote, note.note);
    item.maximumNote = Math.max(item.maximumNote, note.note);
  }

  return stats.map((item) => {
    if (item.noteCount === 0) {
      return undefined;
    }

    return {
      averageNote: item.noteSum / item.noteCount,
      minimumNote: item.minimumNote,
      maximumNote: item.maximumNote,
      noteCount: item.noteCount,
    };
  });
}

function getInstrumentRole(instrument: MusicInstrument, stats: InstrumentStats | undefined): InstrumentRole {
  if (instrument.wave === "noise") {
    return "noise";
  }

  const id = instrument.id.toLowerCase();

  if (id.includes("bass") || (stats !== undefined && stats.averageNote <= 45)) {
    return "bass";
  }

  if (id.includes("spark") || (stats !== undefined && stats.averageNote >= 78)) {
    return "spark";
  }

  if (id.includes("harmony") || (stats !== undefined && stats.averageNote < 68)) {
    return "harmony";
  }

  return "lead";
}

function getVoiceLayers(instrument: MusicInstrument, note: MusicNote, role: InstrumentRole, quality: MusicPreviewQuality): SynthVoiceLayer[] {
  if (role === "noise") {
    return [{ wave: "noise", gain: 1, detuneCents: 0, octaveOffset: 0, phaseOffset: 0 }];
  }

  if (quality === "fast") {
    return getFastVoiceLayers(instrument, note, role);
  }

  if (role === "bass") {
    return [
      { wave: "sine", gain: 0.5, detuneCents: 0, octaveOffset: 0, phaseOffset: 0.03 },
      { wave: "triangle", gain: 0.34, detuneCents: -3, octaveOffset: 0, phaseOffset: 0.19 },
      { wave: "sine", gain: note.note <= 40 ? 0.2 : 0.11, detuneCents: 0, octaveOffset: -1, phaseOffset: 0.41 },
    ];
  }

  if (role === "spark") {
    return [
      { wave: "sine", gain: 0.64, detuneCents: 0, octaveOffset: 0, phaseOffset: 0.11 },
      { wave: "triangle", gain: 0.2, detuneCents: 4, octaveOffset: 0, phaseOffset: 0.37 },
    ];
  }

  if (role === "harmony") {
    return [
      { wave: instrument.wave === "sine" ? "sine" : "triangle", gain: 0.54, detuneCents: 0, octaveOffset: 0, phaseOffset: 0.07 },
      { wave: "triangle", gain: 0.23, detuneCents: -6, octaveOffset: 0, phaseOffset: 0.29 },
      { wave: "triangle", gain: 0.23, detuneCents: 6, octaveOffset: 0, phaseOffset: 0.53 },
    ];
  }

  return [
    { wave: instrument.wave === "square" ? "softSquare" : "warmTriangle", gain: 0.58, detuneCents: 0, octaveOffset: 0, phaseOffset: 0.13 },
    { wave: "triangle", gain: 0.22, detuneCents: -5, octaveOffset: 0, phaseOffset: 0.43 },
    { wave: "triangle", gain: 0.22, detuneCents: 5, octaveOffset: 0, phaseOffset: 0.61 },
  ];
}

function getFastVoiceLayers(instrument: MusicInstrument, note: MusicNote, role: InstrumentRole): SynthVoiceLayer[] {
  if (role === "bass") {
    return [
      { wave: "sine", gain: 0.56, detuneCents: 0, octaveOffset: 0, phaseOffset: 0.03 },
      { wave: "triangle", gain: note.note <= 40 ? 0.24 : 0.14, detuneCents: 0, octaveOffset: note.note <= 40 ? -1 : 0, phaseOffset: 0.27 },
    ];
  }

  if (role === "spark") {
    return [{ wave: "sine", gain: 0.82, detuneCents: 0, octaveOffset: 0, phaseOffset: 0.11 }];
  }

  if (role === "harmony") {
    return [{ wave: instrument.wave === "sine" ? "sine" : "triangle", gain: 0.78, detuneCents: 0, octaveOffset: 0, phaseOffset: 0.07 }];
  }

  return [{ wave: instrument.wave === "square" ? "softSquare" : "warmTriangle", gain: 0.86, detuneCents: 0, octaveOffset: 0, phaseOffset: 0.13 }];
}

function createLayerStates(note: MusicNote, layers: SynthVoiceLayer[]): LayerState[] {
  const baseFrequency = midiNoteToFrequency(note.note);
  const initialPhase = getInitialPhase(note);

  return layers.map((layer) => {
    const frequency = baseFrequency * 2 ** (layer.octaveOffset + layer.detuneCents / 1200);

    return {
      wave: layer.wave,
      gain: layer.gain,
      phase: wrapPhase(initialPhase + layer.phaseOffset),
      phaseStep: frequency / soundSampleRate,
    };
  });
}

function getNoteVolume(
  project: MusicProject,
  instrument: MusicInstrument,
  note: MusicNote,
  profile: InstrumentProfile,
  volumeStats: MusicVolumeStats,
): number {
  const baseVolume = (instrument.volume / 100) * (getEffectiveNoteVolume(note, project, volumeStats) / 100);
  const highNoteGain = note.note > 84 ? Math.max(0.48, 1 - (note.note - 84) * 0.04) : 1;
  const lowNoteGain = note.note < 32 ? 0.78 : 1;

  return baseVolume * profile.baseGain * highNoteGain * lowNoteGain;
}

function getRoleGain(role: InstrumentRole): number {
  switch (role) {
    case "bass":
      return 1.08;
    case "lead":
      return 1.12;
    case "harmony":
      return 0.66;
    case "spark":
      return 0.52;
    case "noise":
      return 0.46;
  }
}

interface EnvelopeSettings {
  attackSamples: number;
  releaseSamples: number;
  clickFadeSamples: number;
}

function getEnvelopeSettings(instrument: MusicInstrument, role: InstrumentRole, durationSamples: number): EnvelopeSettings {
  const attackScale = role === "bass" ? 0.75 : role === "harmony" ? 1.18 : 1;
  const releaseScale = role === "harmony" ? 1.15 : role === "spark" ? 0.72 : 1;

  return {
    attackSamples: Math.max(0, Math.round((instrument.attackMs / 1000) * soundSampleRate * attackScale)),
    releaseSamples: Math.max(0, Math.min(durationSamples, Math.round((instrument.decayMs / 1000) * soundSampleRate * releaseScale))),
    clickFadeSamples: Math.max(1, Math.round(clickFadeSeconds * soundSampleRate)),
  };
}

function getEnvelope(settings: EnvelopeSettings, sampleOffset: number, durationSamples: number): number {
  const attack = settings.attackSamples <= 0 ? 1 : smoothStep(Math.min(1, sampleOffset / settings.attackSamples));
  const remainingSamples = Math.max(0, durationSamples - sampleOffset);
  const release = settings.releaseSamples <= 0 ? 1 : smoothStep(Math.min(1, remainingSamples / settings.releaseSamples));
  const clickFadeIn = smoothStep(Math.min(1, sampleOffset / settings.clickFadeSamples));
  const clickFadeOut = smoothStep(Math.min(1, remainingSamples / settings.clickFadeSamples));

  return Math.min(attack, release, clickFadeIn, clickFadeOut);
}

function midiNoteToFrequency(note: number): number {
  return 440 * 2 ** ((note - 69) / 12);
}

function getInitialPhase(note: MusicNote): number {
  return wrapPhase(note.note * 0.137 + note.startTick * 0.017 + note.instrument * 0.071);
}

function wrapPhase(value: number): number {
  return value - Math.floor(value);
}

function getSynthWaveSample(wave: SynthWave, phase: number, noiseSeed: number): number {
  switch (wave) {
    case "sine":
      return Math.sin(phase * twoPi);
    case "triangle":
      return getTriangleSample(phase);
    case "softSquare":
      return getSoftSquareSample(phase);
    case "warmTriangle":
      return getWarmTriangleSample(phase);
    case "noise":
      return getDeterministicNoiseSample(phase, noiseSeed);
  }
}

function getTriangleSample(phase: number): number {
  return 4 * Math.abs(phase - 0.5) - 1;
}

function getWarmTriangleSample(phase: number): number {
  const triangle = getTriangleSample(phase);
  const sine = Math.sin(phase * twoPi);

  return triangle * 0.72 + sine * 0.28;
}

function getSoftSquareSample(phase: number): number {
  return Math.tanh(Math.sin(phase * twoPi) * 2.1) * 0.78;
}

function getDeterministicNoiseSample(phase: number, seedOffset: number): number {
  const seed = Math.sin((phase + 1) * 127.1 + seedOffset * 0.013) * 43758.5453123;

  return (seed - Math.floor(seed)) * 2 - 1;
}

function smoothStep(value: number): number {
  return value * value * (3 - 2 * value);
}

function applyFastSpace(samples: Float32Array, project: MusicProject): void {
  const beatSeconds = 60 / Math.max(20, project.bpm);
  const echoDelay = Math.max(1, Math.round(beatSeconds * 0.375 * soundSampleRate));
  const reverbDelayA = Math.max(1, Math.round(0.031 * soundSampleRate));
  const reverbDelayB = Math.max(1, Math.round(0.047 * soundSampleRate));

  for (let index = 0; index < samples.length; index += 1) {
    const input = samples[index];
    const echo = index >= echoDelay ? samples[index - echoDelay] : 0;
    const reverbA = index >= reverbDelayA ? samples[index - reverbDelayA] : 0;
    const reverbB = index >= reverbDelayB ? samples[index - reverbDelayB] : 0;
    const wet = echo * echoWet + (reverbA + reverbB) * 0.5 * reverbWet;

    samples[index] = input + wet;

    if (index >= reverbDelayA) {
      samples[index] += samples[index - reverbDelayA] * reverbFeedback * 0.018;
    }
  }
}

function applyHighPass(samples: Float32Array, cutoffHz: number): void {
  const rc = 1 / (twoPi * cutoffHz);
  const dt = 1 / soundSampleRate;
  const alpha = rc / (rc + dt);
  let previousOutput = 0;
  let previousInput = samples[0] ?? 0;

  for (let index = 0; index < samples.length; index += 1) {
    const input = samples[index];
    const output = alpha * (previousOutput + input - previousInput);

    samples[index] = output;
    previousOutput = output;
    previousInput = input;
  }
}

function applyLowPass(samples: Float32Array, cutoffHz: number): void {
  const rc = 1 / (twoPi * cutoffHz);
  const dt = 1 / soundSampleRate;
  const alpha = dt / (rc + dt);
  let output = samples[0] ?? 0;

  for (let index = 0; index < samples.length; index += 1) {
    output += alpha * (samples[index] - output);
    samples[index] = output;
  }
}

function normalizeSamples(samples: Float32Array, targetPeak: number): void {
  let peak = 0;

  for (let index = 0; index < samples.length; index += 1) {
    peak = Math.max(peak, Math.abs(samples[index]));
  }

  if (peak === 0 || peak <= targetPeak) {
    return;
  }

  const gain = targetPeak / peak;

  for (let index = 0; index < samples.length; index += 1) {
    samples[index] *= gain;
  }
}

function applySoftLimiter(samples: Float32Array): void {
  const normalizer = Math.tanh(softLimiterDrive);

  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = Math.tanh(samples[index] * softLimiterDrive) / normalizer;
  }
}

function applyFadeEdges(samples: Float32Array): void {
  const fadeSamples = Math.min(samples.length, Math.max(1, Math.round(0.01 * soundSampleRate)));

  for (let index = 0; index < fadeSamples; index += 1) {
    const gain = smoothStep(index / fadeSamples);
    const endIndex = samples.length - 1 - index;

    samples[index] *= gain;
    samples[endIndex] *= gain;
  }
}
