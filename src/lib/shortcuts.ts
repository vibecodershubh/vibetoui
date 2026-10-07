interface KeyLike {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

/** Cmd+Z (macOS) or Ctrl+Z (elsewhere), without Shift/Alt (those are redo/other shortcuts). */
export function isUndoShortcut(e: KeyLike): boolean {
  return (e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "z";
}

/** True when the keystroke belongs to a text field, where Cmd/Ctrl+Z must undo typing, not the page. */
export function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || typeof el.closest !== "function") return false;
  return !!el.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]');
}
