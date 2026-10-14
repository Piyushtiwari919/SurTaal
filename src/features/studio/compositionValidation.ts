import { isValidMidi, PitchClass } from "../harmonium/music/pitch";
import { Composition, CompositionNoteEvent } from "./compositionTypes";

export interface ValidationResult {
  valid: boolean;
  composition?: Composition;
  error?: string;
}

export function validateCompositionPayload(raw: unknown): ValidationResult {
  if (!raw || typeof raw !== "object") {
    return { valid: false, error: "Imported file must be a JSON object." };
  }

  const candidate = raw as Record<string, unknown>;

  if (candidate.schemaVersion !== 1) {
    return {
      valid: false,
      error: `Unsupported composition schemaVersion "${String(candidate.schemaVersion)}". Expected version 1.`,
    };
  }

  if (
    typeof candidate.title !== "string" ||
    candidate.title.trim().length === 0
  ) {
    return {
      valid: false,
      error: "Composition title must be a non-empty string.",
    };
  }

  const sanitizedTitle = candidate.title.trim().slice(0, 80);

  if (
    typeof candidate.tonic !== "number" ||
    !Number.isInteger(candidate.tonic) ||
    candidate.tonic < 0 ||
    candidate.tonic > 11
  ) {
    return {
      valid: false,
      error: "Composition tonic must be an integer between 0 (C) and 11 (B).",
    };
  }

  if (
    typeof candidate.bpm !== "number" ||
    candidate.bpm < 30 ||
    candidate.bpm > 240
  ) {
    return {
      valid: false,
      error: "Composition BPM must be between 30 and 240.",
    };
  }

  if (!Array.isArray(candidate.notes)) {
    return { valid: false, error: "Composition notes field must be an array." };
  }

  const validatedNotes: CompositionNoteEvent[] = [];

  for (let i = 0; i < candidate.notes.length; i++) {
    const n = candidate.notes[i] as Record<string, unknown>;
    if (!n || typeof n !== "object") {
      return { valid: false, error: `Note at index ${i} is malformed.` };
    }
    if (typeof n.midi !== "number" || !isValidMidi(n.midi)) {
      return {
        valid: false,
        error: `Note at index ${i} has an invalid MIDI pitch (${String(n.midi)}). Allowed range is 36..96.`,
      };
    }
    if (
      typeof n.startTimeMs !== "number" ||
      n.startTimeMs < 0 ||
      !Number.isFinite(n.startTimeMs)
    ) {
      return {
        valid: false,
        error: `Note at index ${i} has an invalid startTimeMs.`,
      };
    }
    if (
      typeof n.durationMs !== "number" ||
      n.durationMs <= 0 ||
      n.durationMs > 60000 ||
      !Number.isFinite(n.durationMs)
    ) {
      return {
        valid: false,
        error: `Note at index ${i} has an invalid durationMs.`,
      };
    }

    const tonic = candidate.tonic as PitchClass;
    const relativeOffset =
      typeof n.relativeOffset === "number" && Number.isInteger(n.relativeOffset)
        ? n.relativeOffset
        : n.midi - (60 + tonic);

    validatedNotes.push({
      id:
        typeof n.id === "string" && n.id.length > 0
          ? n.id
          : `note-${i}-${Date.now()}`,
      midi: n.midi,
      relativeOffset,
      startTimeMs: Math.round(n.startTimeMs),
      durationMs: Math.round(n.durationMs),
      velocity:
        typeof n.velocity === "number"
          ? Math.max(0.1, Math.min(1, n.velocity))
          : 0.9,
    });
  }

  return {
    valid: true,
    composition: {
      schemaVersion: 1,
      id:
        typeof candidate.id === "string" && candidate.id.length > 0
          ? candidate.id
          : `comp-${Date.now()}`,
      title: sanitizedTitle,
      createdAt:
        typeof candidate.createdAt === "string"
          ? candidate.createdAt
          : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tonic: candidate.tonic as PitchClass,
      bpm: Math.round(candidate.bpm),
      notes: validatedNotes.sort((a, b) => a.startTimeMs - b.startTimeMs),
    },
  };
}
