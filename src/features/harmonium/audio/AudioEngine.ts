import { midiToFrequency, PitchClass } from "../music/pitch";
import {
  getTaalMatra,
  TablaBol,
  TaalId,
  TaalMatra,
  VibhagMarker,
} from "../music/taal";
import { getTonicReferenceMidi, ReedMode } from "../music/tuning";
import { SampleBank, SampleBankStatus } from "./SampleBank";
import { VoiceManager } from "./VoiceManager";

export interface AudioSettings {
  volume: number;
  muted: boolean;
  reedMode: ReedMode;
  bellows: number;
  reverbMix: number;
  droneEnabled: boolean;
  tonic: PitchClass;
}

export class HarmoniumAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private dryGain: GainNode | null = null;
  private wetGain: GainNode | null = null;
  private convolver: ConvolverNode | null = null;
  private droneOscs: OscillatorNode[] = [];
  private droneGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private sampleBank = new SampleBank();
  private voiceManager = new VoiceManager(12);

  // Standalone Taal Loop state
  private taalTimerId: number | null = null;
  private currentTaalId: TaalId = "none";
  private taalBpm = 96;
  private taalBeatCounter = 0;
  private nextBeatTimeSec = 0;
  private onMatraChange?: (step: TaalMatra | null) => void;

  private settings: AudioSettings = {
    volume: 0.8,
    muted: false,
    reedMode: "double",
    bellows: 0.85,
    reverbMix: 0.15,
    droneEnabled: false,
    tonic: 0,
  };

  public async unlockAndInit(): Promise<SampleBankStatus> {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) {
        throw new Error("Web Audio API is not supported in this browser.");
      }
      this.ctx = new AudioCtx();
      this.setupMasterChain(this.ctx);
      this.noiseBuffer = this.createNoiseBuffer(this.ctx);
    }

    if (this.ctx.state === "suspended") {
      await this.ctx.resume();
    }

    const defaultRange = Array.from({ length: 37 }, (_, i) => 48 + i);
    const status = await this.sampleBank.warmUp(
      this.ctx,
      defaultRange,
      this.settings.reedMode,
    );
    this.syncDrone();
    return status;
  }

  public isReady(): boolean {
    return this.ctx !== null && this.ctx.state === "running";
  }

  public getCurrentTime(): number {
    return this.ctx ? this.ctx.currentTime : performance.now() / 1000;
  }

  public noteOn(midi: number, velocity = 1): void {
    if (!this.ctx) {
      void this.unlockAndInit().then(() =>
        this.triggerNoteInternal(midi, velocity),
      );
      return;
    }
    if (this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
    this.triggerNoteInternal(midi, velocity);
  }

  private triggerNoteInternal(midi: number, velocity: number): void {
    if (!this.ctx || !this.dryGain || !this.wetGain) return;

    const now = this.ctx.currentTime;
    const buffer = this.sampleBank.getOrCreateBuffer(
      this.ctx,
      midi,
      this.settings.reedMode,
    );

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1200 + this.settings.bellows * 1800, now);
    filter.Q.setValueAtTime(0.8, now);

    const voiceGain = this.ctx.createGain();
    const targetGain = Math.max(
      0.05,
      (0.12 + this.settings.bellows * 0.22) * velocity,
    );

    voiceGain.gain.setValueAtTime(0.0001, now);
    voiceGain.gain.linearRampToValueAtTime(targetGain, now + 0.018);

    source.connect(filter);
    filter.connect(voiceGain);
    voiceGain.connect(this.dryGain);
    voiceGain.connect(this.wetGain);

    source.start(now);

    this.voiceManager.registerVoice(this.ctx, {
      midi,
      source,
      filter,
      gain: voiceGain,
      startedAt: now,
    });
  }

  public noteOff(midi: number): void {
    if (!this.ctx) return;
    this.voiceManager.releaseVoice(this.ctx, midi, 0.11);
  }

  public releaseAllNotes(): void {
    this.voiceManager.releaseAll(this.ctx);
  }

  public playMetronomeClick(accent = false): void {
    if (!this.ctx || !this.masterGain || this.settings.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(accent ? 1100 : 760, now);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.05);
  }

  /**
   * Synthesizes an authentic Tabla Bol at `scheduledTime` (defaults to `ctx.currentTime`).
   * The Dayan (treble drum) is tuned directly to the user's selected Tonic (Sa).
   */
  public playTablaBol(
    bol: TablaBol,
    marker: VibhagMarker = "regular",
    scheduledTime?: number,
  ): void {
    if (!this.ctx || !this.dryGain || !this.wetGain || this.settings.muted)
      return;
    const t = scheduledTime ?? this.ctx.currentTime;
    const accentBoost =
      marker === "sam" ? 1.25 : marker === "tali" ? 1.1 : 0.95;

    // Tune Dayan to Madhya Sa (C4..B4 range)
    const saMidi = getTonicReferenceMidi(this.settings.tonic, 0);
    const dayanFreq = midiToFrequency(saMidi);

    switch (bol) {
      case "Dha":
        this.synthBayanGe(t, 0.28 * accentBoost, true);
        this.synthDayanOpen(t, dayanFreq, "kran", 0.22 * accentBoost);
        break;
      case "Dhin":
        this.synthBayanGe(t, 0.26 * accentBoost, true);
        this.synthDayanOpen(t, dayanFreq, "sur", 0.21 * accentBoost);
        break;
      case "Tin":
        this.synthDayanOpen(t, dayanFreq, "sur", 0.22 * accentBoost);
        break;
      case "Ta":
      case "Na":
        this.synthDayanOpen(t, dayanFreq, "kran", 0.24 * accentBoost);
        break;
      case "Ge":
        this.synthBayanGe(t, 0.26 * accentBoost, false);
        break;
      case "Ti":
        this.synthDayanClosedTi(t, dayanFreq, 0.18 * accentBoost);
        break;
      case "Ka":
        this.synthBayanClosedKa(t, 0.2 * accentBoost);
        break;
    }
  }

  /**
   * Bayan (Left-hand bass drum) open stroke ('Ge' / 'Ghe') with pitch-modulation meend.
   */
  private synthBayanGe(t: number, peakGain: number, bendUp: boolean): void {
    if (!this.ctx || !this.dryGain || !this.wetGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";

    // Characteristic Bayan membrane pitch bend
    osc.frequency.setValueAtTime(92, t);
    if (bendUp) {
      osc.frequency.exponentialRampToValueAtTime(112, t + 0.09);
      osc.frequency.exponentialRampToValueAtTime(68, t + 0.38);
    } else {
      osc.frequency.exponentialRampToValueAtTime(70, t + 0.28);
    }

    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(peakGain, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);

    osc.connect(gain);
    gain.connect(this.dryGain);
    gain.connect(this.wetGain);

    osc.start(t);
    osc.stop(t + 0.44);

    // Subtle skin impact thud
    this.triggerTransientNoise(t, 240, 1.5, peakGain * 0.35, 0.025);
  }

  /**
   * Bayan muted flat-palm slap ('Ka' / 'Ke').
   */
  private synthBayanClosedKa(t: number, peakGain: number): void {
    if (!this.ctx || !this.dryGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(135, t);
    osc.frequency.exponentialRampToValueAtTime(62, t + 0.055);

    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(peakGain, t + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.065);

    osc.connect(gain);
    gain.connect(this.dryGain);

    osc.start(t);
    osc.stop(t + 0.07);

    this.triggerTransientNoise(t, 420, 1.8, peakGain * 0.6, 0.03);
  }

  /**
   * Dayan (Right-hand tuned wooden drum) open stroke:
   * - 'kran' (Na/Ta): Rim stroke emphasizing fundamental + sharp 2nd/3rd harmonic ring
   * - 'sur' (Tin/Dhin): Maidan stroke with warm sustained fundamental tuned to Sa
   */
  private synthDayanOpen(
    t: number,
    saFreq: number,
    style: "kran" | "sur",
    peakGain: number,
  ): void {
    if (!this.ctx || !this.dryGain || !this.wetGain) return;

    const fundOsc = this.ctx.createOscillator();
    const overtoneOsc = this.ctx.createOscillator();
    const fundGain = this.ctx.createGain();
    const overtoneGain = this.ctx.createGain();

    fundOsc.type = "sine";
    overtoneOsc.type = "triangle";

    // Slight initial pitch drop from skin tension
    fundOsc.frequency.setValueAtTime(saFreq * 1.03, t);
    fundOsc.frequency.exponentialRampToValueAtTime(saFreq, t + 0.025);

    // Syahi weighted harmonic overtone
    const overtoneRatio = style === "kran" ? 2.02 : 1.5;
    overtoneOsc.frequency.setValueAtTime(saFreq * overtoneRatio, t);

    const decaySec = style === "sur" ? 0.36 : 0.26;

    fundGain.gain.setValueAtTime(0.0001, t);
    fundGain.gain.linearRampToValueAtTime(peakGain, t + 0.005);
    fundGain.gain.exponentialRampToValueAtTime(0.0001, t + decaySec);

    overtoneGain.gain.setValueAtTime(0.0001, t);
    overtoneGain.gain.linearRampToValueAtTime(
      style === "kran" ? peakGain * 0.55 : peakGain * 0.28,
      t + 0.004,
    );
    overtoneGain.gain.exponentialRampToValueAtTime(0.0001, t + decaySec * 0.65);

    fundOsc.connect(fundGain);
    overtoneOsc.connect(overtoneGain);
    fundGain.connect(this.dryGain);
    fundGain.connect(this.wetGain);
    overtoneGain.connect(this.dryGain);
    overtoneGain.connect(this.wetGain);

    fundOsc.start(t);
    overtoneOsc.start(t);
    fundOsc.stop(t + decaySec + 0.02);
    overtoneOsc.stop(t + decaySec + 0.02);

    // Finger-strike transient click
    this.triggerTransientNoise(
      t,
      style === "kran" ? 2200 : 1400,
      2.2,
      peakGain * 0.45,
      0.018,
    );
  }

  /**
   * Dayan muted center Syahi stroke ('Ti' / 'Te').
   */
  private synthDayanClosedTi(
    t: number,
    saFreq: number,
    peakGain: number,
  ): void {
    if (!this.ctx || !this.dryGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(saFreq * 1.15, t);
    osc.frequency.exponentialRampToValueAtTime(saFreq * 0.85, t + 0.045);

    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(peakGain, t + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.055);

    osc.connect(gain);
    gain.connect(this.dryGain);

    osc.start(t);
    osc.stop(t + 0.06);

    this.triggerTransientNoise(t, 1600, 2.0, peakGain * 0.5, 0.02);
  }

  private triggerTransientNoise(
    t: number,
    centerFreq: number,
    q: number,
    peakGain: number,
    durationSec: number,
  ): void {
    if (!this.ctx || !this.dryGain || !this.noiseBuffer) return;

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(centerFreq, t);
    filter.Q.setValueAtTime(q, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(peakGain, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + durationSec);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.dryGain);

    src.start(t);
    src.stop(t + durationSec + 0.01);
  }

  /**
   * Starts a continuous, Web-Audio-clock-synced Tabla loop for live playing or Song Studio.
   */
  public async startTaalLoop(
    taalId: Exclude<TaalId, "none">,
    bpm: number,
    onMatra?: (step: TaalMatra | null) => void,
  ): Promise<void> {
    this.stopTaalLoop();
    await this.unlockAndInit();
    if (!this.ctx) return;

    this.currentTaalId = taalId;
    this.taalBpm = Math.max(30, Math.min(240, bpm));
    this.taalBeatCounter = 0;
    this.onMatraChange = onMatra;
    this.nextBeatTimeSec = this.ctx.currentTime + 0.03;

    const lookaheadMs = 25;
    const scheduleAheadSec = 0.1;

    const scheduler = () => {
      if (!this.ctx || this.currentTaalId === "none") return;
      while (this.nextBeatTimeSec < this.ctx.currentTime + scheduleAheadSec) {
        const step = getTaalMatra(this.currentTaalId, this.taalBeatCounter);
        this.playTablaBol(step.bol, step.marker, this.nextBeatTimeSec);

        const delayMs = Math.max(
          0,
          (this.nextBeatTimeSec - this.ctx.currentTime) * 1000,
        );
        window.setTimeout(() => {
          if (this.currentTaalId !== "none") {
            this.onMatraChange?.(step);
          }
        }, delayMs);

        const secondsPerBeat = 60 / this.taalBpm;
        this.nextBeatTimeSec += secondsPerBeat;
        this.taalBeatCounter++;
      }
    };

    scheduler();
    this.taalTimerId = window.setInterval(scheduler, lookaheadMs);
  }

  public setTaalBpm(bpm: number): void {
    this.taalBpm = Math.max(30, Math.min(240, bpm));
  }

  public stopTaalLoop(): void {
    if (this.taalTimerId !== null) {
      window.clearInterval(this.taalTimerId);
      this.taalTimerId = null;
    }
    this.currentTaalId = "none";
    this.onMatraChange?.(null);
  }

  public updateSettings(partial: Partial<AudioSettings>): void {
    this.settings = { ...this.settings, ...partial };
    if (!this.ctx || !this.masterGain || !this.dryGain || !this.wetGain) return;

    const now = this.ctx.currentTime;
    const effectiveVolume = this.settings.muted ? 0 : this.settings.volume;
    this.masterGain.gain.setTargetAtTime(effectiveVolume, now, 0.02);

    this.wetGain.gain.setTargetAtTime(this.settings.reverbMix, now, 0.03);
    this.dryGain.gain.setTargetAtTime(
      1 - this.settings.reverbMix * 0.4,
      now,
      0.03,
    );

    this.voiceManager.updateBellowsExpression(this.ctx, this.settings.bellows);
    this.syncDrone();
  }

  private setupMasterChain(ctx: AudioContext): void {
    this.masterGain = ctx.createGain();
    this.dryGain = ctx.createGain();
    this.wetGain = ctx.createGain();
    this.convolver = ctx.createConvolver();
    this.convolver.buffer = this.createRoomImpulse(ctx, 1.1, 2.8);

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-10, ctx.currentTime);
    compressor.knee.setValueAtTime(12, ctx.currentTime);
    compressor.ratio.setValueAtTime(4, ctx.currentTime);

    this.dryGain.connect(compressor);
    this.wetGain.connect(this.convolver);
    this.convolver.connect(compressor);
    compressor.connect(this.masterGain);
    this.masterGain.connect(ctx.destination);

    this.updateSettings(this.settings);
  }

  private createNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const length = Math.floor(ctx.sampleRate * 0.2);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  private createRoomImpulse(
    ctx: AudioContext,
    durationSec: number,
    decay: number,
  ): AudioBuffer {
    const length = Math.floor(ctx.sampleRate * durationSec);
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const channelData = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        channelData[i] =
          (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }
    return impulse;
  }

  private syncDrone(): void {
    if (!this.ctx || !this.masterGain) return;

    for (const osc of this.droneOscs) {
      try {
        osc.stop();
        osc.disconnect();
      } catch {
        // Ignore stopped osc
      }
    }
    this.droneOscs = [];
    if (this.droneGain) {
      try {
        this.droneGain.disconnect();
      } catch {
        // Ignore
      }
      this.droneGain = null;
    }

    if (!this.settings.droneEnabled || this.settings.muted) return;

    const saMidi = getTonicReferenceMidi(this.settings.tonic, -1);
    const paMidi = saMidi + 7;
    const madhyaSaMidi = saMidi + 12;

    const droneGain = this.ctx.createGain();
    droneGain.gain.setValueAtTime(0.001, this.ctx.currentTime);
    droneGain.gain.linearRampToValueAtTime(0.065, this.ctx.currentTime + 0.25);

    const droneFilter = this.ctx.createBiquadFilter();
    droneFilter.type = "lowpass";
    droneFilter.frequency.setValueAtTime(950, this.ctx.currentTime);

    droneGain.connect(droneFilter);
    droneFilter.connect(this.masterGain);

    for (const midi of [saMidi, paMidi, madhyaSaMidi]) {
      const osc = this.ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(midiToFrequency(midi), this.ctx.currentTime);
      osc.connect(droneGain);
      osc.start();
      this.droneOscs.push(osc);
    }

    this.droneGain = droneGain;
  }
}

export const audioEngine = new HarmoniumAudioEngine();
