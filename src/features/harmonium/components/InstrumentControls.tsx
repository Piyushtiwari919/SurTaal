import React from "react";
import { HARMONIUM_TONIC_LABELS, PitchClass } from "../music/pitch";
import { ReedMode } from "../music/tuning";
import { UserPreferences } from "../../../storage/settingsRepository";
import { isHapticsSupported, triggerKeyHaptic } from "../keyboard/haptics";

interface InstrumentControlsProps {
  prefs: UserPreferences;
  onChange: (partial: Partial<UserPreferences>) => void;
}

export const InstrumentControls: React.FC<InstrumentControlsProps> = ({
  prefs,
  onChange,
}) => {
  return (
    <section
      className="controls-bar"
      aria-label="Harmonium Sound and Tuning Controls"
    >
      <div className="control-group">
        <label className="control-label" htmlFor="tonic-select">
          <span>Sa (Tonic Pitch)</span>
          <span>Find your Sa</span>
        </label>
        <select
          id="tonic-select"
          className="control-input"
          value={prefs.tonic}
          onChange={(e) =>
            onChange({ tonic: Number(e.target.value) as PitchClass })
          }
        >
          {Object.entries(HARMONIUM_TONIC_LABELS).map(([pc, label]) => (
            <option key={pc} value={pc}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="control-group">
        <label className="control-label" htmlFor="octave-select">
          <span>Octave Register (Z / X)</span>
          <span>
            {prefs.octaveShift === 0
              ? "Madhya"
              : prefs.octaveShift < 0
                ? "Mandra (-1)"
                : "Taar (+1)"}
          </span>
        </label>
        <div style={{ display: "flex", gap: "0.35rem" }}>
          <button
            type="button"
            className="btn-secondary"
            aria-label="Shift Octave Down"
            disabled={prefs.octaveShift <= -1}
            onClick={() =>
              onChange({ octaveShift: Math.max(-1, prefs.octaveShift - 1) })
            }
          >
            -1 Oct
          </button>
          <button
            type="button"
            className="btn-secondary"
            aria-label="Reset Octave to Middle"
            onClick={() => onChange({ octaveShift: 0 })}
          >
            Middle
          </button>
          <button
            type="button"
            className="btn-secondary"
            aria-label="Shift Octave Up"
            disabled={prefs.octaveShift >= 1}
            onClick={() =>
              onChange({ octaveShift: Math.min(1, prefs.octaveShift + 1) })
            }
          >
            +1 Oct
          </button>
        </div>
      </div>

      <div className="control-group">
        <label className="control-label" htmlFor="reed-select">
          <span>Reed Voicing</span>
        </label>
        <select
          id="reed-select"
          className="control-input"
          value={prefs.reedMode}
          onChange={(e) => onChange({ reedMode: e.target.value as ReedMode })}
        >
          <option value="single">Single Reed (Khula)</option>
          <option value="double">Double Reed (Nar + Mada)</option>
          <option value="triple">Triple Reed (Full Organ)</option>
        </select>
      </div>

      <div className="control-group">
        <label className="control-label" htmlFor="bellows-slider">
          <span>Bellows Air Pressure</span>
          <span>{Math.round(prefs.bellows * 100)}%</span>
        </label>
        <input
          id="bellows-slider"
          type="range"
          min="0.3"
          max="1"
          step="0.05"
          value={prefs.bellows}
          onChange={(e) => onChange({ bellows: Number(e.target.value) })}
        />
      </div>

      <div className="control-group">
        <label className="control-label" htmlFor="volume-slider">
          <span>Master Volume</span>
          <span>
            {prefs.muted ? "Muted" : `${Math.round(prefs.volume * 100)}%`}
          </span>
        </label>
        <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
          <input
            id="volume-slider"
            type="range"
            min="0"
            max="1"
            step="0.02"
            value={prefs.volume}
            onChange={(e) =>
              onChange({ volume: Number(e.target.value), muted: false })
            }
            style={{ flex: 1 }}
          />
          <button
            type="button"
            className="btn-secondary"
            aria-label={prefs.muted ? "Unmute Audio" : "Mute Audio"}
            onClick={() => onChange({ muted: !prefs.muted })}
          >
            {prefs.muted ? "Unmute" : "Mute"}
          </button>
        </div>
      </div>

      <div className="control-group">
        <span className="control-label">Accompaniment & Labels</span>
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
          <button
            type="button"
            className={prefs.droneEnabled ? "btn-primary" : "btn-secondary"}
            onClick={() => onChange({ droneEnabled: !prefs.droneEnabled })}
          >
            {prefs.droneEnabled ? "Shruti Drone: ON" : "Shruti Drone: OFF"}
          </button>
          <button
            type="button"
            className={prefs.hapticsEnabled ? "btn-primary" : "btn-secondary"}
            aria-pressed={prefs.hapticsEnabled}
            title={
              isHapticsSupported()
                ? "Toggle tactile vibration on key taps"
                : "Vibration API is only supported on Android browsers"
            }
            onClick={() => {
              const next = !prefs.hapticsEnabled;
              onChange({ hapticsEnabled: next });
              if (next) {
                triggerKeyHaptic(true, "tap");
              }
            }}
          >
            {prefs.hapticsEnabled ? "Haptics: ON" : "Haptics: OFF"}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() =>
              onChange({ showSwaraLabels: !prefs.showSwaraLabels })
            }
          >
            {prefs.showSwaraLabels ? "Hide Sargam" : "Show Sargam"}
          </button>
        </div>
      </div>
    </section>
  );
};
