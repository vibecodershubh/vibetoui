"use client";

import { useEffect, useRef } from "react";
import { useCanvasStore } from "@/lib/store";
import { useStudioStore } from "@/store/studio";
import { secondaryButton } from "./Popover";

const time = (at: number) =>
  new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

/** Slide-over listing every version of the page with its time. Restoring never loses anything. */
export function HistoryDrawer() {
  const open = useStudioStore((s) => s.historyOpen);
  const setOpen = useStudioStore((s) => s.setHistoryOpen);
  const history = useCanvasStore((s) => s.history);
  const currentLabel = useCanvasStore((s) => s.currentLabel);
  const currentAt = useCanvasStore((s) => s.currentAt);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Esc closes and hands focus back to the button that opened it; opening moves focus into the drawer.
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      document.getElementById("history-toggle")?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  const versions = [...history].reverse(); // newest first

  return (
    <aside
      id="history-drawer"
      aria-label="Version history"
      inert={!open}
      style={{ transition: "transform 200ms ease" }}
      className={`fixed inset-y-0 right-0 z-30 flex w-80 max-w-full flex-col border-l border-line bg-panel shadow-float ${
        open ? "translate-x-0" : "translate-x-full"
      }`}
    >
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="font-serif text-xl text-ink">Version history</h2>
        <button
          ref={closeRef}
          type="button"
          className={secondaryButton}
          onClick={() => {
            setOpen(false);
            document.getElementById("history-toggle")?.focus();
          }}
        >
          Close
        </button>
      </div>

      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <p className="text-xs text-stone">
          Undo with <kbd className="rounded-[6px] border border-line px-1.5 py-0.5 font-mono text-[11px]">Ctrl</kbd> /{" "}
          <kbd className="rounded-[6px] border border-line px-1.5 py-0.5 font-mono text-[11px]">⌘</kbd> +{" "}
          <kbd className="rounded-[6px] border border-line px-1.5 py-0.5 font-mono text-[11px]">Z</kbd>
        </p>
        <button
          type="button"
          className={secondaryButton}
          disabled={history.length === 0}
          onClick={() => useCanvasStore.getState().undo()}
        >
          Undo
        </button>
      </div>

      <ol className="min-h-0 flex-1 overflow-y-auto px-4 pb-4" aria-label="Versions, newest first">
        <li className="border-t border-line py-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-ink">{currentLabel}</span>
            <span className="rounded-[6px] bg-accent-soft px-1.5 py-0.5 text-[11px] font-medium text-accent">Current</span>
          </div>
          <time className="text-xs text-stone" dateTime={new Date(currentAt).toISOString()}>
            {time(currentAt)}
          </time>
        </li>
        {versions.map((v) => (
          <li key={v.id} className="border-t border-line py-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm text-ink">{v.label}</p>
                <time className="text-xs text-stone" dateTime={new Date(v.at).toISOString()}>
                  {time(v.at)}
                </time>
              </div>
              <button
                type="button"
                className={secondaryButton}
                aria-label={`Restore version: ${v.label}, ${time(v.at)}`}
                onClick={() => useCanvasStore.getState().restoreVersion(v.id)}
              >
                Restore
              </button>
            </div>
          </li>
        ))}
        {versions.length === 0 && <li className="border-t border-line py-3 text-sm text-stone">No earlier versions yet. Edit the page and they will appear here.</li>}
      </ol>
    </aside>
  );
}
