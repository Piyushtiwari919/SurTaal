import React, { useState } from "react";
import { Composition } from "./compositionTypes";
import {
  reorderNoteInComposition,
  transposeComposition,
  updateNoteInComposition,
} from "./recording";
import { validateCompositionPayload } from "./compositionValidation";
import { clampMidi } from "../harmonium/music/tuning";
import { midiToWesternName, PitchClass } from "../harmonium/music/pitch";
import { TaalId, TaalMatra } from "../harmonium/music/taal";
import { midiToSwara } from "../harmonium/music/swara";

interface SongStudioProps {
  activeComposition: Composition;
  savedList: Composition[];
  isRecording: boolean;
  isPlaying: boolean;
  isPaused: boolean;
  loopEnabled: boolean;
  metronomeEnabled: boolean;
  progressMs: number;
  totalMs: number;
  currentPlayingNoteId: string | null;
  selectedTaal: TaalId;
  currentMatra: TaalMatra | null;
  onChangeTaal: (taal: TaalId) => void;
  tonic: PitchClass;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onPlay: () => void;
  onPauseResume: () => void;
  onStopPlayback: () => void;
  onToggleLoop: () => void;
  onToggleMetronome: () => void;
  onUpdateComposition: (updated: Composition, pushUndo?: boolean) => void;
  onUndo: () => void;
  canUndo: boolean;
  onSaveToLibrary: () => void;
  onSelectFromLibrary: (comp: Composition) => void;
  onDuplicateInLibrary: (comp: Composition) => void;
  onDeleteFromLibrary: (id: string) => void;
}

