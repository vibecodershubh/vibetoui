import { create } from "zustand";
import { z } from "zod";
import { TIMEOUTS, TimeoutError, requestJson } from "@/lib/http";
import { useStudioStore } from "./studio";

/**
 * - checking: waiting for an answer
 * - ready:    Gemini is configured, but nothing has been tried yet (free to know, so it is the default)
 * - ok:       a real request (or an explicit check) succeeded
 * - down:     a real request (or an explicit check) failed, or Gemini is not configured
 * - demo:     saved demo data is being served
 */
export type HealthStatus = "checking" | "ready" | "ok" | "down" | "demo";

const ResponseSchema = z.object({
  ok: z.boolean(),
  message: z.string().optional(),
  demo: z.boolean().optional(),
});

interface HealthState {
  status: HealthStatus;
  /** A fixed sentence from the server (variable names only, never values) or a client-side note. */
  message: string | null;
  /** True when the SERVER is in demo mode (DEMO_MODE=true), so "Go live" would not help. */
  serverDemo: boolean;
  /**
   * FREE: is Gemini configured? (/api/health?mode=config, no model call). Run on load and when the tab is shown.
   * It never overrides what a real request told us ("ok" / "down").
   */
  checkConfig: () => Promise<void>;
  /** One real, tiny Gemini call (/api/health). Costs a request, so it only runs when the user asks. */
  verify: () => Promise<void>;
  /** FREE: a real request just worked (ok) or failed. This is how the indicator stays accurate without polling. */
  report: (ok: boolean, message?: string) => void;
}

const isDemo = () => useStudioStore.getState().demo;

async function ask(url: string) {
  return ResponseSchema.parse(await requestJson(url, { timeoutMs: TIMEOUTS.health }));
}

const failure = (err: unknown) => (err instanceof TimeoutError ? "The health check timed out." : "Can't reach the server.");

export const useHealthStore = create<HealthState>((set, get) => ({
  status: "checking",
  message: null,
  serverDemo: false,

  checkConfig: async () => {
    if (isDemo()) return set({ status: "demo", message: null });
    try {
      const body = await ask("/api/health?mode=config");
      // The demo switch can flip while this request is in flight (e.g. ?demo=1 is read after the first check starts).
      if (isDemo()) return set({ status: "demo", message: null });
      if (!body.ok) return set({ status: "down", message: body.message ?? "Gemini is not configured.", serverDemo: false });
      if (body.demo) return set({ status: "demo", message: null, serverDemo: true });
      // configured: keep what real requests have shown us, otherwise we are simply "ready"
      const { status } = get();
      set({ status: status === "ok" || status === "down" ? status : "ready", serverDemo: false });
    } catch (err) {
      if (isDemo()) return set({ status: "demo", message: null });
      set({ status: "down", message: failure(err), serverDemo: false });
    }
  },

  verify: async () => {
    if (isDemo()) return set({ status: "demo", message: null });
    set({ status: "checking", message: null });
    try {
      const body = await ask("/api/health");
      if (isDemo()) return set({ status: "demo", message: null });
      if (body.ok) set({ status: body.demo ? "demo" : "ok", message: null, serverDemo: !!body.demo });
      else set({ status: "down", message: body.message ?? "The model API is not responding.", serverDemo: false });
    } catch (err) {
      set({ status: "down", message: failure(err), serverDemo: false });
    }
  },

  report: (ok, message) => {
    if (isDemo()) return; // demo data says nothing about the real API
    set(ok ? { status: "ok", message: null } : { status: "down", message: message ?? "The last request failed." });
  },
}));
