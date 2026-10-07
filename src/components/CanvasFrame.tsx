"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sanitizeHtml } from "@/lib/html";
import { useCanvasStore } from "@/lib/store";
import { designSystemCss, fontsHref, TAILWIND_THEME } from "@/lib/theme";
import { ComponentToolbar, type FrameRect } from "./ComponentToolbar";

const TAILWIND_CDN = "https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4";

// Runs inside the sandboxed iframe. Hover highlight is pure CSS; the script reports clicks and the
// selected component's position to the parent, and applies state / content swaps the parent sends.
const FRAME_STYLE = `
[data-vui-id]{position:relative;cursor:pointer}
[data-vui-id]:hover{outline:2px dashed rgba(99,102,241,.7);outline-offset:-2px}
[data-vui-id][data-vui-selected]{outline:2px solid #4f46e5;outline-offset:-2px}
[data-vui-id][data-vui-selected]::before{content:attr(data-vui-type);position:absolute;top:0;left:0;z-index:2147483000;pointer-events:none;
  background:#4f46e5;color:#fff;font:600 11px/1 system-ui,sans-serif;padding:4px 8px;border-bottom-right-radius:6px;text-transform:capitalize}
[data-vui-id][data-vui-locked]::after{content:"\\1F512  Locked";position:absolute;top:0;right:0;z-index:2147483000;pointer-events:none;
  background:#1e293b;color:#fff;font:600 11px/1 system-ui,sans-serif;padding:4px 8px;border-bottom-left-radius:6px}
.vui-flash{position:absolute;top:0;right:0;bottom:0;left:0;pointer-events:none;z-index:2147482999;background:rgba(79,70,229,.18);animation:vui-flash 1.2s ease-out forwards}
@keyframes vui-flash{0%{opacity:1}100%{opacity:0}}
@media (prefers-reduced-motion:reduce){.vui-flash{animation:none;opacity:.5}}
`;

const FRAME_SCRIPT = `
(function(){
  var selectedId=null, locked=[], raf=0;
  function byId(id){
    var all=document.querySelectorAll('[data-vui-id]');
    for(var i=0;i<all.length;i++){ if(all[i].getAttribute('data-vui-id')===id) return all[i]; }
    return null;
  }
  function apply(){
    document.querySelectorAll('[data-vui-id]').forEach(function(el){
      var id=el.getAttribute('data-vui-id');
      el.toggleAttribute('data-vui-selected', id===selectedId);
      el.toggleAttribute('data-vui-locked', locked.indexOf(id)!==-1);
    });
  }
  function report(){
    if(raf) return;
    raf=requestAnimationFrame(function(){
      raf=0;
      var el=document.querySelector('[data-vui-selected]');
      if(!el){ window.parent.postMessage({type:'rect',id:null},'*'); return; }
      var r=el.getBoundingClientRect();
      window.parent.postMessage({type:'rect',id:el.getAttribute('data-vui-id'),top:r.top,left:r.left,width:r.width,height:r.height,vw:window.innerWidth,vh:window.innerHeight},'*');
    });
  }
  function flash(el){
    var old=el.querySelector(':scope > .vui-flash'); if(old) old.remove();
    var o=document.createElement('div'); o.className='vui-flash'; el.appendChild(o);
    setTimeout(function(){ o.remove(); }, 1300);
  }
  window.addEventListener('message',function(e){
    var d=e.data;
    if(e.source!==window.parent||!d) return;
    if(d.type==='state'){
      var changed=selectedId!==d.selectedId;
      selectedId=d.selectedId; locked=d.lockedIds||[]; apply();
      if(changed&&selectedId){
        // selected from outside (sidebar, Duplicate, Undo): bring it into view if it is fully offscreen
        var sel=byId(selectedId);
        if(sel){
          var r0=sel.getBoundingClientRect();
          var visible=Math.min(r0.bottom,window.innerHeight)-Math.max(r0.top,0);
          if(visible<Math.min(120,r0.height*0.5)){ sel.scrollIntoView({block:r0.height>window.innerHeight*0.8?'start':'center',behavior:'smooth'}); }
        }
      }
      report();
    }
    else if(d.type==='replace'){
      var el=byId(d.id);
      if(el){ el.innerHTML=d.html; flash(el); report(); }
    }
  });
  document.addEventListener('click',function(e){
    e.preventDefault();
    var el=e.target.closest&&e.target.closest('[data-vui-id]');
    window.parent.postMessage({type:'select',id:el?el.getAttribute('data-vui-id'):null},'*');
  },true);
  window.addEventListener('scroll',report,{passive:true});
  window.addEventListener('resize',report);
  if(window.ResizeObserver){ new ResizeObserver(report).observe(document.body); }
  window.parent.postMessage({type:'ready'},'*');
})();
`;

const escapeAttr = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

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
  const { srcDoc, snapshot } = useMemo(() => {
    const body = components
      .map(
        (c) =>
          `<div data-vui-id="${escapeAttr(c.id)}" data-vui-type="${escapeAttr(c.type)}">${sanitizeHtml(c.html)}</div>`,
      )
      .join("\n");
    const srcDoc = `<!doctype html>
<html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<link rel="preconnect" href="https://fonts.googleapis.com" /><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="${fontsHref(designSystem)}" />
<style>${designSystemCss(designSystem)}</style>
<script src="${TAILWIND_CDN}"></script>
<style type="text/tailwindcss">${TAILWIND_THEME}</style>
<style>${FRAME_STYLE}</style></head>
<body>${body}<script>${FRAME_SCRIPT}</script></body></html>`;
    return { srcDoc, snapshot: new Map(components.map((c) => [c.id, c.html])) };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on structure only (see above)
  }, [structureKey]);

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
        title="Canvas preview"
        sandbox="allow-scripts"
        srcDoc={srcDoc}
        className="h-full w-full rounded-lg border border-zinc-200 bg-white"
      />
      {toolbar && selectedId && rect && rect.id === selectedId && <ComponentToolbar key={rect.id} rect={rect} />}
    </div>
  );
}
