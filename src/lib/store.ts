import { create } from "zustand";
import { CanvasSchema, ComponentSchema, type Canvas, type Component } from "./schema";
import { seedCanvas } from "./seed";

const MAX_HISTORY = 50;

export type ReplaceResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "locked" | "invalid" };

/** A state the page was in. `label` is the change that produced it; `at` is when. */
export interface Version {
  id: string;
  at: number;
  label: string;
  canvas: Canvas;
}

interface CanvasState {
  canvas: Canvas;
  selectedId: string | null;
  /** Earlier states, oldest first. Every content change pushes the state it replaced. */
  history: Version[];
  /** What produced the CURRENT state, and when. */
  currentLabel: string;
  currentAt: number;
  setCanvas: (canvas: Canvas, label?: string) => boolean;
  selectComponent: (id: string | null) => void;
  toggleLock: (id: string) => void;
  replaceComponent: (id: string, component: Component, label?: string) => ReplaceResult;
  /** Inserts an unlocked copy right after `id` (new unique id), selects it, returns the new id. */
  duplicateComponent: (id: string) => string | null;
  /** Go back one version (the latest history entry becomes current). */
  undo: () => void;
  /**
   * Make an earlier version current. Non-destructive: the state being left is kept in history, so the
   * restore itself can be undone or reversed.
   */
  restoreVersion: (id: string) => boolean;
  /** Forget all history and start from the current state (used when a first page replaces the sample). */
  resetHistory: (label: string) => void;
}

let versionCounter = 0;
const newVersionId = () => `v${Date.now().toString(36)}${(versionCounter++).toString(36)}`;

/** The current state, saved as a history entry (capped). */
const withSaved = (s: Pick<CanvasState, "history" | "canvas" | "currentLabel" | "currentAt">): Version[] =>
  [...s.history, { id: newVersionId(), at: s.currentAt, label: s.currentLabel, canvas: s.canvas }].slice(-MAX_HISTORY);

/** `canvas` with the lock flags of the page as it is NOW: history never changes what is locked. */
const keepCurrentLocks = (canvas: Canvas, current: Canvas): Canvas => {
  const locks = new Map(current.components.map((c) => [c.id, c.locked]));
  return { ...canvas, components: canvas.components.map((c) => ({ ...c, locked: locks.get(c.id) ?? c.locked })) };
};

const labelOf = (type: string) => type.replace(/[-_]+/g, " ").replace(/^./, (c) => c.toUpperCase());

export const useCanvasStore = create<CanvasState>((set, get) => ({
  canvas: seedCanvas,
  selectedId: null,
  history: [],
  currentLabel: "Sample page",
  currentAt: Date.now(),

  setCanvas: (canvas, label = "Updated page") => {
    const parsed = CanvasSchema.safeParse(canvas);
    if (!parsed.success) return false;
    set((s) => ({
      canvas: parsed.data,
      history: withSaved(s),
      currentLabel: label,
      currentAt: Date.now(),
      selectedId: parsed.data.components.some((c) => c.id === s.selectedId) ? s.selectedId : null,
    }));
    return true;
  },

  selectComponent: (id) => {
    if (id !== null && !get().canvas.components.some((c) => c.id === id)) return;
    set({ selectedId: id });
  },

  // Lock state is UI state, not content: it doesn't create a version.
  toggleLock: (id) =>
    set((s) => ({
      canvas: {
        ...s.canvas,
        components: s.canvas.components.map((c) => (c.id === id ? { ...c, locked: !c.locked } : c)),
      },
    })),

  // Smallest-change invariant: replace exactly one component by id, never a locked one.
  // The incoming component can't change the target's id or lock state.
  replaceComponent: (id, component, label) => {
    const { canvas } = get();
    const existing = canvas.components.find((c) => c.id === id);
    if (!existing) return { ok: false, reason: "not_found" };
    if (existing.locked) return { ok: false, reason: "locked" };

    const parsed = ComponentSchema.safeParse({ ...component, id, locked: existing.locked });
    if (!parsed.success) return { ok: false, reason: "invalid" };

    set((s) => ({
      canvas: {
        ...s.canvas,
        components: s.canvas.components.map((c) => (c.id === id ? parsed.data : c)),
      },
      history: withSaved(s),
      currentLabel: label ?? `Edited ${labelOf(existing.type)}`,
      currentAt: Date.now(),
    }));
    return { ok: true };
  },

  duplicateComponent: (id) => {
    const { canvas } = get();
    const index = canvas.components.findIndex((c) => c.id === id);
    if (index === -1) return null;
    const source = canvas.components[index];

    // "hero-1" -> "hero-2", "hero-3", ... (ids are at most 40 chars, lowercase kebab-case)
    const base = source.id.replace(/-\d+$/, "").slice(0, 34);
    const taken = new Set(canvas.components.map((c) => c.id));
    let n = 2;
    while (taken.has(`${base}-${n}`)) n++;
    const newId = `${base}-${n}`;

    const copy: Component = { ...source, id: newId, props: { ...source.props }, locked: false };
    const components = [...canvas.components];
    components.splice(index + 1, 0, copy);
    set((s) => ({
      canvas: { ...s.canvas, components },
      history: withSaved(s),
      currentLabel: `Duplicated ${labelOf(source.type)}`,
      currentAt: Date.now(),
      selectedId: newId,
    }));
    return newId;
  },

  // Restores the previous version but keeps current lock flags, so undo can't unlock/lock anything.
  undo: () => {
    const { history, canvas } = get();
    const previous = history[history.length - 1];
    if (!previous) return;
    const restored = keepCurrentLocks(previous.canvas, canvas);
    set((s) => ({
      canvas: restored,
      history: history.slice(0, -1),
      currentLabel: previous.label,
      currentAt: previous.at,
      selectedId: restored.components.some((c) => c.id === s.selectedId) ? s.selectedId : null,
    }));
  },

  restoreVersion: (id) => {
    const { history, canvas } = get();
    const version = history.find((v) => v.id === id);
    if (!version) return false;
    const restored = keepCurrentLocks(version.canvas, canvas);
    set((s) => ({
      canvas: restored,
      history: withSaved(s), // keep the state we are leaving
      currentLabel: `Restored: ${version.label}`,
      currentAt: Date.now(),
      selectedId: restored.components.some((c) => c.id === s.selectedId) ? s.selectedId : null,
    }));
    return true;
  },

  resetHistory: (label) => set({ history: [], currentLabel: label, currentAt: Date.now() }),
}));
