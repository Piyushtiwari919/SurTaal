import React, { useCallback, useEffect, useRef, useState } from "react";
import { audioEngine } from "../features/harmonium/audio/AudioEngine";
import { UnifiedInputController } from "../features/harmonium/keyboard/InputController";
import { triggerKeyHaptic } from "../features/harmonium/keyboard/haptics";
import { HarmoniumKeyboard } from "../features/harmonium/components/HarmoniumKeyboard";
import { InstrumentControls } from "../features/harmonium/components/InstrumentControls";
import { KeyMapModal } from "../features/harmonium/components/KeyMapModal";
import { LearnMode } from "../features/learn/LearnMode";
import { PracticeExercise } from "../features/learn/practiceData";
import { SongStudio } from "../features/studio/SongStudio";
import { Composition } from "../features/studio/compositionTypes";
import { MelodyRecorder } from "../features/studio/recording";
import { CompositionPlayer } from "../features/studio/playback";
import {
  compositionRepository,
  STARTER_DEMO_COMPOSITION,
} from "../storage/compositionRepository";
import {
  loadPreferences,
  savePreferences,
  ThemeId,
  UserPreferences,
} from "../storage/settingsRepository";
import {
  HARMONIUM_TONIC_LABELS,
  midiToWesternName,
} from "../features/harmonium/music/pitch";
import {
  midiToSwara,
  relativeOffsetToMidi,
} from "../features/harmonium/music/swara";
import {
  getTaalMatra,
  TaalId,
  TaalMatra,
} from "../features/harmonium/music/taal";

type AppMode = "play" | "learn" | "studio";

