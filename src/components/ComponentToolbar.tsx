"use client";

import { useEffect, useState } from "react";
import { useCanvasStore } from "@/lib/store";
import { usePatchStore } from "@/store/patch";
import { primaryButton } from "./studio/EmptyState";
import { secondaryButton } from "./studio/Popover";

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

const small = `${secondaryButton} !px-2.5 !py-1 !text-xs`;

const labelOf = (type: string) => type.replace(/[-_]+/g, " ").replace(/^./, (c) => c.toUpperCase());

/** Floating toolbar anchored to the selected component: scope, lock, duplicate, undo, and an edit command. */
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
  const top = above ? rect.top - 8 : Math.min(Math.max(rect.top, 0) + 8, rect.vh - 120);
  const left = Math.min(Math.max(rect.left + 8, 8), Math.max(8, rect.vw - TOOLBAR_WIDTH - 8));

  return (
    <div
      role="region"
      aria-label="Edit selected section"
      style={{ top, left, width: `min(${TOOLBAR_WIDTH}px, calc(100% - 16px))`, transform: above ? "translateY(-100%)" : undefined }}
      className="absolute z-10 grid gap-2 rounded-card border border-line bg-panel p-2.5 text-ink shadow-float"
    >
      <div className="flex items-center gap-2">
        <span className="mr-auto truncate text-xs font-medium">
          Editing: {labelOf(component.type)}
          {locked && <span className="ml-2 rounded-[6px] bg-line px-1.5 py-0.5 text-[10px] font-medium text-stone">Locked</span>}
        </span>
        <button type="button" className={small} disabled={loading} onClick={() => toggleLock(component.id)}>
          {locked ? "Unlock" : "Lock"}
        </button>
        <button type="button" className={small} disabled={loading} onClick={() => duplicateComponent(component.id)}>
          Duplicate
        </button>
        <button type="button" className={small} disabled={loading || historyCount === 0} onClick={() => undo()}>
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
          className="min-w-0 flex-1 rounded-control border border-line bg-paper px-3 py-1.5 text-sm text-ink placeholder:text-stone disabled:opacity-60"
        />
        <button type="submit" disabled={loading || locked || !text.trim()} className={`${primaryButton} !py-1.5`}>
          {loading ? "Editing…" : "Apply"}
        </button>
      </form>

      {error && (
        <p role="alert" className="text-xs text-ink">
          {error}
        </p>
      )}
    </div>
  );
}
