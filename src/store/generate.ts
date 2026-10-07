import { create } from "zustand";
import { z } from "zod";
import { getPreset, presetForDirection } from "@/lib/presets";
import { GeneratedComponentsSchema, type Intent } from "@/lib/schema";
import { useCanvasStore } from "@/lib/store";
import { useStudioStore } from "./studio";

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
      // The studio's direction is the source of truth (the interview and the top bar both set it);
      // the brief is sent with the same direction name so the prompt and the tokens agree.
      const preset = getPreset(useStudioStore.getState().presetId) ?? presetForDirection(intent.visualDirection);
      const designSystem = preset.designSystem;
      intent = { ...intent, visualDirection: preset.name };
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
      // The canvas starts as a built-in sample. The first generation replaces it, and there is nothing
      // real to undo back to, so Undo must not resurrect the sample.
      const firstGeneration = canvas.metadata.history.length === 0;
      setCanvas({
        designSystem,
        components: data.components.map((c) => ({ ...c, locked: false })),
        metadata: {
          intent,
          history: [...canvas.metadata.history, { at: new Date().toISOString(), summary: "Generated page" }],
        },
      }, firstGeneration ? "Generated page" : "Regenerated page");
      if (firstGeneration) useCanvasStore.getState().resetHistory("Generated page");
      set(data.fallback ? { status: "error", error: data.error ?? "Couldn't generate, try again." } : { status: "done" });
    } catch {
      set({ status: "error", error: "Couldn't reach the server. Is `npm run dev` running?" });
    }
  },
}));