export const SongStudio: React.FC<SongStudioProps> = ({
  activeComposition,
  savedList,
  isRecording,
  isPlaying,
  isPaused,
  loopEnabled,
  metronomeEnabled,
  progressMs,
  selectedTaal,
  totalMs,
  currentPlayingNoteId,
  tonic,
  onStartRecording,
  onStopRecording,
  onPlay,
  onPauseResume,
  onStopPlayback,
  onToggleLoop,
  onToggleMetronome,
  onUpdateComposition,
  onUndo,
  canUndo,
  onChangeTaal,
  currentMatra,
  onSaveToLibrary,
  onSelectFromLibrary,
  onDuplicateInLibrary,
  onDeleteFromLibrary,
}) => {
  const [importError, setImportError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleExportJson = () => {
    const json = JSON.stringify(activeComposition, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeComposition.title.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "surtaal-song"}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusMessage("Exported composition JSON file.");
  };

  const handleImportJson = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setImportError(null);
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed: unknown = JSON.parse(text);
      const validation = validateCompositionPayload(parsed);
      if (!validation.valid || !validation.composition) {
        setImportError(validation.error ?? "Invalid composition file.");
        return;
      }
      onUpdateComposition(validation.composition, true);
      setStatusMessage(
        `Imported "${validation.composition.title}" successfully.`,
      );
    } catch {
      setImportError(
        "Could not parse JSON file. Please verify the file format.",
      );
    } finally {
      event.target.value = "";
    }
  };

  return (
    <section
      className="panel-card"
      aria-label="Song Studio Recorder and Editor"
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          gap: "0.75rem",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <label
            htmlFor="song-title-input"
            style={{ fontWeight: 600, fontSize: "0.85rem" }}
          >
            Song Name:
          </label>
          <input
            id="song-title-input"
            type="text"
            className="control-input"
            value={activeComposition.title}
            onChange={(e) =>
              onUpdateComposition(
                { ...activeComposition, title: e.target.value },
                false,
              )
            }
          />
          <label
            htmlFor="song-bpm-input"
            style={{ fontWeight: 600, fontSize: "0.85rem" }}
          >
            Tempo (BPM):
          </label>
          <input
            id="song-bpm-input"
            type="number"
            min={30}
            max={240}
            className="control-input"
            style={{ width: "80px" }}
            value={activeComposition.bpm}
            onChange={(e) =>
              onUpdateComposition(
                {
                  ...activeComposition,
                  bpm: Math.max(
                    30,
                    Math.min(240, Number(e.target.value) || 90),
                  ),
                },
                false,
              )
            }
          />
        </div>

        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
          {!isRecording ? (
            <button
              type="button"
              className="btn-primary"
              onClick={onStartRecording}
            >
              ● Record Melody
            </button>
          ) : (
            <button
              type="button"
              className="btn-primary"
              onClick={onStopRecording}
            >
              ■ Stop Recording
            </button>
          )}

          <button
            type="button"
            className="btn-secondary"
            disabled={isRecording || activeComposition.notes.length === 0}
            onClick={onPlay}
          >
            ▶ Play
          </button>

          {isPlaying && (
            <button
              type="button"
              className="btn-secondary"
              onClick={onPauseResume}
            >
              {isPaused ? "Resume" : "Pause"}
            </button>
          )}

          <button
            type="button"
            className="btn-secondary"
            disabled={!isPlaying}
            onClick={onStopPlayback}
          >
            Stop
          </button>

          <button
            type="button"
            className="btn-secondary"
            onClick={onToggleLoop}
          >
            {loopEnabled ? "Loop: ON" : "Loop: OFF"}
          </button>

          <button
            type="button"
            className="btn-secondary"
            onClick={onToggleMetronome}
          >
            {metronomeEnabled ? "Metronome: ON" : "Metronome: OFF"}
          </button>
          <select
            aria-label="Select Tabla Taal Loop"
            className="control-input"
            value={selectedTaal}
            onChange={(e) => onChangeTaal(e.target.value as TaalId)}
          >
            <option value="none">Tabla Taal: OFF</option>
            <option value="keherwa">Tabla: Keherwa (8 Beats)</option>
            <option value="teentaal">Tabla: Teen Taal (16 Beats)</option>
          </select>

          {currentMatra && (
            <span
              aria-live="polite"
              style={{
                padding: "0.4rem 0.7rem",
                borderRadius: "8px",
                fontWeight: 700,
                fontSize: "0.84rem",
                background:
                  currentMatra.marker === "sam"
                    ? "var(--accent-primary)"
                    : "var(--bg-elevated)",
                color:
                  currentMatra.marker === "sam"
                    ? "#fff"
                    : "var(--text-primary)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              Matra {currentMatra.matra}: {currentMatra.bol}{" "}
              {currentMatra.marker === "sam"
                ? "(Sam X)"
                : currentMatra.marker === "khali"
                  ? "(Khali 0)"
                  : currentMatra.marker === "tali"
                    ? "(Tali +)"
                    : ""}
            </span>
          )}
        </div>
      </div>

      <div
        style={{
          margin: "0.65rem 0",
          fontSize: "0.82rem",
          color: "var(--text-secondary)",
        }}
      >
        Playback Progress: {(progressMs / 1000).toFixed(1)}s /{" "}
        {(totalMs / 1000).toFixed(1)}s — Notes: {activeComposition.notes.length}
      </div>

      {/* Melody-wide editing actions */}
      <div
        style={{
          display: "flex",
          gap: "0.45rem",
          flexWrap: "wrap",
          marginBottom: "0.85rem",
        }}
      >
        <button
          type="button"
          className="btn-secondary"
          onClick={() =>
            onUpdateComposition(
              transposeComposition(activeComposition, -1),
              true,
            )
          }
        >
          Transpose All -1 Semitone
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() =>
            onUpdateComposition(
              transposeComposition(activeComposition, 1),
              true,
            )
          }
        >
          Transpose All +1 Semitone
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={!canUndo}
          onClick={onUndo}
        >
          Undo Edit
        </button>
        <button type="button" className="btn-primary" onClick={onSaveToLibrary}>
          Save to Song Library
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={handleExportJson}
        >
          Export JSON
        </button>
        <label className="btn-secondary" style={{ display: "inline-block" }}>
          Import JSON
          <input
            type="file"
            accept="application/json,.json"
            style={{ display: "none" }}
            onChange={handleImportJson}
          />
        </label>
      </div>

      {importError && (
        <div
          role="alert"
          style={{ color: "#dc2626", fontWeight: 600, marginBottom: "0.65rem" }}
        >
          {importError}
        </div>
      )}
      {statusMessage && (
        <div
          style={{
            color: "var(--accent-primary)",
            fontWeight: 600,
            marginBottom: "0.65rem",
          }}
        >
          {statusMessage}
        </div>
      )}

      {/* Note Sequence Editor Table */}
      <div
        style={{ maxHeight: "240px", overflowY: "auto", marginBottom: "1rem" }}
      >
        {activeComposition.notes.length === 0 ? (
          <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)" }}>
            No notes recorded yet. Click <strong>Record Melody</strong> and play
            keys on the harmonium above!
          </p>
        ) : (
          <table className="note-table" aria-label="Recorded Notes Editor">
            <thead>
              <tr>
                <th>#</th>
                <th>Swara</th>
                <th>Western Pitch</th>
                <th>Start (ms)</th>
                <th>Duration (ms)</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {activeComposition.notes.map((note, idx) => {
                const swara = midiToSwara(note.midi, tonic, 4);
                const isCurrent = currentPlayingNoteId === note.id;
                return (
                  <tr
                    key={note.id}
                    style={{
                      background: isCurrent
                        ? "var(--bg-elevated)"
                        : "transparent",
                      fontWeight: isCurrent ? 700 : 400,
                    }}
                  >
                    <td>{idx + 1}</td>
                    <td>{swara.displayWithOctave}</td>
                    <td>{midiToWesternName(note.midi)}</td>
                    <td>{note.startTimeMs}</td>
                    <td>
                      <input
                        type="number"
                        aria-label={`Duration for note ${idx + 1}`}
                        className="control-input"
                        style={{ width: "82px", padding: "0.2rem 0.4rem" }}
                        min={50}
                        max={10000}
                        step={50}
                        value={note.durationMs}
                        onChange={(e) =>
                          onUpdateComposition(
                            updateNoteInComposition(
                              activeComposition,
                              note.id,
                              (n) => ({
                                ...n,
                                durationMs: Math.max(
                                  50,
                                  Number(e.target.value) || 200,
                                ),
                              }),
                            ),
                            true,
                          )
                        }
                      />
                    </td>
                    <td
                      style={{
                        display: "flex",
                        gap: "0.25rem",
                        flexWrap: "wrap",
                      }}
                    >
                      <button
                        type="button"
                        className="btn-secondary"
                        aria-label={`Lower pitch of note ${idx + 1}`}
                        onClick={() =>
                          onUpdateComposition(
                            updateNoteInComposition(
                              activeComposition,
                              note.id,
                              (n) => {
                                const nextMidi = clampMidi(n.midi - 1);
                                return {
                                  ...n,
                                  midi: nextMidi,
                                  relativeOffset: nextMidi - (60 + tonic),
                                };
                              },
                            ),
                            true,
                          )
                        }
                      >
                        -1
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        aria-label={`Raise pitch of note ${idx + 1}`}
                        onClick={() =>
                          onUpdateComposition(
                            updateNoteInComposition(
                              activeComposition,
                              note.id,
                              (n) => {
                                const nextMidi = clampMidi(n.midi + 1);
                                return {
                                  ...n,
                                  midi: nextMidi,
                                  relativeOffset: nextMidi - (60 + tonic),
                                };
                              },
                            ),
                            true,
                          )
                        }
                      >
                        +1
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        aria-label={`Move note ${idx + 1} earlier`}
                        disabled={idx === 0}
                        onClick={() =>
                          onUpdateComposition(
                            reorderNoteInComposition(
                              activeComposition,
                              idx,
                              -1,
                            ),
                            true,
                          )
                        }
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        aria-label={`Move note ${idx + 1} later`}
                        disabled={idx === activeComposition.notes.length - 1}
                        onClick={() =>
                          onUpdateComposition(
                            reorderNoteInComposition(activeComposition, idx, 1),
                            true,
                          )
                        }
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        aria-label={`Delete note ${idx + 1}`}
                        onClick={() =>
                          onUpdateComposition(
                            {
                              ...activeComposition,
                              notes: activeComposition.notes.filter(
                                (n) => n.id !== note.id,
                              ),
                            },
                            true,
                          )
                        }
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Saved Compositions Library */}
      <div>
        <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "0.95rem" }}>
          Local Song Library (Stored on this device)
        </h3>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {savedList.map((comp) => (
            <div
              key={comp.id}
              style={{
                border: "1px solid var(--border-subtle)",
                borderRadius: "8px",
                padding: "0.5rem 0.75rem",
                background:
                  comp.id === activeComposition.id
                    ? "var(--bg-elevated)"
                    : "var(--bg-surface)",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: "0.86rem" }}>
                  {comp.title}
                </div>
                <div
                  style={{
                    fontSize: "0.74rem",
                    color: "var(--text-secondary)",
                  }}
                >
                  {comp.notes.length} notes • {comp.bpm} BPM
                </div>
              </div>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => onSelectFromLibrary(comp)}
              >
                Open
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => onDuplicateInLibrary(comp)}
              >
                Duplicate
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => onDeleteFromLibrary(comp.id)}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
