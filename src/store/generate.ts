import { create } from "zustand";
import { z } from "zod";
import { presetForDirection } from "@/lib/presets";
import { GeneratedComponentsSchema, type Intent } from "@/lib/schema";
import { useCanvasStore } from "@/lib/store";

const ResponseSchema = z.union([
  z.object({
    components: GeneratedComponentsSchema,
    fallback: z.boolean().optional(),
    error: z.string().optional(),
  }),
  z.object({ error: z.string() }),
]);

type Status = "idle" | "loading" | "done" | "error";

interface GenerateState {
  status: Status;
  error: string | null;
  /** Generate from a (confirmed or skipped-ahead) brief. The visual direction picks the design system. */
  generate: (intent: Intent) => Promise<void>;
  reset: () => void;
}

export const useGenerateStore = create<GenerateState>((set) => ({
  status: "idle",
  error: null,
  reset: () => set({ status: "idle", error: null }),
  generate: async (intent) => {
    set({ status: "loading", error: null });
    try {
      const designSystem = presetForDirection(intent.visualDirection).designSystem;
      const { canvas, setCanvas } = useCanvasStore.getState();
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent, designSystem, targetType: intent.targetUi.slice(0, 60) || "landing page" }),
      });
      const data = ResponseSchema.parse(await res.json());
      if (!("components" in data)) {
        set({ status: "error", error: data.error });
        return;
      }
      setCanvas({
        designSystem,
        components: data.components.map((c) => ({ ...c, locked: false })),
        metadata: {
          intent,
          history: [...canvas.metadata.history, { at: new Date().toISOString(), summary: "Generated page" }],
        },
      });
      set(data.fallback ? { status: "error", error: data.error ?? "Couldn't generate, try again." } : { status: "done" });
    } catch {
      set({ status: "error", error: "Couldn't reach the server. Is `npm run dev` running?" });
    }
  },
}));
