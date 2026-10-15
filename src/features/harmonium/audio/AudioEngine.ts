import { midiToFrequency, PitchClass } from "../music/pitch";
import {
  getTaalMatra,
  TablaBol,
  TaalId,
  TaalMatra,
  VibhagMarker,
} from "../music/taal";
import { clampMidi, getTonicReferenceMidi, ReedMode } from "../music/tuning";
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
  private voiceBus: GainNode | null = null;
  private masterGain: GainNode | null = null;
  private dryGain: GainNode | null = null;
  private wetGain: GainNode | null = null;
  private droneSources: OscillatorNode[] = [];
  private droneGain: GainNode | null = null;
  private activeDroneStateKey = "";
  private noiseBuffer: AudioBuffer | null = null;

  private sampleBank = new SampleBank();
  private voiceManager = new VoiceManager(16);

  private taalTimerId: number | null = null;
  private currentTaalId: TaalId = "none";
  private taalBpm = 96;
  private taalBeatCounter = 0;
  private nextBeatTimeSec = 0;
  private onMatraChange?: (step: TaalMatra | null) => void;

  private settings: AudioSettings = {
    volume: 0.85,
    muted: false,
    reedMode: "double",
    bellows: 0.85,
    reverbMix: 0.12,
    droneEnabled: false,
    tonic: 1,
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
    if (!this.ctx || !this.voiceBus) return;

    const freq = midiToFrequency(midi);
    const keyTrackedCutoff = Math.min(
      2100,
      Math.max(900, freq * 3.8) + this.settings.bellows * 500,
    );
    const targetGain = Math.max(
      0.06,
      (0.15 + this.settings.bellows * 0.13) * velocity,
    );

    // If this note's reed is already vibrating, re-open its air valve seamlessly in-place
    if (
      this.voiceManager.tryRetriggerExistingVoice(
        this.ctx,
        midi,
        targetGain,
        keyTrackedCutoff,
      )
    ) {
      return;
    }

    const now = this.ctx.currentTime;
    const reedPair = this.sampleBank.getOrCreateReedPair(this.ctx, midi);

    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(keyTrackedCutoff, now);
    filter.Q.setValueAtTime(0.5, now);

    const voiceGain = this.ctx.createGain();
    // Use setTargetAtTime for sample-accurate, click-free bellows air attack
    voiceGain.gain.setValueAtTime(0.0001, now);
    voiceGain.gain.setTargetAtTime(targetGain, now, 0.01);

    const sources: OscillatorNode[] = [];
    const subGains: GainNode[] = [];

    // 1. Primary 8' Nar Reed (Unbroken, steady Indian harmonium voice)
    const narOsc = this.ctx.createOscillator();
    narOsc.setPeriodicWave(reedPair.nar);
    narOsc.frequency.setValueAtTime(freq, now);

    const narGain = this.ctx.createGain();
    narGain.gain.setValueAtTime(0.7, now);
    narOsc.connect(narGain);
    narGain.connect(filter);
    narOsc.start(now);
    sources.push(narOsc);
    subGains.push(narGain);

    // 2. Secondary 8' Mada Reed (Gentle +2.0 cents upper-harmonic chorus)
    if (
      this.settings.reedMode === "double" ||
      this.settings.reedMode === "triple"
    ) {
      const madaOsc = this.ctx.createOscillator();
      madaOsc.setPeriodicWave(reedPair.mada);
      madaOsc.frequency.setValueAtTime(freq, now);
      madaOsc.detune.setValueAtTime(2.0, now);

      const madaGain = this.ctx.createGain();
      madaGain.gain.setValueAtTime(0.26, now);
      madaOsc.connect(madaGain);
      madaGain.connect(filter);
      madaOsc.start(now);
      sources.push(madaOsc);
      subGains.push(madaGain);
    }

    // 3. Third 4' Zava Octave Reed (Triple Reed mode)
    if (this.settings.reedMode === "triple") {
      const octaveMidi = clampMidi(midi + 12);
      const octavePair = this.sampleBank.getOrCreateReedPair(
        this.ctx,
        octaveMidi,
      );
      const taarOsc = this.ctx.createOscillator();
      taarOsc.setPeriodicWave(octavePair.nar);
      taarOsc.frequency.setValueAtTime(midiToFrequency(octaveMidi), now);
      taarOsc.detune.setValueAtTime(-1.2, now);

      const taarGain = this.ctx.createGain();
      taarGain.gain.setValueAtTime(0.14, now);
      taarOsc.connect(taarGain);
      taarGain.connect(filter);
      taarOsc.start(now);
      sources.push(taarOsc);
      subGains.push(taarGain);
    }

    filter.connect(voiceGain);
    voiceGain.connect(this.voiceBus);

    this.voiceManager.registerVoice(this.ctx, {
      midi,
      state: "held",
      sources,
      subGains,
      filter,
      gain: voiceGain,
      targetGain,
      cleanupTimerId: null,
    });
  }

  public noteOff(midi: number): void {
    if (!this.ctx) return;
    this.voiceManager.releaseVoice(this.ctx, midi, 0.18);
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
    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.05);
  }

  public playTablaBol(
    bol: TablaBol,
    marker: VibhagMarker = "regular",
    scheduledTime?: number,
  ): void {
    if (!this.ctx || !this.voiceBus || this.settings.muted) return;
    const t = scheduledTime ?? this.ctx.currentTime;
    const accentBoost =
      marker === "sam" ? 1.2 : marker === "tali" ? 1.08 : 0.92;

    const saMidi = getTonicReferenceMidi(this.settings.tonic, 0);
    const dayanFreq = midiToFrequency(saMidi);

    switch (bol) {
      case "Dha":
        this.synthBayanGe(t, 0.25 * accentBoost, true);
        this.synthDayanOpen(t, dayanFreq, "kran", 0.22 * accentBoost);
        break;
      case "Dhin":
        this.synthBayanGe(t, 0.24 * accentBoost, true);
        this.synthDayanOpen(t, dayanFreq, "sur", 0.2 * accentBoost);
        break;
      case "Tin":
        this.synthDayanOpen(t, dayanFreq, "sur", 0.22 * accentBoost);
        break;
      case "Ta":
      case "Na":
        this.synthDayanOpen(t, dayanFreq, "kran", 0.24 * accentBoost);
        break;
      case "Ge":
        this.synthBayanGe(t, 0.24 * accentBoost, false);
        break;
      case "Ti":
        this.synthDayanClosedTi(t, dayanFreq, 0.18 * accentBoost);
        break;
      case "Ka":
        this.synthBayanClosedKa(t, 0.19 * accentBoost);
        break;
    }
  }

  private synthBayanGe(t: number, peakGain: number, bendUp: boolean): void {
    if (!this.ctx || !this.voiceBus) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";

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
    gain.connect(this.voiceBus);

    osc.start(t);
    osc.stop(t + 0.44);

    this.triggerTransientNoise(t, 240, 1.5, peakGain * 0.25, 0.025);
  }

  private synthBayanClosedKa(t: number, peakGain: number): void {
    if (!this.ctx || !this.voiceBus) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(135, t);
    osc.frequency.exponentialRampToValueAtTime(62, t + 0.055);

    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(peakGain, t + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.065);

    osc.connect(gain);
    gain.connect(this.voiceBus);

    osc.start(t);
    osc.stop(t + 0.07);

    this.triggerTransientNoise(t, 420, 1.8, peakGain * 0.45, 0.03);
  }

  private synthDayanOpen(
    t: number,
    saFreq: number,
    style: "kran" | "sur",
    peakGain: number,
  ): void {
    if (!this.ctx || !this.voiceBus) return;

    const fundOsc = this.ctx.createOscillator();
    const overtoneOsc = this.ctx.createOscillator();
    const fundGain = this.ctx.createGain();
    const overtoneGain = this.ctx.createGain();

    fundOsc.type = "sine";
    overtoneOsc.type = "triangle";

    fundOsc.frequency.setValueAtTime(saFreq * 1.03, t);
    fundOsc.frequency.exponentialRampToValueAtTime(saFreq, t + 0.025);

    const overtoneRatio = style === "kran" ? 2.02 : 1.5;
    overtoneOsc.frequency.setValueAtTime(saFreq * overtoneRatio, t);

    const decaySec = style === "sur" ? 0.36 : 0.26;

    fundGain.gain.setValueAtTime(0.0001, t);
    fundGain.gain.linearRampToValueAtTime(peakGain, t + 0.005);
    fundGain.gain.exponentialRampToValueAtTime(0.0001, t + decaySec);

    overtoneGain.gain.setValueAtTime(0.0001, t);
    overtoneGain.gain.linearRampToValueAtTime(
      style === "kran" ? peakGain * 0.45 : peakGain * 0.22,
      t + 0.004,
    );
    overtoneGain.gain.exponentialRampToValueAtTime(0.0001, t + decaySec * 0.65);

    fundOsc.connect(fundGain);
    overtoneOsc.connect(overtoneGain);
    fundGain.connect(this.voiceBus);
    overtoneGain.connect(this.voiceBus);

    fundOsc.start(t);
    overtoneOsc.start(t);
    fundOsc.stop(t + decaySec + 0.02);
    overtoneOsc.stop(t + decaySec + 0.02);

    this.triggerTransientNoise(
      t,
      style === "kran" ? 2000 : 1300,
      2.2,
      peakGain * 0.35,
      0.018,
    );
  }

  private synthDayanClosedTi(
    t: number,
    saFreq: number,
    peakGain: number,
  ): void {
    if (!this.ctx || !this.voiceBus) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(saFreq * 1.15, t);
    osc.frequency.exponentialRampToValueAtTime(saFreq * 0.85, t + 0.045);

    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(peakGain, t + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.055);

    osc.connect(gain);
    gain.connect(this.voiceBus);

    osc.start(t);
    osc.stop(t + 0.06);

    this.triggerTransientNoise(t, 1500, 2.0, peakGain * 0.4, 0.02);
  }

  private triggerTransientNoise(
    t: number,
    centerFreq: number,
    q: number,
    peakGain: number,
    durationSec: number,
  ): void {
    if (!this.ctx || !this.voiceBus || !this.noiseBuffer) return;

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
    gain.connect(this.voiceBus);

    src.start(t);
    src.stop(t + durationSec + 0.01);
  }

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
    this.masterGain.gain.setTargetAtTime(effectiveVolume, now, 0.025);

    this.wetGain.gain.setTargetAtTime(
      this.settings.reverbMix * 0.25,
      now,
      0.03,
    );
    this.dryGain.gain.setTargetAtTime(1.0, now, 0.03);

    this.voiceManager.updateBellowsExpression(this.ctx, this.settings.bellows);
    this.syncDrone();
  }

  /**
   * Clean, Zero-Clipping Acoustic Wooden Chamber Chain:
   * - Replaces the noisy FFT ConvolverNode with a clean 32ms wooden body reflection delay
   *   so sustained melodies never overload or duck the browser audio output.
   */
  private setupMasterChain(ctx: AudioContext): void {
    this.voiceBus = ctx.createGain();
    this.masterGain = ctx.createGain();
    this.dryGain = ctx.createGain();
    this.wetGain = ctx.createGain();

    const highpassFilter = ctx.createBiquadFilter();
    highpassFilter.type = "highpass";
    highpassFilter.frequency.setValueAtTime(185, ctx.currentTime);
    highpassFilter.Q.setValueAtTime(0.707, ctx.currentTime);

    const antiMudEq = ctx.createBiquadFilter();
    antiMudEq.type = "peaking";
    antiMudEq.frequency.setValueAtTime(300, ctx.currentTime);
    antiMudEq.Q.setValueAtTime(1.3, ctx.currentTime);
    antiMudEq.gain.setValueAtTime(-3.0, ctx.currentTime);

    const woodBodyEq = ctx.createBiquadFilter();
    woodBodyEq.type = "peaking";
    woodBodyEq.frequency.setValueAtTime(650, ctx.currentTime);
    woodBodyEq.Q.setValueAtTime(0.9, ctx.currentTime);
    woodBodyEq.gain.setValueAtTime(2.0, ctx.currentTime);

    const jaliMellowFilter = ctx.createBiquadFilter();
    jaliMellowFilter.type = "lowpass";
    jaliMellowFilter.frequency.setValueAtTime(1900, ctx.currentTime);
    jaliMellowFilter.Q.setValueAtTime(0.55, ctx.currentTime);

    // Clean wooden-room acoustic reflection (replaces noisy ConvolverNode)
    const roomDelay = ctx.createDelay(0.1);
    roomDelay.delayTime.setValueAtTime(0.032, ctx.currentTime);
    const roomDamping = ctx.createBiquadFilter();
    roomDamping.type = "lowpass";
    roomDamping.frequency.setValueAtTime(1200, ctx.currentTime);

    this.voiceBus.connect(highpassFilter);
    highpassFilter.connect(antiMudEq);
    antiMudEq.connect(woodBodyEq);
    woodBodyEq.connect(jaliMellowFilter);

    jaliMellowFilter.connect(this.dryGain);
    jaliMellowFilter.connect(roomDelay);
    roomDelay.connect(roomDamping);
    roomDamping.connect(this.wetGain);

    this.dryGain.connect(this.masterGain);
    this.wetGain.connect(this.masterGain);
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

  private syncDrone(): void {
    if (!this.ctx || !this.voiceBus) return;

    const nextDroneKey = `${this.settings.droneEnabled && !this.settings.muted}-${this.settings.tonic}`;
    if (nextDroneKey === this.activeDroneStateKey) {
      return;
    }
    this.activeDroneStateKey = nextDroneKey;

    for (const src of this.droneSources) {
      try {
        src.stop();
        src.disconnect();
      } catch {
        // Ignore stopped source
      }
    }
    this.droneSources = [];
    if (this.droneGain) {
      try {
        this.droneGain.disconnect();
      } catch {
        // Ignore
      }
      this.droneGain = null;
    }

    if (!this.settings.droneEnabled || this.settings.muted) return;

    const madhyaSaMidi = getTonicReferenceMidi(this.settings.tonic, 0);
    const mandraPaMidi = madhyaSaMidi - 5;

    const droneGain = this.ctx.createGain();
    droneGain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
    droneGain.gain.setTargetAtTime(0.055, this.ctx.currentTime, 0.12);

    const droneFilter = this.ctx.createBiquadFilter();
    droneFilter.type = "lowpass";
    droneFilter.frequency.setValueAtTime(1000, this.ctx.currentTime);

    droneGain.connect(droneFilter);
    droneFilter.connect(this.voiceBus);

    const saPair = this.sampleBank.getOrCreateReedPair(this.ctx, madhyaSaMidi);
    const paPair = this.sampleBank.getOrCreateReedPair(this.ctx, mandraPaMidi);

    const droneConfigs = [
      { wave: paPair.nar, midi: mandraPaMidi, detune: 0 },
      { wave: saPair.nar, midi: madhyaSaMidi, detune: 0 },
      { wave: saPair.mada, midi: madhyaSaMidi, detune: 1.5 },
    ];

    for (const cfg of droneConfigs) {
      const osc = this.ctx.createOscillator();
      osc.setPeriodicWave(cfg.wave);
      osc.frequency.setValueAtTime(
        midiToFrequency(cfg.midi),
        this.ctx.currentTime,
      );
      osc.detune.setValueAtTime(cfg.detune, this.ctx.currentTime);
      osc.connect(droneGain);
      try {
        osc.start();
      } catch {
        // Ignore
      }
      this.droneSources.push(osc);
    }

    this.droneGain = droneGain;
  }
}

export const audioEngine = new HarmoniumAudioEngine();
