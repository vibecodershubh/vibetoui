import { create } from "zustand";
import { z } from "zod";

const ResponseSchema = z.union([
  z.object({ html: z.string(), demo: z.boolean().optional() }),
  z.object({ error: z.string() }),
]);

type Status = "idle" | "loading" | "done" | "error";

interface GenerateState {
  status: Status;
  html: string | null;
  error: string | null;
  generate: (prompt: string) => Promise<void>;
}

export const useGenerateStore = create<GenerateState>((set) => ({
  status: "idle",
  html: null,
  error: null,
  generate: async (prompt) => {
    set({ status: "loading", error: null });
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = ResponseSchema.parse(await res.json());
      if ("error" in data) {
        set({ status: "error", error: data.error });
      } else {
        set({ status: "done", html: data.html });
      }
    } catch {
      set({ status: "error", error: "Couldn't reach the server. Is `npm run dev` running?" });
    }
  },
}));
