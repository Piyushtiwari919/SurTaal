export interface ActiveVoice {
  midi: number;
  sources: OscillatorNode[];
  subGains: GainNode[];
  filter: BiquadFilterNode;
  gain: GainNode;
  targetGain: number;
  attackDurationSec: number;
  startedAt: number;
}

export class VoiceManager {
  private activeVoices = new Map<number, ActiveVoice>();
  private readonly maxPolyphony: number;

  constructor(maxPolyphony = 14) {
    this.maxPolyphony = maxPolyphony;
  }

  public getActiveMidis(): number[] {
    return Array.from(this.activeVoices.keys());
  }

  public hasVoice(midi: number): boolean {
    return this.activeVoices.has(midi);
  }

  public registerVoice(ctx: AudioContext, voice: ActiveVoice): void {
    // If the same note is re-pressed while still ringing, crossfade it smoothly over 80ms
    const existing = this.activeVoices.get(voice.midi);
    if (existing) {
      this.fadeOutAndDetachVoice(ctx, existing, 0.08);
      this.activeVoices.delete(voice.midi);
    }

    if (this.activeVoices.size >= this.maxPolyphony) {
      let oldestMidi: number | null = null;
      let oldestTime = Infinity;
      for (const [midi, active] of this.activeVoices.entries()) {
        if (active.startedAt < oldestTime) {
          oldestTime = active.startedAt;
          oldestMidi = midi;
        }
      }
      if (oldestMidi !== null) {
        this.releaseVoice(ctx, oldestMidi, 0.08);
      }
    }

    this.activeVoices.set(voice.midi, voice);
  }

  public releaseVoice(
    ctx: AudioContext,
    midi: number,
    releaseTimeSec = 0.28,
  ): void {
    const voice = this.activeVoices.get(midi);
    if (!voice) return;

    this.activeVoices.delete(midi);
    this.fadeOutAndDetachVoice(ctx, voice, releaseTimeSec);
  }

  /**
   * Simulates the physical Harmonium Bellows Air Reservoir on key release:
   * 1. Computes exact current gain BEFORE canceling automation so gain never snaps to 0.0001.
   * 2. Holds 70% of the reed body for the first 75ms (bridging finger transitions between notes).
   * 3. Smoothly fades out the remaining air tail over the rest of releaseTimeSec.
   */
  private fadeOutAndDetachVoice(
    ctx: AudioContext,
    voice: ActiveVoice,
    releaseTimeSec: number,
  ): void {
    const now = ctx.currentTime;
    const elapsed = Math.max(0, now - voice.startedAt);

    // Compute exact current envelope value mathematically so cancelScheduledValues never zeros it out
    const estimatedGain =
      elapsed < voice.attackDurationSec
        ? Math.max(0.02, voice.targetGain * (elapsed / voice.attackDurationSec))
        : voice.targetGain;

    try {
      const param = voice.gain.gain as AudioParam & {
        cancelAndHoldAtTime?: (time: number) => AudioParam;
      };

      if (typeof param.cancelAndHoldAtTime === "function") {
        param.cancelAndHoldAtTime(now);
      } else {
        param.cancelScheduledValues(now);
        param.setValueAtTime(estimatedGain, now);
      }

      // Stage 1: Bellows Air-Reservoir Bridge (keeps note warm while finger moves to next key)
      const bridgeTime = Math.min(0.075, releaseTimeSec * 0.35);
      param.linearRampToValueAtTime(estimatedGain * 0.68, now + bridgeTime);

      // Stage 2: Smooth acoustic decay in wooden chamber
      param.exponentialRampToValueAtTime(0.0008, now + releaseTimeSec);

      for (const src of voice.sources) {
        src.stop(now + releaseTimeSec + 0.03);
      }

      window.setTimeout(
        () => {
          try {
            for (const src of voice.sources) {
              src.disconnect();
            }
            for (const sg of voice.subGains) {
              sg.disconnect();
            }
            voice.filter.disconnect();
            voice.gain.disconnect();
          } catch {
            // Ignore already disconnected nodes
          }
        },
        (releaseTimeSec + 0.08) * 1000,
      );
    } catch {
      // Fallback cleanup if context is closed
    }
  }

  public updateBellowsExpression(
    ctx: AudioContext,
    bellowsIntensity: number,
  ): void {
    const now = ctx.currentTime;
    const targetGain = 0.18 + bellowsIntensity * 0.24;
    const cutoff = 1500 + bellowsIntensity * 1400;

    for (const voice of this.activeVoices.values()) {
      // Only adjust notes that have completed their initial 18ms attack ramp
      if (now - voice.startedAt > voice.attackDurationSec) {
        voice.targetGain = targetGain;
        voice.gain.gain.setTargetAtTime(targetGain, now, 0.05);
      }
      voice.filter.frequency.setTargetAtTime(cutoff, now, 0.05);
    }
  }

  public releaseAll(ctx: AudioContext | null): void {
    if (!ctx) {
      this.activeVoices.clear();
      return;
    }
    for (const midi of Array.from(this.activeVoices.keys())) {
      this.releaseVoice(ctx, midi, 0.08);
    }
  }
}
