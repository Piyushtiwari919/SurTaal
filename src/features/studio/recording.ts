import { clampMidi, transposeMidi } from "../harmonium/music/tuning";
import { PitchClass } from "../harmonium/music/pitch";
import { Composition, CompositionNoteEvent } from "./compositionTypes";

interface OpenNoteSession {
  midi: number;
  startTimeMs: number;
}

export class MelodyRecorder {
  private isRecordingFlag = false;
  private startTimestampMs = 0;
  private openNotes = new Map<number, OpenNoteSession>();
  private recordedEvents: CompositionNoteEvent[] = [];
  private tonic: PitchClass = 0;

  public start(nowMs: number, tonic: PitchClass): void {
    this.isRecordingFlag = true;
    this.startTimestampMs = nowMs;
    this.tonic = tonic;
    this.openNotes.clear();
    this.recordedEvents = [];
  }

  public isRecording(): boolean {
    return this.isRecordingFlag;
  }

  public recordNoteOn(midi: number, nowMs: number): void {
    if (!this.isRecordingFlag) return;
    if (this.openNotes.has(midi)) {
      this.recordNoteOff(midi, nowMs);
    }
    const relativeStart = Math.max(
      0,
      Math.round(nowMs - this.startTimestampMs),
    );
    this.openNotes.set(midi, { midi, startTimeMs: relativeStart });
  }

  public recordNoteOff(midi: number, nowMs: number): void {
    if (!this.isRecordingFlag) return;
    const open = this.openNotes.get(midi);
    if (!open) return;

    this.openNotes.delete(midi);
    const endTimeMs = Math.max(
      open.startTimeMs + 60,
      Math.round(nowMs - this.startTimestampMs),
    );
    const durationMs = Math.max(60, endTimeMs - open.startTimeMs);

    this.recordedEvents.push({
      id: `ev-${this.recordedEvents.length + 1}-${open.startTimeMs}`,
      midi: open.midi,
      relativeOffset: open.midi - (60 + this.tonic),
      startTimeMs: open.startTimeMs,
      durationMs,
      velocity: 0.9,
    });
  }

  public stop(nowMs: number): CompositionNoteEvent[] {
    if (!this.isRecordingFlag) return this.recordedEvents;
    for (const midi of Array.from(this.openNotes.keys())) {
      this.recordNoteOff(midi, nowMs);
    }
    this.isRecordingFlag = false;
    return [...this.recordedEvents].sort(
      (a, b) => a.startTimeMs - b.startTimeMs,
    );
  }
}

export function transposeComposition(
  comp: Composition,
  semitones: number,
): Composition {
  const updatedNotes = comp.notes.map((n) => {
    const transposed =
      transposeMidi(n.midi, semitones) ?? clampMidi(n.midi + semitones);
    return {
      ...n,
      midi: transposed,
      relativeOffset: transposed - (60 + comp.tonic),
    };
  });

  return {
    ...comp,
    updatedAt: new Date().toISOString(),
    notes: updatedNotes,
  };
}

export function updateNoteInComposition(
  comp: Composition,
  noteId: string,
  updater: (note: CompositionNoteEvent) => CompositionNoteEvent,
): Composition {
  return {
    ...comp,
    updatedAt: new Date().toISOString(),
    notes: comp.notes.map((n) => (n.id === noteId ? updater(n) : n)),
  };
}

export function reorderNoteInComposition(
  comp: Composition,
  index: number,
  direction: -1 | 1,
): Composition {
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= comp.notes.length) return comp;

  const cloned = [...comp.notes];
  const current = { ...cloned[index] };
  const neighbor = { ...cloned[targetIndex] };

  // Swap their start times so chronological playback order swaps cleanly
  const tempStart = current.startTimeMs;
  current.startTimeMs = neighbor.startTimeMs;
  neighbor.startTimeMs = tempStart;

  cloned[index] = neighbor;
  cloned[targetIndex] = current;

  return {
    ...comp,
    updatedAt: new Date().toISOString(),
    notes: cloned.sort((a, b) => a.startTimeMs - b.startTimeMs),
  };
}
