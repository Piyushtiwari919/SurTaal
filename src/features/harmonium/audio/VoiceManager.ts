export interface ActiveVoice {
  midi: number;
  state: "held" | "releasing";
  sources: OscillatorNode[];
  subGains: GainNode[];
  filter: BiquadFilterNode;
  gain: GainNode;
  targetGain: number;
  cleanupTimerId: number | null;
}

export class VoiceManager {
  private voicesByMidi = new Map<number, ActiveVoice>();
  private readonly maxPolyphony: number;

  constructor(maxPolyphony = 16) {
    this.maxPolyphony = maxPolyphony;
  }

  public getActiveMidis(): number[] {
    const held: number[] = [];
    for (const [midi, v] of this.voicesByMidi.entries()) {
      if (v.state === "held") held.push(midi);
    }
    return held;
  }

  public hasVoice(midi: number): boolean {
    const v = this.voicesByMidi.get(midi);
    return v !== undefined && v.state === "held";
  }

  /**
   * Re-energizes an already-vibrating reed in-place using `setTargetAtTime`.
   * Because `setTargetAtTime` starts seamlessly from the exact current audio-thread sample value,
   * there is ZERO gap, ZERO click, and ZERO chance of resetting gain to 0.
   */
  public tryRetriggerExistingVoice(
    ctx: AudioContext,
    midi: number,
    targetGain: number,
    cutoffFreq: number,
  ): boolean {
    const existing = this.voicesByMidi.get(midi);
    if (!existing) return false;

    if (existing.cleanupTimerId !== null) {
      window.clearTimeout(existing.cleanupTimerId);
      existing.cleanupTimerId = null;
    }

    const now = ctx.currentTime;

    try {
      existing.gain.gain.setTargetAtTime(targetGain, now, 0.01);
      existing.filter.frequency.setTargetAtTime(cutoffFreq, now, 0.015);
      existing.state = "held";
      existing.targetGain = targetGain;
      return true;
    } catch {
      this.forceDestroyVoice(existing, ctx);
      this.voicesByMidi.delete(midi);
      return false;
    }
  }

  public registerVoice(ctx: AudioContext, voice: ActiveVoice): void {
    const existing = this.voicesByMidi.get(voice.midi);
    if (existing) {
      this.forceDestroyVoice(existing, ctx);
      this.voicesByMidi.delete(voice.midi);
    }

    if (this.voicesByMidi.size >= this.maxPolyphony) {
      let victimMidi: number | null = null;
      for (const [midi, v] of this.voicesByMidi.entries()) {
        if (v.state === "releasing") {
          victimMidi = midi;
          break;
        }
      }
      if (victimMidi === null) {
        victimMidi = this.voicesByMidi.keys().next().value ?? null;
      }
      if (victimMidi !== null) {
        const victim = this.voicesByMidi.get(victimMidi);
        if (victim) {
          this.forceDestroyVoice(victim, ctx);
          this.voicesByMidi.delete(victimMidi);
        }
      }
    }

    this.voicesByMidi.set(voice.midi, voice);
  }

  /**
   * Releases a note using a smooth exponential air-valve timeConstant (`0.038s`).
   * Never calls `cancelScheduledValues` or reads `param.value` on the JS thread,
   * so rapid notes and sustained notes alike decay smoothly without ever breaking.
   */
  public releaseVoice(
    ctx: AudioContext,
    midi: number,
    releaseTimeSec = 0.18,
  ): void {
    const voice = this.voicesByMidi.get(midi);
    if (!voice || voice.state === "releasing") return;

    const now = ctx.currentTime;
    voice.state = "releasing";

    try {
      voice.gain.gain.setTargetAtTime(0.0001, now, 0.038);

      voice.cleanupTimerId = window.setTimeout(
        () => {
          const latest = this.voicesByMidi.get(midi);
          if (latest === voice && voice.state === "releasing") {
            this.voicesByMidi.delete(midi);
            this.forceDestroyVoice(voice);
          }
        },
        (releaseTimeSec + 0.05) * 1000,
      );
    } catch {
      this.voicesByMidi.delete(midi);
      this.forceDestroyVoice(voice, ctx);
    }
  }

  private forceDestroyVoice(voice: ActiveVoice, ctx?: AudioContext): void {
    if (voice.cleanupTimerId !== null) {
      window.clearTimeout(voice.cleanupTimerId);
      voice.cleanupTimerId = null;
    }

    if (ctx) {
      try {
        voice.gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.005);
      } catch {
        // Ignore if context is closed
      }
    }

    for (const src of voice.sources) {
      try {
        src.stop();
        src.disconnect();
      } catch {
        // Ignore already stopped
      }
    }
    for (const sg of voice.subGains) {
      try {
        sg.disconnect();
      } catch {
        // Ignore
      }
    }
    try {
      voice.filter.disconnect();
      voice.gain.disconnect();
    } catch {
      // Ignore
    }
  }

  public updateBellowsExpression(
    ctx: AudioContext,
    bellowsIntensity: number,
  ): void {
    const now = ctx.currentTime;
    const targetGain = 0.15 + bellowsIntensity * 0.13;
    const cutoff = 1200 + bellowsIntensity * 900;

    for (const voice of this.voicesByMidi.values()) {
      if (voice.state === "held") {
        voice.targetGain = targetGain;
        voice.gain.gain.setTargetAtTime(targetGain, now, 0.035);
        voice.filter.frequency.setTargetAtTime(cutoff, now, 0.035);
      }
    }
  }

  public releaseAll(ctx: AudioContext | null): void {
    if (!ctx) {
      for (const v of this.voicesByMidi.values()) {
        this.forceDestroyVoice(v);
      }
      this.voicesByMidi.clear();
      return;
    }
    for (const midi of Array.from(this.voicesByMidi.keys())) {
      this.releaseVoice(ctx, midi, 0.08);
    }
  }
}