export const App: React.FC = () => {
  const [prefs, setPrefs] = useState<UserPreferences>(() => loadPreferences());
  const [mode, setMode] = useState<AppMode>("play");
  const [audioUnlocked, setAudioUnlocked] = useState<boolean>(false);
  const [activeMidis, setActiveMidis] = useState<Set<number>>(new Set());
  const [lastPlayedMidi, setLastPlayedMidi] = useState<number | null>(null);
  const [expectedLearnMidi, setExpectedLearnMidi] = useState<number | null>(
    null,
  );
  const [showKeyMap, setShowKeyMap] = useState<boolean>(false);
  const [mobileControlsOpen, setMobileControlsOpen] = useState<boolean>(false);

  const [activeComposition, setActiveComposition] = useState<Composition>(
    STARTER_DEMO_COMPOSITION,
  );
  const [undoStack, setUndoStack] = useState<Composition[]>([]);
  const [savedCompositions, setSavedCompositions] = useState<Composition[]>([
    STARTER_DEMO_COMPOSITION,
  ]);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [loopEnabled, setLoopEnabled] = useState<boolean>(false);
  const [metronomeEnabled, setMetronomeEnabled] = useState<boolean>(false);
  const [selectedTaal, setSelectedTaal] = useState<TaalId>("none");
  const [currentMatra, setCurrentMatra] = useState<TaalMatra | null>(null);
  const [progressMs, setProgressMs] = useState<number>(0);
  const [totalMs, setTotalMs] = useState<number>(0);
  const [currentPlayingNoteId, setCurrentPlayingNoteId] = useState<
    string | null
  >(null);

  const recorderRef = useRef(new MelodyRecorder());
  const playerRef = useRef(new CompositionPlayer());
  const hapticsEnabledRef = useRef<boolean>(prefs.hapticsEnabled);

  useEffect(() => {
    hapticsEnabledRef.current = prefs.hapticsEnabled;
  }, [prefs.hapticsEnabled]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", prefs.theme);
    savePreferences(prefs);
    audioEngine.updateSettings({
      volume: prefs.volume,
      muted: prefs.muted,
      reedMode: prefs.reedMode,
      bellows: prefs.bellows,
      reverbMix: prefs.reverbMix,
      droneEnabled: prefs.droneEnabled,
      tonic: prefs.tonic,
    });
  }, [prefs]);

  useEffect(() => {
    void compositionRepository.listAll().then(setSavedCompositions);
  }, []);

  useEffect(() => {
    audioEngine.setTaalBpm(activeComposition.bpm);
  }, [activeComposition.bpm]);

  const handleNoteOn = useCallback((midi: number) => {
    if (!audioEngine.isReady()) {
      void audioEngine.unlockAndInit().then(() => setAudioUnlocked(true));
    } else {
      setAudioUnlocked(true);
    }
    audioEngine.noteOn(midi);
    recorderRef.current.recordNoteOn(midi, performance.now());
    setLastPlayedMidi(midi);
    setActiveMidis((prev) => {
      const next = new Set(prev);
      next.add(midi);
      return next;
    });
  }, []);

  const handleNoteOff = useCallback((midi: number) => {
    audioEngine.noteOff(midi);
    recorderRef.current.recordNoteOff(midi, performance.now());
    setActiveMidis((prev) => {
      if (!prev.has(midi)) return prev;
      const next = new Set(prev);
      next.delete(midi);
      return next;
    });
  }, []);

  const inputControllerRef = useRef<UnifiedInputController | null>(null);
  if (!inputControllerRef.current) {
    inputControllerRef.current = new UnifiedInputController({
      onNoteOn: (midi, source) => {
        if (source === "pointer-tap") {
          triggerKeyHaptic(hapticsEnabledRef.current, "tap");
        } else if (source === "pointer-slide") {
          triggerKeyHaptic(hapticsEnabledRef.current, "slide");
        }
        handleNoteOn(midi);
      },
      onNoteOff: (midi) => handleNoteOff(midi),
      onOctaveDelta: (delta) =>
        setPrefs((p) => ({
          ...p,
          octaveShift: Math.max(-1, Math.min(1, p.octaveShift + delta)),
        })),
      onReleaseAll: () => {
        audioEngine.releaseAllNotes();
        setActiveMidis(new Set());
      },
    });
  }

  useEffect(() => {
    inputControllerRef.current?.setOctaveShift(prefs.octaveShift);
  }, [prefs.octaveShift]);

  useEffect(() => {
    const controller = inputControllerRef.current!;
    const onVisibility = () => {
      if (document.hidden) controller.panicReleaseAll();
    };
    window.addEventListener("keydown", controller.handleKeyDown);
    window.addEventListener("keyup", controller.handleKeyUp);
    window.addEventListener("blur", controller.panicReleaseAll);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("keydown", controller.handleKeyDown);
      window.removeEventListener("keyup", controller.handleKeyUp);
      window.removeEventListener("blur", controller.panicReleaseAll);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const updatePreferences = (partial: Partial<UserPreferences>) => {
    setPrefs((prev) => ({ ...prev, ...partial }));
  };

  const handlePlayComposition = (
    compToPlay = activeComposition,
    bpmOverride?: number,
  ) => {
    audioEngine.stopTaalLoop();
    void audioEngine.unlockAndInit().then(() => {
      setAudioUnlocked(true);
      setIsPlaying(true);
      setIsPaused(false);
      playerRef.current.start(
        compToPlay,
        {
          loop: loopEnabled,
          metronome: metronomeEnabled || selectedTaal !== "none",
          playbackBpm: bpmOverride ?? compToPlay.bpm,
        },
        {
          onNoteStart: (n) => {
            setCurrentPlayingNoteId(n.id);
            handleNoteOn(n.midi);
          },
          onNoteEnd: (n) => {
            handleNoteOff(n.midi);
          },
          onBeat: (beatIdx) => {
            if (selectedTaal !== "none") {
              const step = getTaalMatra(selectedTaal, beatIdx);
              audioEngine.playTablaBol(step.bol, step.marker);
              setCurrentMatra(step);
            } else if (metronomeEnabled) {
              audioEngine.playMetronomeClick(beatIdx % 4 === 0);
            }
          },
          onProgress: (elapsed, total) => {
            setProgressMs(elapsed);
            setTotalMs(total);
          },
          onComplete: () => {
            setIsPlaying(false);
            setIsPaused(false);
            setCurrentPlayingNoteId(null);
          },
        },
      );
    });
  };

  const handlePlayExerciseReference = (
    exercise: PracticeExercise,
    slow: boolean,
  ) => {
    const bpm = slow
      ? Math.round(exercise.defaultBpm * 0.6)
      : exercise.defaultBpm;
    const beatMs = 60000 / bpm;
    let cursorMs = 0;
    const notes = exercise.steps.map((step, i) => {
      const midi = relativeOffsetToMidi(step.offset, prefs.tonic, 4);
      const durationMs = Math.round(step.durationBeats * beatMs * 0.88);
      const ev = {
        id: `ex-${i}`,
        midi,
        relativeOffset: step.offset,
        startTimeMs: cursorMs,
        durationMs,
        velocity: 0.95,
      };
      cursorMs += Math.round(step.durationBeats * beatMs);
      return ev;
    });
    handlePlayComposition(
      {
        schemaVersion: 1,
        id: `ref-${exercise.id}`,
        title: exercise.title,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tonic: prefs.tonic,
        bpm,
        notes,
      },
      bpm,
    );
  };

  const currentSwara =
    lastPlayedMidi !== null
      ? midiToSwara(lastPlayedMidi, prefs.tonic, 4)
      : null;

  return (
    <div className="app-shell">
      <header className="top-header">
        <div className="brand-group">
          <div className="brand-logo" aria-hidden="true">
            सा
          </div>
          <div>
            <h1 className="brand-title">SurTaal</h1>
            <p className="brand-tagline">
              Pocket Harmonium • Sa: {HARMONIUM_TONIC_LABELS[prefs.tonic]}
            </p>
          </div>
        </div>

        {/* Desktop Mode Switcher (hidden on mobile in favor of fixed Bottom Nav) */}
        <nav
          className="mode-tabs desktop-only-nav"
          aria-label="Application Modes"
        >
          <button
            type="button"
            className={`mode-tab ${mode === "play" ? "active" : ""}`}
            onClick={() => setMode("play")}
          >
            Play
          </button>
          <button
            type="button"
            className={`mode-tab ${mode === "learn" ? "active" : ""}`}
            onClick={() => setMode("learn")}
          >
            Learn Sargam
          </button>
          <button
            type="button"
            className={`mode-tab ${mode === "studio" ? "active" : ""}`}
            onClick={() => setMode("studio")}
          >
            Song Studio
          </button>
        </nav>

        <div className="header-actions">
          <button
            type="button"
            className={`btn-secondary mobile-tune-toggle ${mobileControlsOpen ? "active" : ""}`}
            aria-expanded={mobileControlsOpen}
            onClick={() => setMobileControlsOpen((o) => !o)}
          >
            {mobileControlsOpen ? "Hide Controls ▲" : "Tune & Sound ⚙️"}
          </button>

          <select
            aria-label="Select Visual Theme"
            className="control-input theme-select-compact"
            value={prefs.theme}
            onChange={(e) =>
              updatePreferences({ theme: e.target.value as ThemeId })
            }
          >
            <option value="classic-ivory">Classic Ivory</option>
            <option value="peacock">Peacock</option>
            <option value="midnight-riyaaz">Midnight Riyaaz</option>
            <option value="sunset-mehfil">Sunset Mehfil</option>
          </select>

          <button
            type="button"
            className="btn-secondary desktop-only-btn"
            onClick={() => setShowKeyMap((s) => !s)}
          >
            PC Keys
          </button>

          <button
            type="button"
            className="btn-primary"
            onClick={() => handlePlayComposition(STARTER_DEMO_COMPOSITION)}
          >
            Demo
          </button>
        </div>
      </header>

      <KeyMapModal open={showKeyMap} onClose={() => setShowKeyMap(false)} />

      {/* Collapsible on mobile so the harmonium keyboard stays front-and-center */}
      <div className={`controls-drawer ${mobileControlsOpen ? "open" : ""}`}>
        <InstrumentControls prefs={prefs} onChange={updatePreferences} />
      </div>

      <main className="harmonium-cabinet">
        <div className="cabinet-status-strip">
          <div className="live-swara-pill" aria-live="polite">
            {currentSwara && lastPlayedMidi !== null ? (
              <>
                <span>
                  Swara: {currentSwara.displayWithOctave} (
                  {currentSwara.devanagari})
                </span>
                <span>•</span>
                <span>Note: {midiToWesternName(lastPlayedMidi)}</span>
              </>
            ) : (
              <span>
                Tap keys or press Z–M / A–L on PC keyboard (Hold Alt for
                Coupler)
              </span>
            )}
          </div>

          <div className="engine-status-pill">
            {prefs.droneEnabled && <span>Drone: ON • </span>}
            <span>
              {audioUnlocked ? "Multi-Reed Active" : "Tap any key for sound"}
            </span>
          </div>
        </div>

        <HarmoniumKeyboard
          tonic={prefs.tonic}
          octaveShift={prefs.octaveShift}
          activeMidis={activeMidis}
          expectedMidi={mode === "learn" ? expectedLearnMidi : null}
          showSwaraLabels={prefs.showSwaraLabels}
          showWesternLabels={prefs.showWesternLabels}
          onPointerDownKey={(pid, midi) =>
            inputControllerRef.current?.handlePointerDown(pid, midi)
          }
          onPointerEnterKey={(pid, midi) =>
            inputControllerRef.current?.handlePointerMoveToMidi(pid, midi)
          }
          onPointerUpKey={(pid) =>
            inputControllerRef.current?.handlePointerUp(pid)
          }
        />
      </main>

      {mode === "learn" && (
        <LearnMode
          tonic={prefs.tonic}
          onHighlightTargetMidi={setExpectedLearnMidi}
          onPlayReferenceExercise={handlePlayExerciseReference}
          lastPlayedMidi={lastPlayedMidi}
        />
      )}

      {mode === "studio" && (
        <SongStudio
          activeComposition={activeComposition}
          savedList={savedCompositions}
          isRecording={isRecording}
          isPlaying={isPlaying}
          isPaused={isPaused}
          loopEnabled={loopEnabled}
          metronomeEnabled={metronomeEnabled}
          selectedTaal={selectedTaal}
          currentMatra={currentMatra}
          onChangeTaal={(nextTaal) => {
            setSelectedTaal(nextTaal);
            if (nextTaal === "none") {
              audioEngine.stopTaalLoop();
              setCurrentMatra(null);
            } else if (!isPlaying) {
              void audioEngine.startTaalLoop(
                nextTaal,
                activeComposition.bpm,
                setCurrentMatra,
              );
            }
          }}
          progressMs={progressMs}
          totalMs={totalMs}
          currentPlayingNoteId={currentPlayingNoteId}
          tonic={prefs.tonic}
          onStartRecording={() => {
            playerRef.current.stop({
              onNoteStart: () => {},
              onNoteEnd: (n) => handleNoteOff(n.midi),
              onProgress: () => {},
              onComplete: () => {},
            });
            setIsPlaying(false);
            recorderRef.current.start(performance.now(), prefs.tonic);
            setIsRecording(true);
          }}
          onStopRecording={() => {
            const notes = recorderRef.current.stop(performance.now());
            setIsRecording(false);
            setActiveComposition((prev) => ({
              ...prev,
              id: `comp-${Date.now()}`,
              tonic: prefs.tonic,
              updatedAt: new Date().toISOString(),
              notes,
            }));
          }}
          onPlay={() => handlePlayComposition(activeComposition)}
          onPauseResume={() => {
            if (isPaused) {
              playerRef.current.resume();
              setIsPaused(false);
            } else {
              playerRef.current.pause({
                onNoteStart: () => {},
                onNoteEnd: (n) => handleNoteOff(n.midi),
                onProgress: () => {},
                onComplete: () => {},
              });
              setIsPaused(true);
            }
          }}
          onStopPlayback={() => {
            playerRef.current.stop({
              onNoteStart: () => {},
              onNoteEnd: (n) => handleNoteOff(n.midi),
              onProgress: () => {},
              onComplete: () => {},
            });
            setIsPlaying(false);
            setIsPaused(false);
            setCurrentPlayingNoteId(null);
          }}
          onToggleLoop={() => setLoopEnabled((l) => !l)}
          onToggleMetronome={() => setMetronomeEnabled((m) => !m)}
          onUpdateComposition={(updated, pushUndo = true) => {
            if (pushUndo) {
              setUndoStack((prev) => [...prev.slice(-9), activeComposition]);
            }
            setActiveComposition(updated);
          }}
          onUndo={() => {
            setUndoStack((prev) => {
              if (prev.length === 0) return prev;
              const previous = prev[prev.length - 1];
              setActiveComposition(previous);
              return prev.slice(0, -1);
            });
          }}
          canUndo={undoStack.length > 0}
          onSaveToLibrary={() => {
            void compositionRepository
              .save(activeComposition)
              .then(() =>
                compositionRepository.listAll().then(setSavedCompositions),
              );
          }}
          onSelectFromLibrary={(comp) => {
            setActiveComposition(comp);
          }}
          onDuplicateInLibrary={(comp) => {
            const copy: Composition = {
              ...comp,
              id: `comp-${Date.now()}`,
              title: `${comp.title} (Copy)`,
              updatedAt: new Date().toISOString(),
            };
            void compositionRepository
              .save(copy)
              .then(() =>
                compositionRepository.listAll().then(setSavedCompositions),
              );
          }}
          onDeleteFromLibrary={(id) => {
            void compositionRepository
              .remove(id)
              .then(() =>
                compositionRepository.listAll().then(setSavedCompositions),
              );
          }}
        />
      )}

      {/* Thumb-Friendly Mobile Bottom Navigation Bar */}
      <nav className="mobile-bottom-nav" aria-label="Mobile Navigation">
        <button
          type="button"
          className={`mobile-nav-item ${mode === "play" ? "active" : ""}`}
          onClick={() => setMode("play")}
        >
          <span>🎹</span>
          <span>Play</span>
        </button>
        <button
          type="button"
          className={`mobile-nav-item ${mode === "learn" ? "active" : ""}`}
          onClick={() => setMode("learn")}
        >
          <span>📖</span>
          <span>Learn Sargam</span>
        </button>
        <button
          type="button"
          className={`mobile-nav-item ${mode === "studio" ? "active" : ""}`}
          onClick={() => setMode("studio")}
        >
          <span>⏺</span>
          <span>Song Studio</span>
        </button>
      </nav>
    </div>
  );
};
