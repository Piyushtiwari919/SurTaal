export interface PracticeExercise {
  id: string;
  title: string;
  subtitle: string;
  difficulty: "Beginner" | "Easy" | "Intermediate";
  description: string;
  /** Relative semitone offsets from Madhya Sa (0 = Sa, 2 = Re, 4 = Ga, 5 = Ma, 7 = Pa, 9 = Dha, 11 = Ni, 12 = Taar Sa) */
  steps: {
    offset: number;
    durationBeats: number;
    lyricHint: string;
  }[];
  defaultBpm: number;
}

export const PRACTICE_EXERCISES: PracticeExercise[] = [
  {
    id: "alankar-1-aroha",
    title: "Alankar 1: Finding Your Sargam",
    subtitle: "Ascending & descending through the seven pure swaras",
    difficulty: "Beginner",
    description:
      "Sa is your home base. Practise walking smoothly up from Madhya Sa to Taar Sa and back down to build finger comfort.",
    defaultBpm: 84,
    steps: [
      { offset: 0, durationBeats: 1, lyricHint: "Sa" },
      { offset: 2, durationBeats: 1, lyricHint: "Re" },
      { offset: 4, durationBeats: 1, lyricHint: "Ga" },
      { offset: 5, durationBeats: 1, lyricHint: "Ma" },
      { offset: 7, durationBeats: 1, lyricHint: "Pa" },
      { offset: 9, durationBeats: 1, lyricHint: "Dha" },
      { offset: 11, durationBeats: 1, lyricHint: "Ni" },
      { offset: 12, durationBeats: 2, lyricHint: "Sȧ" },
      { offset: 11, durationBeats: 1, lyricHint: "Ni" },
      { offset: 9, durationBeats: 1, lyricHint: "Dha" },
      { offset: 7, durationBeats: 1, lyricHint: "Pa" },
      { offset: 5, durationBeats: 1, lyricHint: "Ma" },
      { offset: 4, durationBeats: 1, lyricHint: "Ga" },
      { offset: 2, durationBeats: 1, lyricHint: "Re" },
      { offset: 0, durationBeats: 2, lyricHint: "Sa" },
    ],
  },
  {
    id: "alankar-2-twins",
    title: "Alankar 2: Twin-Note Rhythm",
    subtitle: "Repeating each swara twice for steady reed control",
    difficulty: "Beginner",
    description:
      "Press each key twice with an even pulse so your fingers learn clean release without blurring notes.",
    defaultBpm: 92,
    steps: [
      { offset: 0, durationBeats: 1, lyricHint: "Sa" },
      { offset: 0, durationBeats: 1, lyricHint: "Sa" },
      { offset: 2, durationBeats: 1, lyricHint: "Re" },
      { offset: 2, durationBeats: 1, lyricHint: "Re" },
      { offset: 4, durationBeats: 1, lyricHint: "Ga" },
      { offset: 4, durationBeats: 1, lyricHint: "Ga" },
      { offset: 5, durationBeats: 1, lyricHint: "Ma" },
      { offset: 5, durationBeats: 1, lyricHint: "Ma" },
      { offset: 7, durationBeats: 2, lyricHint: "Pa" },
    ],
  },
  {
    id: "raag-bhupali-motif",
    title: "Raag Bhupali: Peaceful Pentatonic",
    subtitle:
      "Five serene notes (Sa Re Ga Pa Dha) used across Indian folk and classical music",
    difficulty: "Easy",
    description:
      "Raag Bhupali omits Ma and Ni, creating an immediately uplifting and harmonious sound where every note blends warmly.",
    defaultBpm: 88,
    steps: [
      { offset: 0, durationBeats: 1, lyricHint: "Sa" },
      { offset: 2, durationBeats: 1, lyricHint: "Re" },
      { offset: 4, durationBeats: 1.5, lyricHint: "Ga" },
      { offset: 2, durationBeats: 0.5, lyricHint: "Re" },
      { offset: 0, durationBeats: 1, lyricHint: "Sa" },
      { offset: 2, durationBeats: 1, lyricHint: "Re" },
      { offset: 4, durationBeats: 1, lyricHint: "Ga" },
      { offset: 7, durationBeats: 1, lyricHint: "Pa" },
      { offset: 9, durationBeats: 1, lyricHint: "Dha" },
      { offset: 12, durationBeats: 2, lyricHint: "Sȧ" },
      { offset: 9, durationBeats: 1, lyricHint: "Dha" },
      { offset: 7, durationBeats: 1, lyricHint: "Pa" },
      { offset: 4, durationBeats: 1, lyricHint: "Ga" },
      { offset: 2, durationBeats: 1, lyricHint: "Re" },
      { offset: 0, durationBeats: 2, lyricHint: "Sa" },
    ],
  },
  {
    id: "evening-yaman-phrase",
    title: "Sandhya Riyaaz: Evening Yaman Phrase",
    subtitle: "Introducing Tivra Ma (the raised fourth swara)",
    difficulty: "Intermediate",
    description:
      "Hear how Tivra Ma adds a golden evening glow when moving between Ga, Tivra Ma, Pa, and Ni.",
    defaultBpm: 80,
    steps: [
      { offset: -1, durationBeats: 1, lyricHint: "Nị" },
      { offset: 2, durationBeats: 1, lyricHint: "Re" },
      { offset: 4, durationBeats: 1.5, lyricHint: "Ga" },
      { offset: 6, durationBeats: 1, lyricHint: "ma (Tivra)" },
      { offset: 7, durationBeats: 1.5, lyricHint: "Pa" },
      { offset: 6, durationBeats: 1, lyricHint: "ma" },
      { offset: 4, durationBeats: 1, lyricHint: "Ga" },
      { offset: 2, durationBeats: 1, lyricHint: "Re" },
      { offset: 0, durationBeats: 2, lyricHint: "Sa" },
    ],
  },
];
