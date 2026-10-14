import { ReedMode } from "../music/tuning";

export interface SampleBankStatus {
  mode: "sampled" | "synthesized-reed-bank";
  loadedCount: number;
  error?: string;
}

export interface ReedWavePair {
  nar: PeriodicWave;
  mada: PeriodicWave;
}

/**
 * Generates and caches native Web Audio PeriodicWave harmonic tables.
 * Preserves the exact Indian Palitana harmonium timbre while keeping the primary
 * fundamental and octave anchored in the Nar reed so Mada shimmer never causes volume dips.
 */
export class SampleBank {
  private waveCache = new Map<string, ReedWavePair>();
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
      this.getOrCreateReedPair(ctx, midi);
    }

    this.status = {
      mode: "synthesized-reed-bank",
      loadedCount: this.waveCache.size,
    };
    return this.status;
  }

  public getOrCreateReedPair(ctx: AudioContext, midi: number): ReedWavePair {
    const registerZone = midi < 55 ? "mandra" : midi < 66 ? "madhya" : "taar";
    const existing = this.waveCache.get(registerZone);
    if (existing) {
      return existing;
    }

    const pair = this.buildPeriodicWavePair(ctx, registerZone);
    this.waveCache.set(registerZone, pair);
    return pair;
  }

  private buildPeriodicWavePair(
    ctx: AudioContext,
    registerZone: "mandra" | "madhya" | "taar",
  ): ReedWavePair {
    const fundamentalWeight =
      registerZone === "mandra" ? 0.45 : registerZone === "madhya" ? 0.65 : 0.8;
    const highDamping =
      registerZone === "taar" ? 0.65 : registerZone === "madhya" ? 0.88 : 1.0;

    // 1. Nar Reed (Male 8' Reed) - carries the unbroken Indian harmonium tone
    const narHarmonics = [
      0,
      fundamentalWeight,
      1.0,
      0.66,
      0.4 * highDamping,
      0.24 * highDamping,
      0.13 * highDamping,
      0.04 * highDamping,
      0.045 * highDamping,
      0.02 * highDamping,
      0.01 * highDamping,
    ];

    // 2. Mada Reed (Female 8' Celeste Reed) - zero fundamental (0) and gentle upper harmonics
    // so it adds acoustic reed chorus without ever cancelling out the Nar reed's core body
    const madaHarmonics = [
      0,
      0,
      0.35,
      0.65,
      0.45 * highDamping,
      0.3 * highDamping,
      0.18 * highDamping,
      0.05 * highDamping,
      0.05 * highDamping,
      0.02 * highDamping,
      0.01 * highDamping,
    ];

    const narReal = new Float32Array(narHarmonics.length);
    const narImag = new Float32Array(narHarmonics);

    const madaReal = new Float32Array(madaHarmonics.length);
    const madaImag = new Float32Array(madaHarmonics);

    const nar = ctx.createPeriodicWave(narReal, narImag, {
      disableNormalization: false,
    });
    const mada = ctx.createPeriodicWave(madaReal, madaImag, {
      disableNormalization: false,
    });

    return { nar, mada };
  }
}
