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
 * Because PeriodicWave is synthesized continuously in C++ by the browser's audio engine,
 * it has ZERO loop points, ZERO buffer wrap clicks, and ZERO phase dropouts.
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
    // Group into 3 register zones (Mandra, Madhya, Taar) for key-tracked harmonic warmth
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

    // 1. Nar Reed (Male 8' Reed) - carries the solid, unbroken fundamental + woody harmonics
    const narHarmonics = [
      0, // DC offset (index 0 must be 0)
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

    // 2. Mada Reed (Female 8' Celeste Reed) - reduced fundamental so it NEVER cancels out
    // the Nar reed's fundamental pitch, providing pure, unbroken Indian harmonium shimmer
    const madaHarmonics = [
      0,
      fundamentalWeight * 0.25,
      0.85,
      0.72,
      0.35 * highDamping,
      0.26 * highDamping,
      0.14 * highDamping,
      0.03 * highDamping,
      0.04 * highDamping,
      0.015 * highDamping,
      0.01 * highDamping,
    ];

    const narReal = new Float32Array(narHarmonics.length);
    const narImag = new Float32Array(narHarmonics);

    const madaReal = new Float32Array(madaHarmonics.length);
    const madaImag = new Float32Array(madaHarmonics.length);
    for (let i = 1; i < madaHarmonics.length; i++) {
      // Orthogonal cosine/sine split prevents destructive phase cancellation with Nar
      const angle = i % 2 === 0 ? Math.PI * 0.25 : -Math.PI * 0.25;
      madaReal[i] = madaHarmonics[i] * Math.cos(angle);
      madaImag[i] = madaHarmonics[i] * Math.sin(angle);
    }

    const nar = ctx.createPeriodicWave(narReal, narImag, {
      disableNormalization: false,
    });
    const mada = ctx.createPeriodicWave(madaReal, madaImag, {
      disableNormalization: false,
    });

    return { nar, mada };
  }
}
