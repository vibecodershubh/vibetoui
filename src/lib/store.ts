import { create } from "zustand";
import { CanvasSchema, ComponentSchema, type Canvas, type Component } from "./schema";
import { seedCanvas } from "./seed";

const MAX_HISTORY = 50;

export type ReplaceResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "locked" | "invalid" };

interface CanvasState {
  canvas: Canvas;
  selectedId: string | null;
  /** Snapshots of earlier canvases (oldest first); each content change pushes one. */
  history: Canvas[];
  setCanvas: (canvas: Canvas) => boolean;
  selectComponent: (id: string | null) => void;
  toggleLock: (id: string) => void;
  replaceComponent: (id: string, component: Component) => ReplaceResult;
  /** Inserts an unlocked copy right after `id` (new unique id), selects it, returns the new id. */
  duplicateComponent: (id: string) => string | null;
  undo: () => void;
}

const pushSnapshot = (history: Canvas[], canvas: Canvas) =>
  [...history, canvas].slice(-MAX_HISTORY);

export const useCanvasStore = create<CanvasState>((set, get) => ({
  canvas: seedCanvas,
  selectedId: null,
  history: [],

  setCanvas: (canvas) => {
    const parsed = CanvasSchema.safeParse(canvas);
    if (!parsed.success) return false;
    set((s) => ({
      canvas: parsed.data,
      history: pushSnapshot(s.history, s.canvas),
      selectedId: parsed.data.components.some((c) => c.id === s.selectedId) ? s.selectedId : null,
    }));
    return true;
  },

  selectComponent: (id) => {
    if (id !== null && !get().canvas.components.some((c) => c.id === id)) return;
    set({ selectedId: id });
  },

  // Lock state is UI state, not content: it doesn't create an undo snapshot.
  toggleLock: (id) =>
    set((s) => ({
      canvas: {
        ...s.canvas,
        components: s.canvas.components.map((c) => (c.id === id ? { ...c, locked: !c.locked } : c)),
      },
    })),

  // Smallest-change invariant: replace exactly one component by id, never a locked one.
  // The incoming component can't change the target's id or lock state.
  replaceComponent: (id, component) => {
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
      history: pushSnapshot(s.history, s.canvas),
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
      history: pushSnapshot(s.history, s.canvas),
      selectedId: newId,
    }));
    return newId;
  },

  // Restores the previous snapshot but keeps current lock flags, so undo can't unlock/lock anything.
  undo: () => {
    const { history, canvas } = get();
    const previous = history[history.length - 1];
    if (!previous) return;
    const locks = new Map(canvas.components.map((c) => [c.id, c.locked]));
    const restored: Canvas = {
      ...previous,
      components: previous.components.map((c) => ({ ...c, locked: locks.get(c.id) ?? c.locked })),
    };
    set((s) => ({
      canvas: restored,
      history: history.slice(0, -1),
      selectedId: restored.components.some((c) => c.id === s.selectedId) ? s.selectedId : null,
    }));
  },
}));
