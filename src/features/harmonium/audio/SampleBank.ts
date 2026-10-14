import { midiToFrequency } from "../music/pitch";
import { ReedMode } from "../music/tuning";

export interface SampleBankStatus {
  mode: "sampled" | "synthesized-reed-bank";
  loadedCount: number;
  error?: string;
}

export interface ReedBufferPair {
  nar: AudioBuffer;
  mada: AudioBuffer;
}

/**
 * Generates and caches clean, unclipped, phase-locked brass free-reed wavetables
 * with distinct Nar (Male) and Mada (Female) phase/harmonic profiles so dual reeds
 * never suffer from 180-degree destructive phase dropouts during sustained notes.
 */
export class SampleBank {
  private bufferCache = new Map<number, ReedBufferPair>();
  private status: SampleBankStatus = {
    mode: "synthesized-reed-bank",
    loadedCount: 0,
  };

  public getStatus(): SampleBankStatus {
    return this.status;
  }

  public async warmUp(
    ctx: AudioContext,
    midiNotes: number[],
    _reedMode: ReedMode,
  ): Promise<SampleBankStatus> {
    for (const midi of midiNotes) {
      if (!this.bufferCache.has(midi)) {
        const pair = this.buildReedBufferPair(ctx, midi);
        this.bufferCache.set(midi, pair);
      }
    }

    this.status = {
      mode: "synthesized-reed-bank",
      loadedCount: this.bufferCache.size,
    };
    return this.status;
  }

  public getOrCreateBuffer(
    ctx: AudioContext,
    midi: number,
    _reedMode?: ReedMode,
  ): AudioBuffer {
    return this.getOrCreateReedPair(ctx, midi).nar;
  }

  public getOrCreateReedPair(ctx: AudioContext, midi: number): ReedBufferPair {
    const existing = this.bufferCache.get(midi);
    if (existing) {
      return existing;
    }
    const created = this.buildReedBufferPair(ctx, midi);
    this.bufferCache.set(midi, created);
    return created;
  }

  private buildReedBufferPair(ctx: AudioContext, midi: number): ReedBufferPair {
    const nar = this.buildSingleReedBuffer(ctx, midi, "nar");
    const mada = this.buildSingleReedBuffer(ctx, midi, "mada");
    return { nar, mada };
  }

  /**
   * Builds a click-free, zero-dropout reed buffer.
   * Uses an exact integer number of samples per cycle so sample[length - 1] wraps into sample[0]
   * with zero phase jump even when detuned.
   */
  private buildSingleReedBuffer(
    ctx: AudioContext,
    midi: number,
    character: "nar" | "mada",
  ): AudioBuffer {
    const sampleRate = ctx.sampleRate;
    const targetFreq = midiToFrequency(midi);

    // Exact integer samples per single wave period guarantees 100% glitch-free looping
    const samplesPerCycle = Math.max(32, Math.round(sampleRate / targetFreq));
    const numCycles = 64;
    const length = samplesPerCycle * numCycles;
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    const fundamentalWeight = midi < 55 ? 0.42 : midi < 62 ? 0.58 : 0.76;

    // Nar emphasizes odd/fundamental woody body; Mada emphasizes sweet octave/fifth shimmer
    // This prevents 180-degree destructive phase cancellation when both reeds beat together.
    const harmonics =
      character === "nar"
        ? [
            fundamentalWeight,
            1.0,
            0.66,
            0.4,
            0.24,
            0.13,
            0.04,
            0.045,
            0.02,
            0.01,
          ]
        : [
            fundamentalWeight * 0.72,
            0.92,
            0.78,
            0.32,
            0.28,
            0.16,
            0.03,
            0.05,
            0.02,
            0.01,
          ];

    const highRegisterDamping = midi > 70 ? 0.65 : midi > 64 ? 0.85 : 1.0;
    const nyquist = sampleRate * 0.42;
    const exactCycleFreq = sampleRate / samplesPerCycle;
    let maxPeak = 0.0001;

    for (let i = 0; i < length; i++) {
      // Normalized angle for 1 cycle = 2*PI * (i / samplesPerCycle)
      const baseAngle = (2 * Math.PI * i) / samplesPerCycle;
      let sample = 0;

      for (let h = 0; h < harmonics.length; h++) {
        const harmonicNumber = h + 1;
        const hFreq = exactCycleFreq * harmonicNumber;
        if (hFreq >= nyquist) break;

        let amp = harmonics[h];
        if (harmonicNumber >= 4) {
          amp *= highRegisterDamping;
        }

        if (hFreq >= 480 && hFreq <= 1550) {
          amp *= 1.18;
        } else if (hFreq < 190) {
          amp *= 0.55;
        }

        // Quadrature phase offset per harmonic between Nar and Mada prevents simultaneous nulling
        const phaseShift =
          character === "mada"
            ? harmonicNumber % 2 === 0
              ? Math.PI * 0.35
              : -Math.PI * 0.25
            : 0;

        sample += amp * Math.sin(baseAngle * harmonicNumber + phaseShift);
      }

      data[i] = sample;
      const absVal = Math.abs(sample);
      if (absVal > maxPeak) {
        maxPeak = absVal;
      }
    }

    const targetPeak = 0.65;
    const scale = targetPeak / maxPeak;
    for (let i = 0; i < length; i++) {
      data[i] *= scale;
    }

    return buffer;
  }
}
