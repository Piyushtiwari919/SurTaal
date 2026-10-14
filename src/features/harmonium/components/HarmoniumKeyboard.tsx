import React, { useEffect, useMemo, useRef, useState } from "react";
import { PitchClass } from "../music/pitch";
import { buildKeyboardKeys, KeyDescriptor } from "../keyboard/KeyboardLayout";

interface HarmoniumKeyboardProps {
  tonic: PitchClass;
  octaveShift: number;
  activeMidis: Set<number>;
  expectedMidi?: number | null;
  showSwaraLabels: boolean;
  showWesternLabels: boolean;
  onPointerDownKey: (pointerId: number, midi: number) => void;
  onPointerEnterKey: (pointerId: number, midi: number) => void;
  onPointerUpKey: (pointerId: number) => void;
}

interface BlackKeyPlacement {
  key: KeyDescriptor;
  leftPercent: number;
  widthPercent: number;
}

function computeDeckLayout(deckKeys: KeyDescriptor[]): {
  whiteKeys: KeyDescriptor[];
  blackKeyPlacements: BlackKeyPlacement[];
} {
  const whiteKeys = deckKeys.filter((k) => !k.isBlack);
  const blackKeyPlacements: BlackKeyPlacement[] = [];
  const totalWhite = Math.max(1, whiteKeys.length);
  const blackWidthPercent = Math.min(8.5, (100 / totalWhite) * 0.64);

  let whiteIndex = -1;
  for (const k of deckKeys) {
    if (!k.isBlack) {
      whiteIndex++;
    } else {
      const centerPercent = ((whiteIndex + 1) / totalWhite) * 100;
      blackKeyPlacements.push({
        key: k,
        leftPercent: centerPercent - blackWidthPercent / 2,
        widthPercent: blackWidthPercent,
      });
    }
  }

  return { whiteKeys, blackKeyPlacements };
}

