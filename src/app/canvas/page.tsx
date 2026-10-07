"use client";

import { useState } from "react";
import { CanvasFrame } from "@/components/CanvasFrame";
import { PRESETS } from "@/lib/presets";
import { useCanvasStore } from "@/lib/store";

// Test harness for selection + locking, no AI involved.
export default function CanvasTestPage() {
  const { canvas, selectedId, history, selectComponent, setCanvas, toggleLock, replaceComponent, undo } =
    useCanvasStore();
  const [message, setMessage] = useState<string | null>(null);
  const selected = canvas.components.find((c) => c.id === selectedId) ?? null;

  const testReplace = () => {
    if (!selected) return;
    const result = replaceComponent(selected.id, {
      ...selected,
      html: `<section class="bg-emerald-600 px-8 py-16 text-center text-xl font-semibold text-white">Replaced ${selected.type} (${new Date().toLocaleTimeString()})</section>`,
    });
    setMessage(result.ok ? `Replaced ${selected.id}` : `Rejected: ${result.reason}`);
  };

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 gap-6 px-4 py-8">
      <CanvasFrame className="h-[80vh] flex-1 overflow-hidden rounded-lg border border-zinc-200" />

      <aside className="flex w-64 shrink-0 flex-col gap-4 text-sm">
        <h1 className="text-lg font-semibold">Canvas test</h1>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Design direction">
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => setCanvas({ ...canvas, designSystem: preset.designSystem })}
              aria-pressed={JSON.stringify(canvas.designSystem) === JSON.stringify(preset.designSystem)}
              className="rounded-lg border border-zinc-300 px-2 py-1 aria-pressed:border-zinc-900 aria-pressed:bg-zinc-900 aria-pressed:text-white"
            >
              {preset.name}
            </button>
          ))}
        </div>
        <ul className="flex flex-col gap-2">
          {canvas.components.map((c) => (
            <li
              key={c.id}
              className={`flex items-center justify-between rounded-lg border px-3 py-2 ${
                c.id === selectedId ? "border-indigo-600 bg-indigo-50" : "border-zinc-200"
              }`}
            >
              <button className="text-left" onClick={() => selectComponent(c.id)}>
                {c.type} <span className="text-zinc-400">{c.id}</span>
              </button>
              <button
                onClick={() => toggleLock(c.id)}
                aria-label={`${c.locked ? "Unlock" : "Lock"} ${c.id}`}
                className="rounded border border-zinc-300 px-2 py-0.5"
              >
                {c.locked ? "Unlock" : "Lock"}
              </button>
            </li>
          ))}
        </ul>

        <div className="flex gap-2">
          <button
            onClick={testReplace}
            disabled={!selected}
            className="rounded-lg bg-zinc-900 px-3 py-2 text-white disabled:opacity-40"
          >
            Replace selected
          </button>
          <button
            onClick={() => {
              undo();
              setMessage(null);
            }}
            disabled={history.length === 0}
            className="rounded-lg border border-zinc-300 px-3 py-2 disabled:opacity-40"
          >
            Undo ({history.length})
          </button>
        </div>

        <p role="status" className="min-h-5 text-zinc-600">
          {message ?? (selected ? `Selected: ${selected.id}` : "Click a section in the preview.")}
        </p>
      </aside>
    </main>
  );
}
