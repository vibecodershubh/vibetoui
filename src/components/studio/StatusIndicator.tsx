"use client";

import { useEffect } from "react";
import { useHealthStore } from "@/store/health";
import { useStudioStore } from "@/store/studio";

const LABEL = {
  checking: "Checking…",
  ready: "Gemini ready",
  ok: "Gemini live",
  down: "API unavailable",
  demo: "Demo mode",
} as const;

/**
 * A small, quiet status: a dot and a word (never color-only). It makes NO model calls by itself: it checks that
 * Gemini is configured (free) and learns "live" / "unavailable" from the real requests the app makes. Free-tier
 * keys allow only about 20 requests a day, so a model call happens only when you press Check.
 */
export function StatusIndicator() {
  const status = useHealthStore((s) => s.status);
  const message = useHealthStore((s) => s.message);
  const serverDemo = useHealthStore((s) => s.serverDemo);
  const checkConfig = useHealthStore((s) => s.checkConfig);
  const verify = useHealthStore((s) => s.verify);
  const demo = useStudioStore((s) => s.demo);
  const setDemo = useStudioStore((s) => s.setDemo);

  // Free configuration check on load, when the tab is shown again, and when the demo switch flips.
  useEffect(() => {
    void checkConfig();
    const onVisible = () => {
      if (document.visibilityState === "visible") void checkConfig();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [checkConfig, demo]);

  const dot =
    status === "ok" ? "bg-ink" : status === "down" ? "bg-stone ring-2 ring-stone/40" : status === "checking" ? "border border-stone" : "bg-stone";
  const action = "text-xs text-stone underline underline-offset-4 transition-colors duration-150 hover:text-ink";

  return (
    <div role="status" aria-live="polite" className="flex items-center gap-2 text-xs text-stone">
      <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${dot}`} />
      <span title={message ?? undefined} className={status === "down" ? "font-medium text-ink" : undefined}>
        {LABEL[status]}
      </span>
      {status === "down" && (
        <>
          <button type="button" className={action} onClick={() => setDemo(true)}>
            Use demo
          </button>
          <button type="button" className={action} onClick={() => void verify()}>
            Check again
          </button>
        </>
      )}
      {(status === "ready" || status === "ok") && (
        <button type="button" className={action} onClick={() => void verify()} title="Makes one tiny Gemini request">
          Check
        </button>
      )}
      {status === "demo" && demo && !serverDemo && (
        <button type="button" className={action} onClick={() => setDemo(false)}>
          Go live
        </button>
      )}
    </div>
  );
}
