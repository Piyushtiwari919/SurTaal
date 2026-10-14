import { isBlackKey, midiToWesternName, PitchClass } from "../music/pitch";
import { midiToSwara, SwaraInfo } from "../music/swara";

export interface KeyDescriptor {
  midi: number;
  westernName: string;
  isBlack: boolean;
  swara: SwaraInfo;
  shortcutKey?: string;
}

/**
 * Complete 29-Key PC Keyboard Mapping (Offsets 0 to 28 from base C3 = MIDI 48):
 *
 * - Lower Octave (Mandra Saptak, Offsets 0..11, C3..B3):
 *   White keys: Z (0), X (2), C (4), V (5), B (7), N (9), M (11)
 *   Black keys: 1 (1), 2 (3), 3 (6), 4 (8), 5 (10)
 *
 * - Middle & Upper Octave (Madhya & Taar Saptak, Offsets 12..28, C4..E5):
 *   White keys: A (12), S (14), D (16), F (17), G (19), H (21), J (23), K (24), L (26), ; (28)
 *   Black keys: Q (13), W (15), E (18), R (20), T (22), Y (25), U (27)
 *   Extra Upper White aliases: , (24 / C5), . (26 / D5), / (28 / E5)
 */
export const KEYBOARD_SHORTCUT_OFFSETS: Record<string, number> = {
  // Mandra Saptak (Lower Octave: C3 to B3 -> offsets 0..11)
  z: 0,
  "1": 1,
  x: 2,
  "2": 3,
  c: 4,
  v: 5,
  "3": 6,
  b: 7,
  "4": 8,
  n: 9,
  "5": 10,
  m: 11,

  // Madhya Saptak (Middle Octave: C4 to B4 -> offsets 12..23)
  a: 12,
  q: 13,
  s: 14,
  w: 15,
  d: 16,
  f: 17,
  e: 18,
  g: 19,
  r: 20,
  h: 21,
  t: 22,
  j: 23,

  // Taar Saptak (Upper Octave: C5 to E5 -> offsets 24..28)
  k: 24,
  ",": 24,
  y: 25,
  l: 26,
  ".": 26,
  u: 27,
  ";": 28,
  "/": 28,
  "'": 28,
};

// Display badges shown on the 29 keys (prioritizing primary ergonomic letter keys)
const OFFSET_TO_PRIMARY_BADGE: Record<number, string> = {
  0: "Z",
  1: "1",
  2: "X",
  3: "2",
  4: "C",
  5: "V",
  6: "3",
  7: "B",
  8: "4",
  9: "N",
  10: "5",
  11: "M",
  12: "A",
  13: "Q",
  14: "S",
  15: "W",
  16: "D",
  17: "F",
  18: "E",
  19: "G",
  20: "R",
  21: "H",
  22: "T",
  23: "J",
  24: "K",
  25: "Y",
  26: "L",
  27: "U",
  28: ";",
};

export function buildKeyboardKeys(
  octaveShift: number,
  tonic: PitchClass,
  totalKeys = 29,
): KeyDescriptor[] {
  const baseMidi = 48 + octaveShift * 12; // Default octaveShift 0 -> starts at C3 (48) up to E5 (76)

  return Array.from({ length: totalKeys }, (_, index) => {
    const midi = baseMidi + index;
    return {
      midi,
      westernName: midiToWesternName(midi),
      isBlack: isBlackKey(midi),
      swara: midiToSwara(midi, tonic, 4),
      shortcutKey: OFFSET_TO_PRIMARY_BADGE[index],
    };
  });
}

/**
 * Resolves a physical keyboard key to its MIDI note.
 * - Normal press: plays the exact mapped key across all 29 keys.
 * - Holding `Alt` + Middle-row key (`A..;`): shifts that note down 1 octave (-12 semitones)
 *   so players who keep hands on `A S D F G H J K` can play Mandra Saptak using `Alt`.
 * - Holding `Alt` + Lower-row key (`Z..M`): shifts that note up 2 octaves (+24 semitones).
 */
export function resolveShortcutToMidi(
  key: string,
  octaveShift: number,
  altHeld = false,
): number | null {
  const normalized = key.toLowerCase();
  const offset = KEYBOARD_SHORTCUT_OFFSETS[normalized];
  if (offset === undefined) return null;

  const baseC3 = 48 + octaveShift * 12;
  let finalOffset = offset;

  if (altHeld) {
    if (offset >= 12) {
      finalOffset = offset - 12; // Alt + A..L drops into Mandra Saptak
    } else {
      finalOffset = Math.min(28, offset + 12); // Alt + Z..M jumps up an octave
    }
  }

  return baseC3 + finalOffset;
}
