import type { SoundProject } from "../model/soundProject.js";
import { generateSoundSamples, soundSampleRate } from "./soundGenerator.js";

export class AudioPreview {
  private audioContext: AudioContext | null = null;
  private currentSource: AudioBufferSourceNode | null = null;

  play(project: SoundProject): void {
    if (project.commands.length === 0) {
      return;
    }

    const samples = generateSoundSamples(project);

    if (samples.length === 0) {
      return;
    }

    this.playSamples(samples, false);
  }

  playSamples(samples: Float32Array, loop: boolean | AudioPreviewOptions): void {
    if (samples.length === 0) {
      return;
    }

    const options: AudioPreviewOptions = typeof loop === "boolean" ? { loop } : loop;
    const context = this.getAudioContext();
    const buffer = context.createBuffer(1, samples.length, soundSampleRate);
    const source = context.createBufferSource();
    const channelSamples = new Float32Array(samples.length);

    this.stop();

    channelSamples.set(samples);
    buffer.copyToChannel(channelSamples, 0);
    source.buffer = buffer;
    source.loop = options.loop;
    source.loopStart = Math.max(0, options.loopStartSeconds ?? 0);
    source.loopEnd = Math.min(buffer.duration, Math.max(source.loopStart, options.loopEndSeconds ?? buffer.duration));
    source.connect(context.destination);
    source.addEventListener("ended", () => {
      if (this.currentSource === source) {
        this.currentSource = null;
      }
    });

    this.currentSource = source;

    void context
      .resume()
      .then(() => {
        if (this.currentSource === source) {
          source.start(0, Math.max(0, options.startOffsetSeconds ?? 0));
        }
      })
      .catch(() => {
        if (this.currentSource === source) {
          this.stop();
        }
      });
  }

  stop(): void {
    const source = this.currentSource;

    if (source === null) {
      return;
    }

    this.currentSource = null;
    stopSource(source);
    source.disconnect();
  }

  isPlaying(): boolean {
    return this.currentSource !== null;
  }

  private getAudioContext(): AudioContext {
    if (this.audioContext === null) {
      this.audioContext = new AudioContext({ sampleRate: soundSampleRate });
    }

    return this.audioContext;
  }
}

export interface AudioPreviewOptions {
  loop: boolean;
  loopStartSeconds?: number;
  loopEndSeconds?: number;
  startOffsetSeconds?: number;
}

function stopSource(source: AudioBufferSourceNode): void {
  try {
    source.stop();
  } catch (error) {
    if (!(error instanceof DOMException)) {
      throw error;
    }
  }
}
