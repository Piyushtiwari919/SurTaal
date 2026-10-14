export interface ActiveVoice {
  midi: number;
  sources: AudioBufferSourceNode[];
  subGains: GainNode[];
  filter: BiquadFilterNode;
  gain: GainNode;
  targetGain: number;
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
    // If the same note is already playing, crossfade it out gently over 55ms so there is zero gap
    if (this.activeVoices.has(voice.midi)) {
      this.fadeOutAndDetachVoice(
        ctx,
        this.activeVoices.get(voice.midi)!,
        0.055,
      );
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
        this.releaseVoice(ctx, oldestMidi, 0.06);
      }
    }

    this.activeVoices.set(voice.midi, voice);
  }

  public releaseVoice(
    ctx: AudioContext,
    midi: number,
    releaseTimeSec = 0.16,
  ): void {
    const voice = this.activeVoices.get(midi);
    if (!voice) return;

    this.activeVoices.delete(midi);
    this.fadeOutAndDetachVoice(ctx, voice, releaseTimeSec);
  }

  private fadeOutAndDetachVoice(
    ctx: AudioContext,
    voice: ActiveVoice,
    releaseTimeSec: number,
  ): void {
    const now = ctx.currentTime;

    try {
      voice.gain.gain.cancelScheduledValues(now);
      const currentVal = Math.max(
        0.0001,
        voice.gain.gain.value || voice.targetGain,
      );
      voice.gain.gain.setValueAtTime(currentVal, now);
      // Smooth linear-to-exponential air valve release without sudden drop
      voice.gain.gain.exponentialRampToValueAtTime(
        0.0001,
        now + releaseTimeSec,
      );

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
      voice.targetGain = targetGain;
      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setTargetAtTime(targetGain, now, 0.05);
      voice.filter.frequency.setTargetAtTime(cutoff, now, 0.05);
    }
  }

  public releaseAll(ctx: AudioContext | null): void {
    if (!ctx) {
      this.activeVoices.clear();
      return;
    }
    for (const midi of Array.from(this.activeVoices.keys())) {
      this.releaseVoice(ctx, midi, 0.06);
    }
  }
}
