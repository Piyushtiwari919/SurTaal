import { PitchClass } from "../harmonium/music/pitch";

/**
 * Canonical Note Event stored in compositions.
 * Stores BOTH absolute MIDI pitch (`midi`) and relative semitone offset (`relativeOffset`)
 * from the composition's `tonic` so transpositions and tonic changes are deterministic.
 */
export interface CompositionNoteEvent {
  id: string;
  midi: number;
  relativeOffset: number;
  startTimeMs: number;
  durationMs: number;
  velocity: number;
}

export interface Composition {
  schemaVersion: 1;
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  tonic: PitchClass;
  bpm: number;
  notes: CompositionNoteEvent[];
}
