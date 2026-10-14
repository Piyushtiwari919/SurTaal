import { midiToFrequency } from "../music/pitch";
import { ReedMode } from "../music/tuning";

export interface SampleBankStatus {
  mode: "sampled" | "synthesized-reed-bank";
  loadedCount: number;
  error?: string;
}

/**
 * Generates and caches clean, unclipped, phase-aligned brass free-reed wavetables
 * modeled on an Indian Palitana harmonium reed bank.
 */
export class SampleBank {
  private bufferCache = new Map<number, AudioBuffer>();
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
        const buffer = this.buildCleanHarmoniumReedBuffer(ctx, midi);
        this.bufferCache.set(midi, buffer);
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
    const existing = this.bufferCache.get(midi);
    if (existing) {
      return existing;
    }
    const created = this.buildCleanHarmoniumReedBuffer(ctx, midi);
    this.bufferCache.set(midi, created);
    return created;
  }

  /**
   * Builds a seamless, zero-distortion single brass reed buffer.
   * Key-scales the fundamental and upper partials across Mandra, Madhya, and Taar saptaks
   * so low notes never boom ("futta bass") and high notes remain sweet and warm.
   */
  private buildCleanHarmoniumReedBuffer(
    ctx: AudioContext,
    midi: number,
  ): AudioBuffer {
    const sampleRate = ctx.sampleRate;
    const freq = midiToFrequency(midi);

    // Choose an integer number of cycles (~0.5s) for a lightweight, phase-locked loop
    const numCycles = Math.max(16, Math.round(freq * 0.5));
    const exactDurationSec = numCycles / freq;
    const length = Math.max(1024, Math.round(sampleRate * exactDurationSec));
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    // Key-tracking: tame fundamental on low bass notes (< C4) so it never sounds muddy/boomy
    const fundamentalWeight = midi < 55 ? 0.42 : midi < 62 ? 0.58 : 0.76;

    // Palitana brass free-reed harmonic profile:
    // Strong 2nd (octave) and 3rd (fifth) harmonics give the signature woody Indian harmonium voice
    const harmonics = [
      fundamentalWeight, // H1: Fundamental
      1.0, // H2: Octave body (core harmonium warmth)
      0.66, // H3: Twelfth (woody reed presence)
      0.4, // H4: Double octave
      0.24, // H5: Sweet major third partial
      0.13, // H6: Brilliance
      0.04, // H7: Kept very low to avoid harsh metallic buzz
      0.045, // H8: Upper air shimmer
      0.02, // H9
      0.01, // H10
    ];

    // Soften upper harmonics on high Taar Saptak notes so they stay sweet and round
    const highRegisterDamping = midi > 70 ? 0.65 : midi > 64 ? 0.85 : 1.0;
    const nyquist = sampleRate * 0.42;
    let maxPeak = 0.0001;

    // Recompute exact fundamental frequency locked to the integer buffer length
    // so every harmonic completes an exact integer number of cycles with 0.0 phase error
    const lockedFundamentalFreq = (numCycles * sampleRate) / length;

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      let sample = 0;

      for (let h = 0; h < harmonics.length; h++) {
        const harmonicNumber = h + 1;
        const hFreq = lockedFundamentalFreq * harmonicNumber;
        if (hFreq >= nyquist) break;

        let amp = harmonics[h];
        if (harmonicNumber >= 4) {
          amp *= highRegisterDamping;
        }

        // Acoustic soundboard formant emphasis (500 Hz - 1500 Hz vocal sweet spot)
        if (hFreq >= 480 && hFreq <= 1550) {
          amp *= 1.18;
        } else if (hFreq < 190) {
          amp *= 0.55; // Prevent low-frequency speaker mud
        }

        // Alternating cosine/sine phase alignment without clipping
        sample += amp * Math.sin(2 * Math.PI * hFreq * t);
      }

      data[i] = sample;
      const absVal = Math.abs(sample);
      if (absVal > maxPeak) {
        maxPeak = absVal;
      }
    }

    // Normalize purely linearly (NO Math.tanh distortion!) to a clean 0.65 peak
    const targetPeak = 0.65;
    const scale = targetPeak / maxPeak;
    for (let i = 0; i < length; i++) {
      data[i] *= scale;
    }

    return buffer;
  }
}
