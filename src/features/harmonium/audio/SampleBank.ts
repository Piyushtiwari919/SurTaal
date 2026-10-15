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
 * Generates authentic Indian Free-Reed PeriodicWave tables using the physical
 * acoustic Fourier series of a 32% duty-cycle brass reed slot inside a wooden chamber:
 *   A(k) = |sin(k * pi * 0.32) / (k * pi * 0.32)| * exp(-0.15 * (k - 1))
 *
 * This naturally dips the nasal 3rd harmonic and rolls off upper buzz, producing
 * the warm, woody, singing tone of a real Indian Mehfil harmonium.
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
    const registerZone = midi < 56 ? "mandra" : midi < 68 ? "madhya" : "taar";
    const existing = this.waveCache.get(registerZone);
    if (existing) {
      return existing;
    }

    const pair = this.buildAuthenticReedWaves(ctx, registerZone);
    this.waveCache.set(registerZone, pair);
    return pair;
  }

  private buildAuthenticReedWaves(
    ctx: AudioContext,
    registerZone: "mandra" | "madhya" | "taar",
  ): ReedWavePair {
    const numHarmonics = 10;
    const narReal = new Float32Array(numHarmonics + 1);
    const narImag = new Float32Array(numHarmonics + 1);
    const madaReal = new Float32Array(numHarmonics + 1);
    const madaImag = new Float32Array(numHarmonics + 1);

    const dutyCycle = 0.32; // Physical free-reed tongue aperture ratio
    const registerRollOff =
      registerZone === "taar" ? 0.24 : registerZone === "madhya" ? 0.16 : 0.13;

    for (let k = 1; k <= numHarmonics; k++) {
      const x = k * Math.PI * dutyCycle;
      const sincEnvelope = Math.abs(Math.sin(x) / x);
      const damping = Math.exp(-registerRollOff * (k - 1));
      const amp = sincEnvelope * damping;

      // Smooth quadrature phase distribution prevents spiky waveform peaks ("phata bass")
      const phase = (Math.PI * k * (k - 1)) / numHarmonics;
      narReal[k] = amp * Math.cos(phase);
      narImag[k] = amp * Math.sin(phase);

      // Mada reed omits H1 fundamental so dual-reed beating never dips the core note volume
      const madaAmp = k === 1 ? 0 : amp * 0.85;
      const madaPhase = phase + 0.78;
      madaReal[k] = madaAmp * Math.cos(madaPhase);
      madaImag[k] = madaAmp * Math.sin(madaPhase);
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
