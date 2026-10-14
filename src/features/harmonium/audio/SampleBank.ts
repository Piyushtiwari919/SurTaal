import { midiToFrequency } from "../music/pitch";
import { ReedMode } from "../music/tuning";

export interface SampleBankStatus {
  mode: "sampled" | "synthesized-reed-bank";
  loadedCount: number;
  error?: string;
}

export class SampleBank {
  private bufferCache = new Map<string, AudioBuffer>();
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
    reedMode: ReedMode,
  ): Promise<SampleBankStatus> {
    for (const midi of midiNotes) {
      const key = `${midi}-${reedMode}`;
      if (!this.bufferCache.has(key)) {
        const buffer = this.buildHarmoniumReedBuffer(ctx, midi, reedMode);
        this.bufferCache.set(key, buffer);
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
    reedMode: ReedMode,
  ): AudioBuffer {
    const key = `${midi}-${reedMode}`;
    const existing = this.bufferCache.get(key);
    if (existing) {
      return existing;
    }
    const created = this.buildHarmoniumReedBuffer(ctx, midi, reedMode);
    this.bufferCache.set(key, created);
    return created;
  }

  /**
   * Synthesizes a realistic Indian brass free-reed waveform with:
   * - Asymmetric free-reed harmonic weights (strong 1st, 2nd, 3rd, 4th, 5th harmonics)
   * - Acoustic beating between Nar (base 8' reed) and Mada (slightly sharp 8' celeste reed)
   * - Warm wooden chamber resonance and 0.92 full-scale peak normalization
   */
  private buildHarmoniumReedBuffer(
    ctx: AudioContext,
    midi: number,
    reedMode: ReedMode,
  ): AudioBuffer {
    const sampleRate = ctx.sampleRate;
    const freq = midiToFrequency(midi);
    const numCycles = Math.max(28, Math.round(freq * 1.8));
    const durationSeconds = numCycles / freq;
    const length = Math.max(2048, Math.floor(sampleRate * durationSeconds));
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    // Authentic Indian brass free-reed harmonic spectrum (strong odd & even harmonics up to 12th)
    const harmonics = [
      1.0, 0.88, 0.64, 0.42, 0.31, 0.22, 0.15, 0.1, 0.065, 0.04, 0.025, 0.015,
    ];
    const nyquist = sampleRate * 0.44;
    let maxPeak = 0.0001;

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      let sample = 0;

      for (let h = 0; h < harmonics.length; h++) {
        const harmonicNumber = h + 1;
        const hFreq = freq * harmonicNumber;
        if (hFreq >= nyquist) break;

        // Acoustic wood-body formant emphasis around 350Hz - 1200Hz
        const formantWeight =
          hFreq >= 300 && hFreq <= 1350 ? 1.28 : hFreq > 2600 ? 0.65 : 1.0;
        const amp = harmonics[h] * formantWeight;
        const phaseOffset = (harmonicNumber * 0.47) % (2 * Math.PI);

        // 1. Primary 8' Brass Reed (Nar)
        sample += amp * Math.sin(2 * Math.PI * hFreq * t + phaseOffset);

        // 2. Secondary 8' Celeste Reed (Mada) - warm natural acoustic chorus
        if (reedMode === "double" || reedMode === "triple") {
          const detunedCycles = numCycles + (harmonicNumber % 2 === 0 ? 1 : -1);
          const detunedFreq =
            (detunedCycles / durationSeconds) * harmonicNumber;
          sample +=
            amp *
            0.78 *
            Math.sin(2 * Math.PI * detunedFreq * t + phaseOffset + 0.35);
        }

        // 3. Sub-octave Kharaj (16') + Upper Octave (4') in Triple-Reed Organ mode
        if (reedMode === "triple") {
          if (harmonicNumber <= 6) {
            const subFreq = freq * 0.5 * harmonicNumber;
            sample += amp * 0.42 * Math.sin(2 * Math.PI * subFreq * t + 0.2);
          }
          if (hFreq * 2 < nyquist && harmonicNumber <= 6) {
            sample +=
              amp * 0.32 * Math.sin(2 * Math.PI * (hFreq * 2) * t + 0.6);
          }
        }
      }

      // Gentle asymmetric reed-valve saturation
      const shaped = Math.tanh(sample * 0.55 + 0.04) - Math.tanh(0.04);
      data[i] = shaped;
      const absVal = Math.abs(shaped);
      if (absVal > maxPeak) {
        maxPeak = absVal;
      }
    }

    // Normalize buffer to 0.92 peak so every note has full, consistent presence
    const normFactor = 0.92 / maxPeak;
    for (let i = 0; i < length; i++) {
      data[i] *= normFactor;
    }

    return buffer;
  }
}
