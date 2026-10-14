import { isValidMidi, MAX_MIDI, MIN_MIDI, PitchClass } from './pitch';

export type ReedMode = 'single' | 'double' | 'triple';

export function clampMidi(midi: number): number {
  return Math.max(MIN_MIDI, Math.min(MAX_MIDI, Math.round(midi)));
}

export function transposeMidi(midi: number, semitones: number): number | null {
  const target = midi + semitones;
  return isValidMidi(target) ? target : null;
}

export function getTonicReferenceMidi(tonic: PitchClass, octaveShift = 0): number {
  const baseMadhyaSa = 60 + tonic; // C4 (60) + tonic offset
  return clampMidi(baseMadhyaSa + octaveShift * 12);
}