import { formatHtml, stripEditorAttributes } from "./format";
import { escapeAttr, FRAME_SCRIPT, FRAME_STYLE, TAILWIND_CDN } from "./frame";
import { sanitizeHtml } from "./html";
import type { Component, DesignSystem } from "./schema";
import { designSystemCss, designSystemCssPretty, fontsHref, TAILWIND_THEME } from "./theme";

const indent = (text: string, spaces: number) =>
  text
    .split("\n")
    .map((line) => (line ? " ".repeat(spaces) + line : line))
    .join("\n");

/** A section's html as it should appear in code: sanitized, editor attributes removed, pretty-printed. */
export function cleanSectionHtml(html: string): string {
  return formatHtml(stripEditorAttributes(sanitizeHtml(html)));
}

/** "hero-1" / "Hero" -> a safe comment label (no "--" that could end the comment early). */
const commentLabel = (type: string) => type.replace(/[^a-z0-9 ]/gi, " ").replace(/\s+/g, " ").trim() || "section";

/**
 * One full HTML document for the canvas.
 * - `frame: true`  -> the live preview: each section wrapped in a `data-vui-id` element + the editor script.
 * - `frame: false` -> the export (index.html): readable, indented, no editor attributes or code. Standalone:
 *   it loads Tailwind (CDN) and the fonts, and defines the design-system CSS variables.
 * Section html is sanitized either way.
 */
export function buildDocument(
  components: Component[],
  designSystem: DesignSystem,
  { frame, title = "Untitled page" }: { frame: boolean; title?: string },
): string {
  if (frame) {
    const body = components
      .map((c) => `<div data-vui-id="${escapeAttr(c.id)}" data-vui-type="${escapeAttr(c.type)}">${sanitizeHtml(c.html)}</div>`)
      .join("\n");
    return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeAttr(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" /><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="${fontsHref(designSystem)}" />
<style>${designSystemCss(designSystem)}</style>
<script src="${TAILWIND_CDN}"></script>
<style type="text/tailwindcss">${TAILWIND_THEME}</style>
<style>${FRAME_STYLE}</style></head>
<body>${body}<script>${FRAME_SCRIPT}</script></body></html>`;
  }

  const sections = components.map((c) => `<!-- ${commentLabel(c.type)} -->\n${cleanSectionHtml(c.html)}`).join("\n\n");
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeAttr(title)}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="${fontsHref(designSystem)}" />
    <style>
${indent(designSystemCssPretty(designSystem), 6)}
    </style>
    <script src="${TAILWIND_CDN}"></script>
    <style type="text/tailwindcss">
${indent(TAILWIND_THEME.trim(), 6)}
    </style>
  </head>
  <body>
${indent(sections, 4)}
  </body>
</html>
`;
}
