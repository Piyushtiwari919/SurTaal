import { resolveShortcutToMidi } from "./KeyboardLayout";

export type NoteInputSource = "keyboard" | "pointer-tap" | "pointer-slide";

export interface NoteInputCallbacks {
  onNoteOn: (midi: number, source: NoteInputSource) => void;
  onNoteOff: (midi: number, source: NoteInputSource) => void;
  onOctaveDelta?: (delta: -1 | 1) => void;
  onReleaseAll?: () => void;
}

export function isTextInputElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    target.isContentEditable
  );
}

export class UnifiedInputController {
  private pressedKeys = new Map<string, number>(); // physical key -> midi
  private activePointers = new Map<number, number>(); // pointerId -> midi
  private octaveShift = 0;
  private callbacks: NoteInputCallbacks;

  constructor(callbacks: NoteInputCallbacks) {
    this.callbacks = callbacks;
  }

  public setOctaveShift(octaveShift: number): void {
    this.octaveShift = octaveShift;
  }

  public handleKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    if (isTextInputElement(event.target)) return;

    if (event.key === "z" || event.key === "Z") {
      this.callbacks.onOctaveDelta?.(-1);
      return;
    }
    if (event.key === "x" || event.key === "X") {
      this.callbacks.onOctaveDelta?.(1);
      return;
    }

    const normalized = event.key.toLowerCase();
    if (this.pressedKeys.has(normalized)) return;

    const midi = resolveShortcutToMidi(normalized, this.octaveShift);
    if (midi !== null) {
      event.preventDefault();
      this.pressedKeys.set(normalized, midi);
      this.callbacks.onNoteOn(midi, "keyboard");
    }
  };

  public handleKeyUp = (event: KeyboardEvent): void => {
    const normalized = event.key.toLowerCase();
    const activeMidi = this.pressedKeys.get(normalized);
    if (activeMidi !== undefined) {
      this.pressedKeys.delete(normalized);
      this.callbacks.onNoteOff(activeMidi, "keyboard");
    }
  };

  public handlePointerDown(pointerId: number, midi: number): void {
    const existing = this.activePointers.get(pointerId);
    if (existing === midi) return;
    if (existing !== undefined) {
      this.callbacks.onNoteOff(existing, "pointer-tap");
    }
    this.activePointers.set(pointerId, midi);
    this.callbacks.onNoteOn(midi, "pointer-tap");
  }

  public handlePointerMoveToMidi(pointerId: number, midi: number): void {
    if (!this.activePointers.has(pointerId)) return;
    const previousMidi = this.activePointers.get(pointerId);
    if (previousMidi !== undefined && previousMidi !== midi) {
      this.callbacks.onNoteOff(previousMidi, "pointer-slide");
      this.activePointers.set(pointerId, midi);
      this.callbacks.onNoteOn(midi, "pointer-slide");
    }
  }

  public handlePointerUp(pointerId: number): void {
    const midi = this.activePointers.get(pointerId);
    if (midi !== undefined) {
      this.activePointers.delete(pointerId);
      this.callbacks.onNoteOff(midi, "pointer-tap");
    }
  }

  public panicReleaseAll = (): void => {
    for (const midi of this.pressedKeys.values()) {
      this.callbacks.onNoteOff(midi, "keyboard");
    }
    for (const midi of this.activePointers.values()) {
      this.callbacks.onNoteOff(midi, "pointer-tap");
    }
    this.pressedKeys.clear();
    this.activePointers.clear();
    this.callbacks.onReleaseAll?.();
  };
}
