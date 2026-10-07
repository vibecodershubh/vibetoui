"use client";

import { useEffect, useState } from "react";
import { useCanvasStore } from "@/lib/store";
import { usePatchStore } from "@/store/patch";

/** Where the selected component sits inside the iframe viewport (reported by the frame script). */
export interface FrameRect {
  id: string;
  top: number;
  left: number;
  width: number;
  height: number;
  vw: number;
  vh: number;
}

const TOOLBAR_WIDTH = 480;
const ROOM_ABOVE = 112; // px needed above the component to float the toolbar over its top edge
const FRAME_BORDER = 1;

const btn =
  "rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-800 transition hover:border-zinc-900 disabled:cursor-not-allowed disabled:opacity-40";

const labelOf = (type: string) => type.replace(/[-_]+/g, " ").replace(/^./, (c) => c.toUpperCase());

/** Context toolbar anchored to the selected component: scope, lock, duplicate, undo, and an edit command. */
export function ComponentToolbar({ rect }: { rect: FrameRect }) {
  const component = useCanvasStore((s) => s.canvas.components.find((c) => c.id === rect.id));
  const historyCount = useCanvasStore((s) => s.history.length);
  const { toggleLock, duplicateComponent, undo } = useCanvasStore.getState();
  const { status, error, patch, clearError } = usePatchStore();
  const [text, setText] = useState("");

  // A new selection starts clean (the input text resets because CanvasFrame keys this by component id).
  useEffect(() => {
    clearError();
  }, [rect.id, clearError]);

  if (!component) return null;
  const loading = status === "loading";
  const locked = component.locked;

  // Float above the component; if there is no room, sit just inside its top edge. Hide when scrolled away.
  const offscreen = rect.top + rect.height < 24 || rect.top > rect.vh - 24;
  if (offscreen) return null;
  const above = rect.top >= ROOM_ABOVE;
  const top = (above ? rect.top - 8 : Math.min(Math.max(rect.top, 0) + 8, rect.vh - 120)) + FRAME_BORDER;
  const left = Math.min(Math.max(rect.left + 8, 8), Math.max(8, rect.vw - TOOLBAR_WIDTH - 8)) + FRAME_BORDER;

  return (
    <div
      role="region"
      aria-label="Edit selected section"
      style={{ top, left, width: `min(${TOOLBAR_WIDTH}px, calc(100% - 16px))`, transform: above ? "translateY(-100%)" : undefined }}
      className="absolute z-10 grid gap-2 rounded-lg border border-zinc-200 bg-white p-2 text-zinc-900 shadow-lg"
    >
      <div className="flex items-center gap-2">
        <span className="mr-auto truncate text-xs font-semibold">
          Editing: {labelOf(component.type)}
          {locked && <span className="ml-2 rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-semibold text-white">Locked</span>}
        </span>
        <button className={btn} disabled={loading} onClick={() => toggleLock(component.id)}>
          {locked ? "Unlock" : "Lock"}
        </button>
        <button className={btn} disabled={loading} onClick={() => duplicateComponent(component.id)}>
          Duplicate
        </button>
        <button className={btn} disabled={loading || historyCount === 0} onClick={() => undo()}>
          Undo{historyCount > 0 ? ` (${historyCount})` : ""}
        </button>
      </div>

      <form
        className="flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await patch(component.id, text)) setText("");
        }}
      >
        <input
          value={text}
          maxLength={500}
          disabled={loading || locked}
          onChange={(e) => {
            setText(e.target.value);
            if (error) clearError();
          }}
          placeholder={locked ? "Unlock this section to edit it" : "e.g. make it more editorial and reduce visual noise"}
          aria-label={`Describe a change to the ${labelOf(component.type)} section`}
          className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-900 disabled:bg-zinc-100"
        />
        <button
          type="submit"
          disabled={loading || locked || !text.trim()}
          className="rounded-md bg-zinc-900 px-3 text-sm font-medium text-white disabled:opacity-40"
        >
          {loading ? "Editing…" : "Apply"}
        </button>
      </form>

      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
