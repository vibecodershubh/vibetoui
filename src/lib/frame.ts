// Code that runs inside the sandboxed preview iframe. Kept out of the React component so the exported
// document and the live preview are built from the same pieces.

export const TAILWIND_CDN = "https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4";

// Editor chrome inside the frame (hover, selection, lock badge, change flash). Uses the studio accent.
export const FRAME_STYLE = `
[data-vui-id]{position:relative;cursor:pointer}
[data-vui-id]:hover{outline:2px dashed rgba(67,56,202,.6);outline-offset:-2px}
[data-vui-id][data-vui-selected]{outline:2px solid #4338CA;outline-offset:-2px}
[data-vui-id][data-vui-selected]::before{content:attr(data-vui-type);position:absolute;top:0;left:0;z-index:2147483000;pointer-events:none;
  background:#4338CA;color:#fff;font:500 11px/1 Inter,system-ui,sans-serif;padding:4px 8px;border-bottom-right-radius:8px;text-transform:capitalize}
[data-vui-id][data-vui-locked]::after{content:"Locked";position:absolute;top:0;right:0;z-index:2147483000;pointer-events:none;
  background:#1C1917;color:#fff;font:500 11px/1 Inter,system-ui,sans-serif;padding:4px 8px;border-bottom-left-radius:8px}
.vui-flash{position:absolute;top:0;right:0;bottom:0;left:0;pointer-events:none;z-index:2147482999;background:rgba(67,56,202,.16);animation:vui-flash 1.2s ease-out forwards}
@keyframes vui-flash{0%{opacity:1}100%{opacity:0}}
@media (prefers-reduced-motion:reduce){.vui-flash{animation:none;opacity:.5}}
`;

// Hover highlight is pure CSS; the script reports clicks and the selected component's position to the
// parent, and applies state / content swaps the parent sends.
export const FRAME_SCRIPT = `
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
        // selected from outside (sidebar, Duplicate, Undo): bring it into view if it is mostly offscreen
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
  document.addEventListener('keydown',function(e){
    if((e.metaKey||e.ctrlKey)&&!e.shiftKey&&!e.altKey&&(e.key==='z'||e.key==='Z')){
      e.preventDefault();
      window.parent.postMessage({type:'undo'},'*');
    }
  });
  window.addEventListener('scroll',report,{passive:true});
  window.addEventListener('resize',report);
  if(window.ResizeObserver){ new ResizeObserver(report).observe(document.body); }
  window.parent.postMessage({type:'ready'},'*');
})();
`;

export const escapeAttr = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
