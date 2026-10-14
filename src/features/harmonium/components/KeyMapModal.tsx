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
        <h2 id="keymap-dialog-title" style={{ margin: 0, fontSize: "1.05rem" }}>
          Laptop Keyboard Guide
        </h2>
        <button type="button" className="btn-secondary" onClick={onClose}>
          Close
        </button>
      </div>
      <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)" }}>
        Your middle row (<strong>A S D F G H J K L ; &apos;</strong>) plays the
        white keys, while the top row (<strong>W E T Y U O P</strong>) plays the
        black keys. Press <strong>Z</strong> or <strong>X</strong> to shift
        octaves down or up.
      </p>
    </div>
  );
};
