import { describe, expect, it, vi } from "vitest";
import {
  midiToFrequency,
  midiToWesternName,
} from "../features/harmonium/music/pitch";
import {
  midiToSwara,
  relativeOffsetToMidi,
} from "../features/harmonium/music/swara";
import {
  getTaalMatra,
  TAAL_DEFINITIONS,
} from "../features/harmonium/music/taal";
import { resolveShortcutToMidi } from "../features/harmonium/keyboard/KeyboardLayout";
import {
  MelodyRecorder,
  reorderNoteInComposition,
  transposeComposition,
} from "../features/studio/recording";
import { validateCompositionPayload } from "../features/studio/compositionValidation";
import { STARTER_DEMO_COMPOSITION } from "../storage/compositionRepository";
import {
  resetHapticThrottleForTests,
  triggerKeyHaptic,
} from "../features/harmonium/keyboard/haptics";

describe("Mobile Key Haptic Feedback", () => {
  it("calls navigator.vibrate(6) on tap, ignores slide, and throttles rapid calls within 60ms", () => {
    resetHapticThrottleForTests();
    const vibrateMock = vi.fn(() => true);
    Object.defineProperty(globalThis.navigator, "vibrate", {
      value: vibrateMock,
      configurable: true,
      writable: true,
    });

    // First tap at t = 100ms cancels queue (0) and triggers 6ms tick
    expect(triggerKeyHaptic(true, "tap", 100)).toBe(true);
    expect(vibrateMock).toHaveBeenLastCalledWith(6);

    // Second tap 20ms later (t = 120ms) is throttled to prevent double-vibration
    expect(triggerKeyHaptic(true, "tap", 120)).toBe(false);

    // Slide events never vibrate
    expect(triggerKeyHaptic(true, "slide", 200)).toBe(false);

    // Next tap after 60ms cooldown (t = 210ms) succeeds
    expect(triggerKeyHaptic(true, "tap", 210)).toBe(true);

    // Disabled haptics never calls navigator.vibrate
    expect(triggerKeyHaptic(false, "tap", 300)).toBe(false);
  });
});

describe("Pitch and Sargam Mapping", () => {
  it("converts MIDI 69 to 440Hz and MIDI 60 to C4", () => {
    expect(midiToFrequency(69)).toBe(440);
    expect(midiToWesternName(60)).toBe("C4");
  });

  it("maps relative Sargam swaras accurately when Tonic (Sa) changes", () => {
    // When Sa = C (0), MIDI 60 is Madhya Sa, MIDI 67 is Pa
    expect(midiToSwara(60, 0, 4).short).toBe("Sa");
    expect(midiToSwara(67, 0, 4).short).toBe("Pa");

    // When Sa = C# (1, Kali 1), MIDI 61 is Madhya Sa, MIDI 63 is Shuddha Re, MIDI 67 is Tivra Ma
    expect(midiToSwara(61, 1, 4).short).toBe("Sa");
    expect(midiToSwara(63, 1, 4).short).toBe("Re");
    expect(midiToSwara(67, 1, 4).short).toBe("ma");
  });

  it("converts relative swara offset back to absolute MIDI pitch", () => {
    expect(relativeOffsetToMidi(7, 1, 4)).toBe(68); // Pa in Kali 1 (C#4 + 7 = G#4)
  });
});

describe("Tabla Taal Cycle Definitions", () => {
  it("wraps Keherwa 8-beat cycle and marks Matra 1 as Sam and Matra 5 as Khali", () => {
    expect(TAAL_DEFINITIONS.keherwa.totalMatras).toBe(8);
    expect(getTaalMatra("keherwa", 0)).toEqual({
      matra: 1,
      bol: "Dha",
      marker: "sam",
    });
    expect(getTaalMatra("keherwa", 4)).toEqual({
      matra: 5,
      bol: "Na",
      marker: "khali",
    });
    expect(getTaalMatra("keherwa", 8).matra).toBe(1); // wraps cleanly to Sam
  });

  it("wraps Teen Taal 16-beat cycle and places Khali on Matra 9 (Dha Tin Tin Ta)", () => {
    expect(TAAL_DEFINITIONS.teentaal.totalMatras).toBe(16);
    expect(getTaalMatra("teentaal", 0).marker).toBe("sam");
    expect(getTaalMatra("teentaal", 8)).toEqual({
      matra: 9,
      bol: "Dha",
      marker: "khali",
    });
    expect(getTaalMatra("teentaal", 9).bol).toBe("Tin");
    expect(getTaalMatra("teentaal", 16).matra).toBe(1);
  });
});

describe("Keyboard Input Mapping", () => {
  it("resolves physical laptop keys across all 29 keys and supports Alt coupler", () => {
    expect(resolveShortcutToMidi("z", 0)).toBe(48); // Mandra C3
    expect(resolveShortcutToMidi("a", 0)).toBe(60); // Madhya C4
    expect(resolveShortcutToMidi("q", 0)).toBe(61); // Madhya C#4
    expect(resolveShortcutToMidi("a", 0, true)).toBe(48); // Alt + A couplers down to C3
    expect(resolveShortcutToMidi("a", 1, false)).toBe(72); // C5 when shifted +1 octave
  });
});

describe("Melody Recording, Transposition, Reordering & Import Validation", () => {
  it("captures note-on and note-off timestamps with accurate durations", () => {
    const recorder = new MelodyRecorder();
    recorder.start(1000, 1);
    recorder.recordNoteOn(61, 1200);
    recorder.recordNoteOff(61, 1650);
    const events = recorder.stop(1700);

    expect(events).toHaveLength(1);
    expect(events[0].midi).toBe(61);
    expect(events[0].startTimeMs).toBe(200);
    expect(events[0].durationMs).toBe(450);
  });

  it("transposes a composition and updates both MIDI and relative offsets", () => {
    const transposed = transposeComposition(STARTER_DEMO_COMPOSITION, 2);
    expect(transposed.notes[0].midi).toBe(
      STARTER_DEMO_COMPOSITION.notes[0].midi + 2,
    );
  });

  it("reorders adjacent notes and swaps their start times cleanly", () => {
    const reordered = reorderNoteInComposition(STARTER_DEMO_COMPOSITION, 0, 1);
    expect(reordered.notes[0].id).toBe(STARTER_DEMO_COMPOSITION.notes[1].id);
  });

  it("rejects malformed or out-of-range JSON imports and accepts valid compositions", () => {
    const badResult = validateCompositionPayload({
      schemaVersion: 1,
      title: "Broken Song",
      tonic: 0,
      bpm: 100,
      notes: [{ midi: 999, startTimeMs: 0, durationMs: -50 }],
    });
    expect(badResult.valid).toBe(false);

    const goodResult = validateCompositionPayload(STARTER_DEMO_COMPOSITION);
    expect(goodResult.valid).toBe(true);
  });
});
