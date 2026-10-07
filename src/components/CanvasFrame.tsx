"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { sanitizeHtml } from "@/lib/html";
import { useCanvasStore } from "@/lib/store";

const TAILWIND_CDN = "https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4";

// Runs inside the sandboxed iframe. Hover highlight is pure CSS; this script only
// reports clicks to the parent and applies selection/lock state the parent sends.
const FRAME_STYLE = `
[data-vui-id]{position:relative;cursor:pointer}
[data-vui-id]:hover{outline:2px dashed rgba(99,102,241,.7);outline-offset:-2px}
[data-vui-id][data-vui-selected]{outline:2px solid #4f46e5;outline-offset:-2px}
[data-vui-id][data-vui-selected]::before{content:attr(data-vui-type);position:absolute;top:0;left:0;z-index:2147483000;pointer-events:none;
  background:#4f46e5;color:#fff;font:600 11px/1 system-ui,sans-serif;padding:4px 8px;border-bottom-right-radius:6px;text-transform:capitalize}
[data-vui-id][data-vui-locked]::after{content:"\\1F512  Locked";position:absolute;top:0;right:0;z-index:2147483000;pointer-events:none;
  background:#1e293b;color:#fff;font:600 11px/1 system-ui,sans-serif;padding:4px 8px;border-bottom-left-radius:6px}
`;

const FRAME_SCRIPT = `
(function(){
  var selectedId=null, locked=[];
  function apply(){
    document.querySelectorAll('[data-vui-id]').forEach(function(el){
      var id=el.getAttribute('data-vui-id');
      el.toggleAttribute('data-vui-selected', id===selectedId);
      el.toggleAttribute('data-vui-locked', locked.indexOf(id)!==-1);
    });
  }
  window.addEventListener('message',function(e){
    if(e.source!==window.parent||!e.data||e.data.type!=='state')return;
    selectedId=e.data.selectedId; locked=e.data.lockedIds||[]; apply();
  });
  document.addEventListener('click',function(e){
    e.preventDefault();
    var el=e.target.closest&&e.target.closest('[data-vui-id]');
    window.parent.postMessage({type:'select',id:el?el.getAttribute('data-vui-id'):null},'*');
  },true);
  window.parent.postMessage({type:'ready'},'*');
})();
`;

const escapeAttr = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function CanvasFrame({ className = "" }: { className?: string }) {
  const components = useCanvasStore((s) => s.canvas.components);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // srcDoc depends only on content, so selecting/locking never reloads the iframe.
  const contentKey = JSON.stringify(components.map((c) => [c.id, c.type, c.html]));
  const srcDoc = useMemo(() => {
    const body = components
      .map(
        (c) =>
          `<div data-vui-id="${escapeAttr(c.id)}" data-vui-type="${escapeAttr(c.type)}">${sanitizeHtml(c.html)}</div>`,
      )
      .join("\n");
    return `<!doctype html>
<html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<script src="${TAILWIND_CDN}"></script>
<style>${FRAME_STYLE}</style></head>
<body>${body}<script>${FRAME_SCRIPT}</script></body></html>`;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on content only
  }, [contentKey]);

  const postState = useCallback(() => {
    const { selectedId, canvas } = useCanvasStore.getState();
    iframeRef.current?.contentWindow?.postMessage(
      {
        type: "state",
        selectedId,
        lockedIds: canvas.components.filter((c) => c.locked).map((c) => c.id),
      },
      "*", // iframe is an opaque origin; the payload is just ids
    );
  }, []);

  // Push selection/lock changes into the iframe without reloading it.
  useEffect(() => useCanvasStore.subscribe(postState), [postState]);

  // Handle messages from the iframe: only trust our own iframe's window.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== iframeRef.current?.contentWindow) return;
      const data = e.data as { type?: string; id?: unknown } | null;
      if (data?.type === "ready") postState();
      else if (data?.type === "select") {
        useCanvasStore.getState().selectComponent(typeof data.id === "string" ? data.id : null);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [postState]);

  return (
    <iframe
      ref={iframeRef}
      title="Canvas preview"
      sandbox="allow-scripts"
      srcDoc={srcDoc}
      className={`w-full rounded-lg border border-zinc-200 bg-white ${className}`}
    />
  );
}
