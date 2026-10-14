export type PitchClass = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

export const WESTERN_NOTE_NAMES: readonly string[] = [
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'
];

export const HARMONIUM_TONIC_LABELS: Record<PitchClass, string> = {
  0: 'C (Safed 1)',
  1: 'C# (Kali 1)',
  2: 'D (Safed 2)',
  3: 'D# (Kali 2)',
  4: 'E (Safed 3)',
  5: 'F (Safed 4)',
  6: 'F# (Kali 3)',
  7: 'G (Safed 5)',
  8: 'G# (Kali 4)',
  9: 'A (Safed 6)',
  10: 'A# (Kali 5)',
  11: 'B (Safed 7)'
};

export const MIN_MIDI = 36; // C2
export const MAX_MIDI = 96; // C7

export function isValidMidi(midi: number): boolean {
  return Number.isInteger(midi) && midi >= MIN_MIDI && midi <= MAX_MIDI;
}

export function midiToFrequency(midi: number, referenceA4 = 440): number {
  return Number((referenceA4 * Math.pow(2, (midi - 69) / 12)).toFixed(3));
}

export function midiToPitchClass(midi: number): PitchClass {
  return (((midi % 12) + 12) % 12) as PitchClass;
}

export function midiToOctave(midi: number): number {
  return Math.floor(midi / 12) - 1;
}

export function midiToWesternName(midi: number): string {
  const pc = midiToPitchClass(midi);
  const octave = midiToOctave(midi);
  return `${WESTERN_NOTE_NAMES[pc]}${octave}`;
}

export function isBlackKey(midi: number): boolean {
  const pc = midiToPitchClass(midi);
  return pc === 1 || pc === 3 || pc === 6 || pc === 8 || pc === 10;
}