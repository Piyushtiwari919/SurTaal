export type HapticStyle = "tap" | "slide";

let lastVibrateTimestampMs = 0;
const MIN_VIBRATE_INTERVAL_MS = 60;

/**
 * Checks whether the current browser/device supports the Web Vibration API.
 */
export function isHapticsSupported(): boolean {
  return (
    typeof navigator !== "undefined" && typeof navigator.vibrate === "function"
  );
}

/**
 * Triggers a single, crisp 6ms mechanical micro-tick on key tap.
 * Ignores 'slide' events so sliding across keys never buzzes repeatedly.
 */
export function triggerKeyHaptic(
  enabled: boolean,
  style: HapticStyle = "tap",
  nowMs: number = performance.now(),
): boolean {
  if (!enabled || style === "slide" || !isHapticsSupported()) {
    return false;
  }

  // Throttle consecutive taps within 60ms so chords or double-events never double-buzz
  if (nowMs - lastVibrateTimestampMs < MIN_VIBRATE_INTERVAL_MS) {
    return false;
  }

  try {
    lastVibrateTimestampMs = nowMs;
    // Cancel any lingering vibration in Android's queue before firing a crisp 6ms tick
    navigator.vibrate(0);
    return navigator.vibrate(6);
  } catch {
    return false;
  }
}

export function resetHapticThrottleForTests(): void {
  lastVibrateTimestampMs = 0;
}
