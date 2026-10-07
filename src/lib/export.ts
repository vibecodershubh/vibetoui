import { escapeAttr, FRAME_SCRIPT, FRAME_STYLE, TAILWIND_CDN } from "./frame";
import { sanitizeHtml } from "./html";
import type { Component, DesignSystem } from "./schema";
import { designSystemCss, fontsHref, TAILWIND_THEME } from "./theme";

/**
 * One full HTML document for the canvas.
 * - `frame: true`  -> the live preview: each section wrapped in a `data-vui-id` element + the editor script.
 * - `frame: false` -> the export: plain sections, no editor code. Standalone; it loads Tailwind (CDN) and the fonts.
 * Section html is sanitized either way.
 */
export function buildDocument(
  components: Component[],
  designSystem: DesignSystem,
  { frame, title = "Vibe to UI" }: { frame: boolean; title?: string },
): string {
  const body = components
    .map((c) => {
      const html = sanitizeHtml(c.html);
      return frame ? `<div data-vui-id="${escapeAttr(c.id)}" data-vui-type="${escapeAttr(c.type)}">${html}</div>` : html;
    })
    .join("\n");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeAttr(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" /><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="${fontsHref(designSystem)}" />
<style>${designSystemCss(designSystem)}</style>
<script src="${TAILWIND_CDN}"></script>
<style type="text/tailwindcss">${TAILWIND_THEME}</style>${frame ? `\n<style>${FRAME_STYLE}</style>` : ""}</head>
<body>${body}${frame ? `<script>${FRAME_SCRIPT}</script>` : ""}</body></html>`;
}
