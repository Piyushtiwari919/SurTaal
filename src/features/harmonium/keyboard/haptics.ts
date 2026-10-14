export type HapticStyle = "tap" | "slide";

let lastVibrateTimestampMs = 0;
const MIN_VIBRATE_INTERVAL_MS = 25;

/**
 * Checks whether the current browser/device supports the Web Vibration API
 * (Supported on Android Chrome, Edge, Samsung Internet, and Firefox).
 */
export function isHapticsSupported(): boolean {
  return (
    typeof navigator !== "undefined" && typeof navigator.vibrate === "function"
  );
}

/**
 * Triggers a crisp mechanical-key micro-vibration on supported mobile devices.
 */
export function triggerKeyHaptic(
  enabled: boolean,
  style: HapticStyle = "tap",
  nowMs: number = performance.now(),
): boolean {
  if (!enabled || !isHapticsSupported()) {
    return false;
  }

  // Throttle rapid consecutive calls during chords or fast glissandos
  if (nowMs - lastVibrateTimestampMs < MIN_VIBRATE_INTERVAL_MS) {
    return false;
  }

  const durationMs = style === "tap" ? 10 : 5;

  try {
    lastVibrateTimestampMs = nowMs;
    return navigator.vibrate(durationMs);
  } catch {
    return false;
  }
}

export function resetHapticThrottleForTests(): void {
  lastVibrateTimestampMs = 0;
}
