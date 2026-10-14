import { PitchClass } from "../features/harmonium/music/pitch";
import { ReedMode } from "../features/harmonium/music/tuning";

export type ThemeId =
  | "classic-ivory"
  | "peacock"
  | "midnight-riyaaz"
  | "sunset-mehfil";

export interface UserPreferences {
  theme: ThemeId;
  tonic: PitchClass;
  octaveShift: number;
  volume: number;
  muted: boolean;
  reedMode: ReedMode;
  bellows: number;
  reverbMix: number;
  droneEnabled: boolean;
  showSwaraLabels: boolean;
  showWesternLabels: boolean;
  hapticsEnabled: boolean;
}

const STORAGE_KEY = "surtaal_preferences_v1";

export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: "classic-ivory",
  tonic: 1, // C# (Kali 1)
  octaveShift: 0,
  volume: 0.82,
  muted: false,
  reedMode: "double",
  bellows: 0.85,
  reverbMix: 0.15,
  droneEnabled: false,
  showSwaraLabels: true,
  showWesternLabels: true,
  hapticsEnabled: true,
};

export function loadPreferences(): UserPreferences {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<UserPreferences>;
    return { ...DEFAULT_PREFERENCES, ...parsed };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function savePreferences(prefs: UserPreferences): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Gracefully ignore storage quota errors
  }
}
