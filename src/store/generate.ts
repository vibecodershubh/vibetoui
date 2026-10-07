import { create } from "zustand";
import { z } from "zod";
import { TIMEOUTS, TimeoutError, requestJson } from "@/lib/http";
import { getPreset, presetForDirection } from "@/lib/presets";
import { GeneratedComponentsSchema, type Intent } from "@/lib/schema";
import { useCanvasStore } from "@/lib/store";
import { useHealthStore } from "./health";
import { useStudioStore } from "./studio";

const ResponseSchema = z.union([
  z.object({
    components: GeneratedComponentsSchema,
    demo: z.boolean().optional(),
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
      const data = ResponseSchema.parse(
        await requestJson("/api/generate", {
          body: { intent, designSystem, targetType: intent.targetUi.slice(0, 60) || "landing page" },
          timeoutMs: TIMEOUTS.generate,
        }),
      );
      if (!("components" in data)) {
        set({ status: "error", error: data.error });
        return;
      }
      if (!data.demo) useHealthStore.getState().report(!data.fallback, data.error);
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
      });
      if (firstGeneration) useCanvasStore.setState({ history: [] });
      set(data.fallback ? { status: "error", error: data.error ?? "Couldn't generate, try again." } : { status: "done" });
    } catch (err) {
      useHealthStore.getState().report(false, err instanceof TimeoutError ? "The request timed out." : "Can't reach the server.");
      set({
        status: "error",
        error:
          err instanceof TimeoutError
            ? "Generation took too long. Try again, or switch to demo data."
            : "Couldn't reach the server. Is `npm run dev` running?",
      });
    }
  },
}));
