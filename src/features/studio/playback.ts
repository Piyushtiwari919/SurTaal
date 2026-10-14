import { Composition, CompositionNoteEvent } from "./compositionTypes";

export interface PlaybackCallbacks {
  onNoteStart: (note: CompositionNoteEvent) => void;
  onNoteEnd: (note: CompositionNoteEvent) => void;
  onProgress: (elapsedMs: number, totalMs: number) => void;
  onBeat?: (beatIndex: number) => void;
  onComplete: () => void;
}

export class CompositionPlayer {
  private timerId: number | null = null;
  private isPlaying = false;
  private isPaused = false;
  private loop = false;
  private metronome = false;
  private tempoScale = 1;
  private elapsedMs = 0;
  private lastTickPerfMs = 0;
  private triggeredStarts = new Set<string>();
  private triggeredEnds = new Set<string>();
  private activeNotes = new Map<string, CompositionNoteEvent>();
  private lastBeatNumber = -1;

  public start(
    composition: Composition,
    options: { loop: boolean; metronome: boolean; playbackBpm: number },
    callbacks: PlaybackCallbacks,
  ): void {
    this.stop(callbacks);
    if (composition.notes.length === 0) {
      callbacks.onComplete();
      return;
    }

    this.loop = options.loop;
    this.metronome = options.metronome;
    this.tempoScale = options.playbackBpm / Math.max(30, composition.bpm);
    this.isPlaying = true;
    this.isPaused = false;
    this.elapsedMs = 0;
    this.lastTickPerfMs = performance.now();
    this.triggeredStarts.clear();
    this.triggeredEnds.clear();
    this.activeNotes.clear();
    this.lastBeatNumber = -1;

    const totalMs = this.computeTotalDurationMs(composition);

    const tick = () => {
      if (!this.isPlaying || this.isPaused) return;
      const now = performance.now();
      const deltaMs = (now - this.lastTickPerfMs) * this.tempoScale;
      this.lastTickPerfMs = now;
      this.elapsedMs += deltaMs;

      if (this.metronome) {
        const beatIntervalMs = 60000 / composition.bpm;
        const currentBeat = Math.floor(this.elapsedMs / beatIntervalMs);
        if (currentBeat > this.lastBeatNumber) {
          this.lastBeatNumber = currentBeat;
          callbacks.onBeat?.(currentBeat);
        }
      }

      for (const note of composition.notes) {
        const endMs = note.startTimeMs + note.durationMs;
        if (
          this.elapsedMs >= note.startTimeMs &&
          !this.triggeredStarts.has(note.id)
        ) {
          this.triggeredStarts.add(note.id);
          this.activeNotes.set(note.id, note);
          callbacks.onNoteStart(note);
        }
        if (this.elapsedMs >= endMs && !this.triggeredEnds.has(note.id)) {
          this.triggeredEnds.add(note.id);
          this.activeNotes.delete(note.id);
          callbacks.onNoteEnd(note);
        }
      }

      callbacks.onProgress(Math.min(this.elapsedMs, totalMs), totalMs);

      if (this.elapsedMs >= totalMs + 80) {
        for (const active of this.activeNotes.values()) {
          callbacks.onNoteEnd(active);
        }
        this.activeNotes.clear();

        if (this.loop) {
          this.elapsedMs = 0;
          this.triggeredStarts.clear();
          this.triggeredEnds.clear();
          this.lastBeatNumber = -1;
        } else {
          this.isPlaying = false;
          if (this.timerId !== null) window.clearInterval(this.timerId);
          this.timerId = null;
          callbacks.onComplete();
          return;
        }
      }
    };

    this.timerId = window.setInterval(tick, 16);
  }

  public pause(callbacks: PlaybackCallbacks): void {
    if (!this.isPlaying || this.isPaused) return;
    this.isPaused = true;
    for (const active of this.activeNotes.values()) {
      callbacks.onNoteEnd(active);
    }
    this.activeNotes.clear();
  }

  public resume(): void {
    if (!this.isPlaying || !this.isPaused) return;
    this.isPaused = false;
    this.lastTickPerfMs = performance.now();
  }

  public stop(callbacks: PlaybackCallbacks): void {
    if (this.timerId !== null) {
      window.clearInterval(this.timerId);
      this.timerId = null;
    }
    for (const active of this.activeNotes.values()) {
      callbacks.onNoteEnd(active);
    }
    this.activeNotes.clear();
    this.isPlaying = false;
    this.isPaused = false;
    this.elapsedMs = 0;
  }

  public computeTotalDurationMs(composition: Composition): number {
    if (composition.notes.length === 0) return 0;
    return Math.max(
      ...composition.notes.map((n) => n.startTimeMs + n.durationMs),
    );
  }
}
