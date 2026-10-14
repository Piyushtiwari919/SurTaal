export interface ActiveVoice {
  midi: number;
  state: "held" | "releasing";
  sources: OscillatorNode[];
  subGains: GainNode[];
  filter: BiquadFilterNode;
  gain: GainNode;
  targetGain: number;
  attackDurationSec: number;
  startedAt: number;
  releaseStartAt: number;
  releaseStartGain: number;
  releaseDurationSec: number;
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

  private estimateCurrentGain(voice: ActiveVoice, now: number): number {
    if (voice.state === "held") {
      const elapsed = Math.max(0, now - voice.startedAt);
      if (elapsed < voice.attackDurationSec) {
        return Math.max(
          0.01,
          voice.targetGain * (elapsed / voice.attackDurationSec),
        );
      }
      return voice.targetGain;
    } else {
      const relElapsed = Math.max(0, now - voice.releaseStartAt);
      const progress = Math.min(
        1,
        relElapsed / Math.max(0.02, voice.releaseDurationSec),
      );
      return Math.max(
        0.002,
        voice.releaseStartGain * Math.pow(1 - progress, 1.8),
      );
    }
  }

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
    const currentGain = this.estimateCurrentGain(existing, now);
    const param = existing.gain.gain as AudioParam & {
      cancelAndHoldAtTime?: (t: number) => AudioParam;
    };

    try {
      if (typeof param.cancelAndHoldAtTime === "function") {
        param.cancelAndHoldAtTime(now);
      } else {
        param.cancelScheduledValues(now);
        param.setValueAtTime(currentGain, now);
      }

      param.linearRampToValueAtTime(targetGain, now + 0.012);
      existing.filter.frequency.setTargetAtTime(cutoffFreq, now, 0.02);

      existing.state = "held";
      existing.targetGain = targetGain;
      existing.attackDurationSec = 0.012;
      existing.startedAt = now;
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
      let oldestTime = Infinity;

      for (const [midi, v] of this.voicesByMidi.entries()) {
        const sortTime =
          v.state === "releasing" ? v.startedAt - 1000 : v.startedAt;
        if (sortTime < oldestTime) {
          oldestTime = sortTime;
          victimMidi = midi;
        }
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

  public releaseVoice(
    ctx: AudioContext,
    midi: number,
    releaseTimeSec = 0.22,
  ): void {
    const voice = this.voicesByMidi.get(midi);
    if (!voice || voice.state === "releasing") return;

    const now = ctx.currentTime;
    const currentGain = this.estimateCurrentGain(voice, now);

    voice.state = "releasing";
    voice.releaseStartAt = now;
    voice.releaseStartGain = currentGain;
    voice.releaseDurationSec = releaseTimeSec;

    try {
      const param = voice.gain.gain as AudioParam & {
        cancelAndHoldAtTime?: (t: number) => AudioParam;
      };

      if (typeof param.cancelAndHoldAtTime === "function") {
        param.cancelAndHoldAtTime(now);
      } else {
        param.cancelScheduledValues(now);
        param.setValueAtTime(currentGain, now);
      }

      const bridgeTime = Math.min(0.065, releaseTimeSec * 0.35);
      param.linearRampToValueAtTime(currentGain * 0.72, now + bridgeTime);
      param.linearRampToValueAtTime(0.0001, now + releaseTimeSec);

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
        const now = ctx.currentTime;
        voice.gain.gain.cancelScheduledValues(now);
        voice.gain.gain.setValueAtTime(0.0001, now);
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
    const targetGain = 0.18 + bellowsIntensity * 0.24;
    const cutoff = 1500 + bellowsIntensity * 1400;

    for (const voice of this.voicesByMidi.values()) {
      if (
        voice.state === "held" &&
        now - voice.startedAt > voice.attackDurationSec
      ) {
        voice.targetGain = targetGain;
        voice.gain.gain.setTargetAtTime(targetGain, now, 0.05);
      }
      voice.filter.frequency.setTargetAtTime(cutoff, now, 0.05);
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
