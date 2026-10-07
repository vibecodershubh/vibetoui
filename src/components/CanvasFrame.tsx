"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildDocument } from "@/lib/export";
import { sanitizeHtml } from "@/lib/html";
import { useCanvasStore } from "@/lib/store";
import { ComponentToolbar, type FrameRect } from "./ComponentToolbar";

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** The sandboxed live preview. Fills its parent; the device frame around it decides the width. */
export function CanvasFrame({ className = "", toolbar = true }: { className?: string; toolbar?: boolean }) {
  const components = useCanvasStore((s) => s.canvas.components);
  const designSystem = useCanvasStore((s) => s.canvas.designSystem);
  const selectedId = useCanvasStore((s) => s.selectedId);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [rect, setRect] = useState<FrameRect | null>(null);

  // The frame is reloaded only when the STRUCTURE changes (design system, which sections exist, in what
  // order). A change to one section's html is swapped in place (see syncContent), so a scoped patch never
  // reloads the preview, loses the scroll position, or touches any other section.
  const structureKey = JSON.stringify([designSystem, components.map((c) => [c.id, c.type])]);
  const { srcDoc, snapshot } = useMemo(
    () => ({
      srcDoc: buildDocument(components, designSystem, { frame: true }),
      snapshot: new Map(components.map((c) => [c.id, c.html])),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on structure only (see above)
    [structureKey],
  );

  // What the frame is currently showing (raw html per id), and whether its script is listening yet.
  const shownRef = useRef(snapshot);
  const readyRef = useRef(false);
  useEffect(() => {
    shownRef.current = snapshot;
    readyRef.current = false; // the frame is reloading; wait for its "ready"
  }, [snapshot]);

  const post = useCallback((message: unknown) => {
    iframeRef.current?.contentWindow?.postMessage(message, "*"); // opaque origin; payload is ids/html
  }, []);

  const postState = useCallback(() => {
    const { selectedId, canvas } = useCanvasStore.getState();
    post({
      type: "state",
      selectedId,
      lockedIds: canvas.components.filter((c) => c.locked).map((c) => c.id),
    });
  }, [post]);

  /** Swap in any section whose html differs from what the frame shows (patch, undo, ...). */
  const syncContent = useCallback(() => {
    if (!readyRef.current) return;
    for (const c of useCanvasStore.getState().canvas.components) {
      const shown = shownRef.current.get(c.id);
      if (shown !== undefined && shown !== c.html) {
        shownRef.current.set(c.id, c.html);
        post({ type: "replace", id: c.id, html: sanitizeHtml(c.html) });
      }
    }
  }, [post]);

  useEffect(
    () =>
      useCanvasStore.subscribe(() => {
        syncContent();
        postState();
      }),
    [syncContent, postState],
  );

  // Messages from the iframe: only trust our own iframe's window.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== iframeRef.current?.contentWindow) return;
      const data = e.data as Record<string, unknown> | null;
      if (data?.type === "ready") {
        readyRef.current = true;
        syncContent(); // catch up on anything that changed while the frame was loading
        postState();
      } else if (data?.type === "select") {
        useCanvasStore.getState().selectComponent(typeof data.id === "string" ? data.id : null);
      } else if (data?.type === "rect") {
        if (typeof data.id === "string" && [data.top, data.left, data.width, data.height, data.vw, data.vh].every(isNum)) {
          setRect({
            id: data.id,
            top: data.top as number,
            left: data.left as number,
            width: data.width as number,
            height: data.height as number,
            vw: data.vw as number,
            vh: data.vh as number,
          });
        } else {
          setRect(null);
        }
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [postState, syncContent]);

  return (
    <div className={`relative ${className}`}>
      <iframe
        ref={iframeRef}
        title="Page preview"
        sandbox="allow-scripts"
        srcDoc={srcDoc}
        className="h-full w-full bg-panel"
      />
      {toolbar && selectedId && rect && rect.id === selectedId && <ComponentToolbar key={rect.id} rect={rect} />}
    </div>
  );
}
