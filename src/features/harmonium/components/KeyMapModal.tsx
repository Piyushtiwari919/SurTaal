import React from "react";

interface KeyMapModalProps {
  open: boolean;
  onClose: () => void;
}

export const KeyMapModal: React.FC<KeyMapModalProps> = ({ open, onClose }) => {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="keymap-dialog-title"
      className="panel-card"
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h2 id="keymap-dialog-title" style={{ margin: 0, fontSize: "1.02rem" }}>
          PC Keyboard Mapping (All 29 Keys + Alt Coupler)
        </h2>
        <button type="button" className="btn-secondary" onClick={onClose}>
          Close
        </button>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "0.65rem",
          marginTop: "0.6rem",
          fontSize: "0.84rem",
          color: "var(--text-secondary)",
        }}
      >
        <div>
          <strong>Madhya &amp; Taar Saptak (Middle/Upper):</strong>
          <div>
            White Keys: <code>A S D F G H J K L ;</code>
          </div>
          <div>
            Black Keys: <code>Q W E R T Y U</code>
          </div>
        </div>
        <div>
          <strong>Mandra Saptak (Lower Bass Octave):</strong>
          <div>
            White Keys: <code>Z X C V B N M</code>
          </div>
          <div>
            Black Keys: <code>1 2 3 4 5</code>
          </div>
        </div>
        <div>
          <strong>Alt Key &amp; Octave Shifts:</strong>
          <div>
            Hold <code>Alt</code> + <code>A..L</code>: Instant Lower Octave
            Coupler
          </div>
          <div>
            Shift Register: <code>[</code> / <code>]</code> or{" "}
            <code>Alt + Left/Right</code>
          </div>
        </div>
      </div>
    </div>
  );
};
