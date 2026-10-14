import { PitchClass } from './pitch';

export interface SwaraInfo {
  short: string;
  full: string;
  devanagari: string;
  variant: 'shuddha' | 'komal' | 'tivra' | 'achala';
  semitoneOffset: number;
  saptak: 'mandra' | 'madhya' | 'taar';
  displayWithOctave: string;
}

const SWARA_TABLE: Omit<SwaraInfo, 'saptak' | 'displayWithOctave'>[] = [
  { short: 'Sa', full: 'Shadja (Sa)', devanagari: 'सा', variant: 'achala', semitoneOffset: 0 },
  { short: 're', full: 'Komal Rishabh (re)', devanagari: 'रे॒', variant: 'komal', semitoneOffset: 1 },
  { short: 'Re', full: 'Shuddha Rishabh (Re)', devanagari: 'रे', variant: 'shuddha', semitoneOffset: 2 },
  { short: 'ga', full: 'Komal Gandhar (ga)', devanagari: 'ग॒', variant: 'komal', semitoneOffset: 3 },
  { short: 'Ga', full: 'Shuddha Gandhar (Ga)', devanagari: 'ग', variant: 'shuddha', semitoneOffset: 4 },
  { short: 'Ma', full: 'Shuddha Madhyam (Ma)', devanagari: 'म', variant: 'shuddha', semitoneOffset: 5 },
  { short: 'ma', full: 'Tivra Madhyam (M तीव्र)', devanagari: 'म तीव्र', variant: 'tivra', semitoneOffset: 6 },
  { short: 'Pa', full: 'Pancham (Pa)', devanagari: 'प', variant: 'achala', semitoneOffset: 7 },
  { short: 'dha', full: 'Komal Dhaivat (dha)', devanagari: 'ध॒', variant: 'komal', semitoneOffset: 8 },
  { short: 'Dha', full: 'Shuddha Dhaivat (Dha)', devanagari: 'ध', variant: 'shuddha', semitoneOffset: 9 },
  { short: 'ni', full: 'Komal Nishad (ni)', devanagari: 'नि॒', variant: 'komal', semitoneOffset: 10 },
  { short: 'Ni', full: 'Shuddha Nishad (Ni)', devanagari: 'नि', variant: 'shuddha', semitoneOffset: 11 }
];

/**
 * Maps an absolute MIDI note to its relative Indian Swara given the chosen tonic PitchClass
 * and the base middle-octave reference (default C4 = 60 + tonicPitchClass).
 */
export function midiToSwara(midi: number, tonic: PitchClass, madhyaBaseOctave = 4): SwaraInfo {
  const madhyaSaMidi = (madhyaBaseOctave + 1) * 12 + tonic;
  const diffFromMadhyaSa = midi - madhyaSaMidi;
  const semitoneOffset = ((diffFromMadhyaSa % 12) + 12) % 12;
  const baseSwara = SWARA_TABLE[semitoneOffset];

  let saptak: 'mandra' | 'madhya' | 'taar' = 'madhya';
  let displayWithOctave = baseSwara.short;

  if (diffFromMadhyaSa < 0) {
    saptak = 'mandra';
    displayWithOctave = `${baseSwara.short}̣`; // dot below for lower octave
  } else if (diffFromMadhyaSa >= 12) {
    saptak = 'taar';
    displayWithOctave = `${baseSwara.short}̇`; // dot above for upper octave
  }

  return {
    ...baseSwara,
    saptak,
    displayWithOctave
  };
}

export function relativeOffsetToMidi(
  relativeOffset: number,
  tonic: PitchClass,
  madhyaBaseOctave = 4
): number {
  const madhyaSaMidi = (madhyaBaseOctave + 1) * 12 + tonic;
  return madhyaSaMidi + relativeOffset;
}