export const HarmoniumKeyboard: React.FC<HarmoniumKeyboardProps> = ({
  tonic,
  octaveShift,
  activeMidis,
  expectedMidi,
  showSwaraLabels,
  showWesternLabels,
  onPointerDownKey,
  onPointerEnterKey,
  onPointerUpKey,
}) => {
  const [isBelow830, setIsBelow830] = useState<boolean>(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(max-width: 830px)").matches
      : false,
  );
  const [mobileViewMode, setMobileViewMode] = useState<"stacked" | "scroll">(
    "stacked",
  );
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(max-width: 830px)");
    const handleChange = (e: MediaQueryListEvent) => setIsBelow830(e.matches);
    setIsBelow830(mq.matches);
    mq.addEventListener("change", handleChange);
    return () => mq.removeEventListener("change", handleChange);
  }, []);

  const allKeys = useMemo(
    () => buildKeyboardKeys(octaveShift, tonic, 29),
    [octaveShift, tonic],
  );

  // Split into Upper Deck (Madhya + Taar: 17 keys, C4..E5) and Lower Deck (Mandra: 12 keys, C3..B3)
  const lowerDeckKeys = useMemo(() => allKeys.slice(0, 12), [allKeys]);
  const upperDeckKeys = useMemo(() => allKeys.slice(12), [allKeys]);

  const scrollToSaptak = (position: "mandra" | "madhya" | "taar") => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    const targetLeft =
      position === "mandra"
        ? 0
        : position === "madhya"
          ? maxScroll * 0.48
          : maxScroll;
    el.scrollTo({ left: targetLeft, behavior: "smooth" });
  };

  const renderKeyboardDeck = (
    deckKeys: KeyDescriptor[],
    deckLabel?: string,
    isCompactDeck = false,
  ) => {
    const { whiteKeys, blackKeyPlacements } = computeDeckLayout(deckKeys);

    return (
      <div className="keyboard-deck-wrapper">
        {deckLabel && <div className="deck-saptak-caption">{deckLabel}</div>}
        <div
          className={`keyboard-bed ${isCompactDeck ? "keyboard-bed-stacked" : "keyboard-bed-single"}`}
          onPointerUp={(e) => onPointerUpKey(e.pointerId)}
          onPointerCancel={(e) => onPointerUpKey(e.pointerId)}
          onPointerLeave={(e) => onPointerUpKey(e.pointerId)}
        >
          {whiteKeys.map((k) => {
            const isActive = activeMidis.has(k.midi);
            const isTarget = expectedMidi === k.midi;
            return (
              <button
                key={k.midi}
                type="button"
                data-midi={k.midi}
                aria-label={`Play ${k.westernName} (${k.swara.full})`}
                aria-pressed={isActive}
                className={`white-key ${isActive ? "active" : ""} ${isTarget ? "target-hint" : ""}`}
                onPointerDown={(e) => {
                  e.currentTarget.releasePointerCapture(e.pointerId);
                  onPointerDownKey(e.pointerId, k.midi);
                }}
                onPointerEnter={(e) => {
                  if (e.buttons > 0) onPointerEnterKey(e.pointerId, k.midi);
                }}
              >
                {!isBelow830 && k.shortcutKey && (
                  <span className="key-shortcut-badge">{k.shortcutKey}</span>
                )}
                {showSwaraLabels && (
                  <span className="key-swara-label">
                    {k.swara.displayWithOctave}
                  </span>
                )}
                {showWesternLabels && (
                  <span className="key-western-label">{k.westernName}</span>
                )}
              </button>
            );
          })}

          {blackKeyPlacements.map(({ key: k, leftPercent, widthPercent }) => {
            const isActive = activeMidis.has(k.midi);
            const isTarget = expectedMidi === k.midi;
            return (
              <button
                key={k.midi}
                type="button"
                data-midi={k.midi}
                aria-label={`Play ${k.westernName} (${k.swara.full})`}
                aria-pressed={isActive}
                style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
                className={`black-key ${isActive ? "active" : ""} ${isTarget ? "target-hint" : ""}`}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.currentTarget.releasePointerCapture(e.pointerId);
                  onPointerDownKey(e.pointerId, k.midi);
                }}
                onPointerEnter={(e) => {
                  if (e.buttons > 0) onPointerEnterKey(e.pointerId, k.midi);
                }}
              >
                {!isBelow830 && k.shortcutKey && (
                  <span className="key-shortcut-badge">{k.shortcutKey}</span>
                )}
                {showSwaraLabels && (
                  <span className="key-swara-label">
                    {k.swara.displayWithOctave}
                  </span>
                )}
                {showWesternLabels && (
                  <span className="key-western-label">{k.westernName}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const useStackedLayout = isBelow830 && mobileViewMode === "stacked";

  return (
    <div role="region" aria-label="Harmonium Keyboard">
      {isBelow830 && (
        <div className="mobile-keyboard-toolbar">
          <div className="mobile-layout-toggle">
            <button
              type="button"
              className={`mobile-pill-btn ${mobileViewMode === "stacked" ? "active" : ""}`}
              onClick={() => setMobileViewMode("stacked")}
            >
              All Keys (2-Row)
            </button>
            <button
              type="button"
              className={`mobile-pill-btn ${mobileViewMode === "scroll" ? "active" : ""}`}
              onClick={() => setMobileViewMode("scroll")}
            >
              Single Row (Slide)
            </button>
          </div>

          {mobileViewMode === "scroll" && (
            <div
              className="saptak-jump-group"
              aria-label="Jump to Octave Saptak"
            >
              <button
                type="button"
                className="mobile-pill-btn"
                onClick={() => scrollToSaptak("mandra")}
              >
                ◀ Mandra
              </button>
              <button
                type="button"
                className="mobile-pill-btn"
                onClick={() => scrollToSaptak("madhya")}
              >
                Madhya
              </button>
              <button
                type="button"
                className="mobile-pill-btn"
                onClick={() => scrollToSaptak("taar")}
              >
                Taar ▶
              </button>
            </div>
          )}
        </div>
      )}

      {useStackedLayout ? (
        <div className="stacked-manuals-container">
          {renderKeyboardDeck(
            upperDeckKeys,
            "Madhya & Taar Saptak (Main & Upper Register)",
            true,
          )}
          {renderKeyboardDeck(
            lowerDeckKeys,
            "Mandra Saptak (Lower Bass Register)",
            true,
          )}
        </div>
      ) : (
        <div ref={scrollContainerRef} className="keyboard-scroll-viewport">
          {renderKeyboardDeck(allKeys, undefined, false)}
        </div>
      )}
    </div>
  );
};
