import { create } from "zustand";
import { PatchResponseSchema } from "@/lib/patch";
import { useCanvasStore } from "@/lib/store";

interface PatchState {
  status: "idle" | "loading";
  error: string | null;
  /** Ask for a scoped edit of one component. Resolves true if the canvas changed. */
  patch: (componentId: string, request: string) => Promise<boolean>;
  clearError: () => void;
}

const LOCKED = "This section is locked. Unlock it to edit it.";

export const usePatchStore = create<PatchState>((set, get) => ({
  status: "idle",
  error: null,
  clearError: () => set({ error: null }),

  patch: async (componentId, request) => {
    const text = request.trim();
    if (!text || get().status === "loading") return false;

    const { canvas } = useCanvasStore.getState();
    const target = canvas.components.find((c) => c.id === componentId);
    if (!target) {
      set({ error: "That section no longer exists." });
      return false;
    }
    if (target.locked) {
      set({ error: LOCKED });
      return false;
    }

    set({ status: "loading", error: null });
    try {
      const res = await fetch("/api/patch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          componentId,
          request: text,
          designSystem: canvas.designSystem,
          components: canvas.components,
        }),
      });
      const data = PatchResponseSchema.parse(await res.json());
      if (!("component" in data) || data.fallback) {
        set({ status: "idle", error: ("error" in data && data.error) || "Couldn't apply that edit, try again." });
        return false;
      }

      // The store applies it: replace this id only, refuse if it was locked while we waited, and push
      // the undo snapshot of the pre-patch canvas. Edits made in the meantime are never overwritten.
      const result = useCanvasStore.getState().replaceComponent(componentId, data.component);
      if (!result.ok) {
        set({
          status: "idle",
          error: result.reason === "locked" ? LOCKED : "That section changed while editing, so the edit was dropped.",
        });
        return false;
      }
      set({ status: "idle" });
      return true;
    } catch {
      set({ status: "idle", error: "Couldn't reach the server. Is `npm run dev` running?" });
      return false;
    }
  },
}));
