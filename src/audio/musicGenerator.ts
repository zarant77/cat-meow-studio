import { soundSampleRate } from "./soundGenerator.js";
import type { MusicInstrument, MusicNote, MusicProject } from "../model/musicProject.js";

const twoPi = Math.PI * 2;

export function generateMusicSamples(project: MusicProject): Float32Array {
  const lengthSamples = getProjectSampleCount(project);
  const samples = new Float32Array(lengthSamples);

  if (lengthSamples === 0) {
    return samples;
  }

  for (const note of project.notes) {
    const instrument = project.instruments[note.instrument];

    if (instrument !== undefined) {
      mixNote(samples, project, instrument, note);
    }
  }

  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = Math.max(-1, Math.min(1, samples[index]));
  }

  return samples;
}

function getProjectSampleCount(project: MusicProject): number {
  const seconds = getTickSeconds(project) * Math.max(1, project.lengthTicks);

  return Math.max(1, Math.round(seconds * soundSampleRate));
}

function mixNote(output: Float32Array, project: MusicProject, instrument: MusicInstrument, note: MusicNote): void {
  const tickSeconds = getTickSeconds(project);
  const startSample = Math.max(0, Math.round(note.startTick * tickSeconds * soundSampleRate));
  const durationSamples = Math.max(1, Math.round(note.durationTicks * tickSeconds * soundSampleRate));
  const frequency = midiNoteToFrequency(note.note);
  const volume = (instrument.volume / 100) * (note.volume / 100);
  let phase = 0;

  for (let offset = 0; offset < durationSamples; offset += 1) {
    const sampleIndex = startSample + offset;

    if (sampleIndex >= output.length) {
      return;
    }

    output[sampleIndex] += getWaveSample(instrument, phase) * volume * getEnvelope(instrument, offset, durationSamples);
    phase += frequency / soundSampleRate;
    phase -= Math.floor(phase);
  }
}

export function getTickSeconds(project: MusicProject): number {
  return 60 / Math.max(20, project.bpm) / Math.max(1, project.ticksPerBeat);
}

function midiNoteToFrequency(note: number): number {
  return 440 * 2 ** ((note - 69) / 12);
}

function getWaveSample(instrument: MusicInstrument, phase: number): number {
  switch (instrument.wave) {
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

function getEnvelope(instrument: MusicInstrument, sampleOffset: number, durationSamples: number): number {
  const attackSamples = Math.round((instrument.attackMs / 1000) * soundSampleRate);
  const decaySamples = Math.round((instrument.decayMs / 1000) * soundSampleRate);
  const attack = attackSamples <= 0 ? 1 : Math.min(1, sampleOffset / attackSamples);
  const remainingSamples = durationSamples - sampleOffset;
  const decay = decaySamples <= 0 ? 1 : Math.min(1, remainingSamples / decaySamples);

  return Math.min(attack, decay);
}
