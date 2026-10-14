import React, { useState } from "react";
import { PRACTICE_EXERCISES } from "./practiceData";
import type { PracticeExercise } from "./practiceData";
import { PitchClass } from "../harmonium/music/pitch";
import { midiToSwara, relativeOffsetToMidi } from "../harmonium/music/swara";

interface LearnModeProps {
  tonic: PitchClass;
  onHighlightTargetMidi: (midi: number | null) => void;
  onPlayReferenceExercise: (exercise: PracticeExercise, slow: boolean) => void;
  lastPlayedMidi: number | null;
}

export const LearnMode: React.FC<LearnModeProps> = ({
  tonic,
  onHighlightTargetMidi,
  onPlayReferenceExercise,
  lastPlayedMidi,
}) => {
  const [selectedId, setSelectedId] = useState<string>(
    PRACTICE_EXERCISES[0].id,
  );
  const [stepIndex, setStepIndex] = useState<number>(0);
  const [slowMode, setSlowMode] = useState<boolean>(false);

  const exercise =
    PRACTICE_EXERCISES.find((e) => e.id === selectedId) ??
    PRACTICE_EXERCISES[0];
  const currentStep = exercise.steps[stepIndex];
  const expectedMidi = currentStep
    ? relativeOffsetToMidi(currentStep.offset, tonic, 4)
    : null;

  React.useEffect(() => {
    onHighlightTargetMidi(expectedMidi);
    return () => onHighlightTargetMidi(null);
  }, [expectedMidi, onHighlightTargetMidi]);

  React.useEffect(() => {
    if (
      lastPlayedMidi !== null &&
      expectedMidi !== null &&
      lastPlayedMidi === expectedMidi
    ) {
      setStepIndex((prev) =>
        prev + 1 <= exercise.steps.length ? prev + 1 : prev,
      );
    }
  }, [lastPlayedMidi, expectedMidi, exercise.steps.length]);

  const isCompleted = stepIndex >= exercise.steps.length;

  return (
    <section className="panel-card" aria-label="Beginner Sargam Practice Mode">
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          gap: "0.75rem",
        }}
      >
        <div>
          <h2 style={{ margin: "0 0 0.25rem 0", fontSize: "1.15rem" }}>
            Ready for a little riyaaz?
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: "0.86rem",
              color: "var(--text-secondary)",
            }}
          >
            Sa is your starting note. Choose an exercise below, listen to the
            reference tune, then play the glowing key on the harmonium above.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <select
            aria-label="Choose Practice Exercise"
            className="control-input"
            value={selectedId}
            onChange={(e) => {
              setSelectedId(e.target.value);
              setStepIndex(0);
            }}
          >
            {PRACTICE_EXERCISES.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.title} ({ex.difficulty})
              </option>
            ))}
          </select>

          <button
            type="button"
            className="btn-secondary"
            onClick={() => setSlowMode((s) => !s)}
          >
            {slowMode ? "Speed: Slow (60%)" : "Speed: Normal"}
          </button>

          <button
            type="button"
            className="btn-primary"
            onClick={() => onPlayReferenceExercise(exercise, slowMode)}
          >
            Listen to Reference
          </button>

          <button
            type="button"
            className="btn-secondary"
            onClick={() => setStepIndex(0)}
          >
            Restart Exercise
          </button>
        </div>
      </div>

      <p style={{ fontSize: "0.9rem", marginTop: "0.75rem" }}>
        {exercise.description}
      </p>

      <div
        style={{
          display: "flex",
          gap: "0.45rem",
          flexWrap: "wrap",
          marginTop: "0.75rem",
        }}
      >
        {exercise.steps.map((step, idx) => {
          const stepMidi = relativeOffsetToMidi(step.offset, tonic, 4);
          const swara = midiToSwara(stepMidi, tonic, 4);
          const isCurrent = idx === stepIndex;
          const isDone = idx < stepIndex;
          return (
            <span
              key={`${idx}-${step.offset}`}
              style={{
                padding: "0.35rem 0.65rem",
                borderRadius: "8px",
                fontWeight: 700,
                background: isCurrent
                  ? "var(--accent-primary)"
                  : isDone
                    ? "var(--bg-elevated)"
                    : "transparent",
                color: isCurrent ? "#fff" : "var(--text-primary)",
                border: "1px solid var(--border-subtle)",
                opacity: isDone ? 0.6 : 1,
              }}
            >
              {swara.displayWithOctave}
            </span>
          );
        })}
      </div>

      <div
        style={{ marginTop: "0.85rem", fontSize: "0.9rem", fontWeight: 600 }}
      >
        {isCompleted ? (
          <span>
            Shabaash! You completed {exercise.title}. Click Restart to play
            again.
          </span>
        ) : (
          <span>
            Next Expected Swara: <strong>{currentStep?.lyricHint}</strong>{" "}
            (Progress: {stepIndex} / {exercise.steps.length})
          </span>
        )}
      </div>
    </section>
  );
};
