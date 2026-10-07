"use client";

import { useMemo, useState } from "react";
import { cleanSectionHtml } from "@/lib/export";
import { highlightHtml } from "@/lib/highlight";
import { useCanvasStore } from "@/lib/store";
import { useGenerateStore } from "@/store/generate";
import { secondaryButton } from "./Popover";

/** Pretty-printed, syntax-highlighted HTML of the selected section, or of the whole page. */
export function CodeView() {
  const components = useCanvasStore((s) => s.canvas.components);
  const selectedId = useCanvasStore((s) => s.selectedId);
  const status = useGenerateStore((s) => s.status);
  const [note, setNote] = useState<string | null>(null);

  const selected = components.find((c) => c.id === selectedId);
  const code = useMemo(
    () => (selected ? cleanSectionHtml(selected.html) : components.map((c) => cleanSectionHtml(c.html)).join("\n\n")),
    [selected, components],
  );
  const tokens = useMemo(() => highlightHtml(code), [code]);

  if (status !== "done" && status !== "error") {
    return <p className="text-sm text-stone">Nothing to show yet. Generate a page to see its code.</p>;
  }

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-ink">{selected ? `Section: ${selected.id}` : "Whole page"}</span>
        <div className="flex items-center gap-2">
          <span role="status" className="text-xs text-stone">
            {note}
          </span>
          <button
            type="button"
            className={secondaryButton}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(code);
                setNote("Copied");
              } catch {
                setNote("Copy blocked");
              }
              window.setTimeout(() => setNote(null), 2000);
            }}
          >
            Copy
          </button>
        </div>
      </div>
      {!selected && <p className="text-xs text-stone">Select a section in the preview to see only its code.</p>}
      <pre
        tabIndex={0}
        aria-label="HTML source"
        className="max-h-[60vh] overflow-auto rounded-control border border-line bg-paper p-3 font-mono text-xs leading-relaxed text-ink"
      >
        <code>
          {tokens.map((t, i) =>
            t.kind === "text" ? (
              t.text
            ) : (
              <span key={i} className={`syn-${t.kind}`}>
                {t.text}
              </span>
            ),
          )}
        </code>
      </pre>
    </div>
  );
}
