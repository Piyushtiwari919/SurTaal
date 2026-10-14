import { isBlackKey, midiToWesternName, PitchClass } from "../music/pitch";
import { midiToSwara, SwaraInfo } from "../music/swara";

export interface KeyDescriptor {
  midi: number;
  westernName: string;
  isBlack: boolean;
  swara: SwaraInfo;
  shortcutKey?: string;
}

// Physical computer keyboard mapping spanning 20 semitones (from base C to G of next octave)
export const KEYBOARD_SHORTCUT_OFFSETS: Record<string, number> = {
  a: 0,
  w: 1,
  s: 2,
  e: 3,
  d: 4,
  f: 5,
  t: 6,
  g: 7,
  y: 8,
  h: 9,
  u: 10,
  j: 11,
  k: 12,
  o: 13,
  l: 14,
  p: 15,
  ";": 16,
  "'": 17,
};

const OFFSET_TO_SHORTCUT: Record<number, string> = Object.entries(
  KEYBOARD_SHORTCUT_OFFSETS,
).reduce(
  (acc, [key, offset]) => {
    acc[offset] = key.toUpperCase();
    return acc;
  },
  {} as Record<number, string>,
);

export function buildKeyboardKeys(
  octaveShift: number,
  tonic: PitchClass,
  totalKeys = 29,
): KeyDescriptor[] {
  // Base C3 = 48 when octaveShift = -1, C4 = 60 when octaveShift = 0 (starts at F3 = 53 or C3 = 48)
  const startMidi = 48 + (octaveShift + 1) * 12; // Default octaveShift 0 -> starts at C4 (60) - 12 = 48 (C3) to E5 (76)
  const baseMidi = startMidi - 12; // 48 (C3) at octaveShift=0

  return Array.from({ length: totalKeys }, (_, index) => {
    const midi = baseMidi + index;
    // Map laptop shortcuts to the middle playable octave starting 7 semitones into the visible range (or C4 = 60)
    const shortcutOffset = midi - (baseMidi + 12);
    return {
      midi,
      westernName: midiToWesternName(midi),
      isBlack: isBlackKey(midi),
      swara: midiToSwara(midi, tonic, 4),
      shortcutKey: OFFSET_TO_SHORTCUT[shortcutOffset],
    };
  });
}

export function resolveShortcutToMidi(
  key: string,
  octaveShift: number,
): number | null {
  const normalized = key.toLowerCase();
  const offset = KEYBOARD_SHORTCUT_OFFSETS[normalized];
  if (offset === undefined) return null;
  const baseC4 = 60 + octaveShift * 12;
  return baseC4 + offset;
}
