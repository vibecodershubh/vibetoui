import { create } from "zustand";
import { z } from "zod";
import { DEFAULT_PRESET } from "@/lib/presets";
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
  generate: (idea: string) => Promise<void>;
}

// TEMPORARY: until the Interview Agent exists, wrap the typed idea in a low-confidence Intent.
// The server only accepts an intent (never a raw prompt), and confidence 0.3 tells the model not to
// invent specifics. Replace this with the interview's output.
function stubIntent(idea: string): Intent {
  return {
    goal: idea.trim().slice(0, 1000),
    audience: "general visitors",
    targetUi: "landing page",
    visualDirection: "follow the design system",
    contentNotes: "",
    confidence: 0.3,
  };
}

export const useGenerateStore = create<GenerateState>((set) => ({
  status: "idle",
  error: null,
  generate: async (idea) => {
    set({ status: "loading", error: null });
    try {
      const intent = stubIntent(idea);
      const { canvas, setCanvas } = useCanvasStore.getState();
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent, designSystem: DEFAULT_PRESET.designSystem, targetType: "landing page" }),
      });
      const data = ResponseSchema.parse(await res.json());
      if (!("components" in data)) {
        set({ status: "error", error: data.error });
        return;
      }
      setCanvas({
        designSystem: DEFAULT_PRESET.designSystem,
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
