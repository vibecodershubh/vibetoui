// Sanitizer for model-generated HTML. The sandboxed iframe is the real security boundary;
// this keeps generated snippets inert and self-contained (CLAUDE.md: strip scripts + external URLs).
//
// Regex tokenizer, not a full HTML parser, so it is deliberately conservative: it rebuilds every
// tag from an allow-decision per attribute, and escapes any "<" it could not parse as a complete tag
// (an unterminated tag would otherwise swallow the wrapper element's closing ">" in CanvasFrame).

/** Elements removed together with their contents. */
const REMOVE_BLOCKS = ["script", "style", "iframe", "frame", "frameset", "object", "embed", "applet", "noscript", "template"];
/** Elements whose tags are dropped (they have no useful content to keep). */
const DROP_TAGS = new Set([...REMOVE_BLOCKS, "link", "meta", "base", "param", "source", "track"]);

const URL_ATTRS = new Set([
  "href", "src", "action", "formaction", "poster", "background", "xlink:href", "data", "ping", "manifest",
]);
const ALWAYS_DROP_ATTRS = new Set(["srcset", "srcdoc"]);

const TAG_RE = /<(\/?)([a-zA-Z][a-zA-Z0-9:-]*)((?:"[^"]*"|'[^']*'|[^'">])*)>/g;
const ATTR_RE = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;

const NAMED_ENTITIES: Record<string, string> = {
  colon: ":", tab: "\t", newline: "\n", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
};

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);?/gi, (_, h: string) => safeFromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);?/g, (_, d: string) => safeFromCodePoint(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, n: string) => NAMED_ENTITIES[n.toLowerCase()] ?? m);
}

function safeFromCodePoint(n: number): string {
  return Number.isFinite(n) && n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : "";
}

const escapeAttr = (v: string) =>
  v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Escape "<" that starts something tag-like but was not consumed as a complete tag. */
const escapeStray = (t: string) => t.replace(/<(?=[a-zA-Z/!?])/g, "&lt;");

function removeBlocks(html: string): string {
  let s = html;
  for (const name of REMOVE_BLOCKS) {
    // up to the closing tag, or to the end of input if it is never closed
    s = s.replace(new RegExp(`<${name}(?=[\\s/>])[\\s\\S]*?(?:</${name}\\s*>|$)`, "gi"), "");
  }
  return s;
}

function keepAttribute(tag: string, name: string, rawValue: string): string | null {
  if (name.startsWith("on") || ALWAYS_DROP_ATTRS.has(name)) return null;
  const value = decodeEntities(rawValue);

  if (name === "style") {
    if (/expression\s*\(|javascript:/i.test(value)) return null;
    // neutralise url(...) unless it is an inline image
    return value.replace(/url\(\s*(?!["']?\s*data:image\/)[^)]*\)/gi, "none");
  }

  if (URL_ATTRS.has(name)) {
    const normalized = value.replace(/[\u0000- \u007f-\u009f]/g, "").toLowerCase();
    const scheme = normalized.match(/^([a-z][a-z0-9+.-]*):/)?.[1];
    if (tag === "a" && (name === "href" || name === "xlink:href")) {
      // anchors may point anywhere, except at script-capable schemes
      return scheme === "javascript" || scheme === "vbscript" || scheme === "data" ? "#" : value.trim();
    }
    const internal = normalized.startsWith("#") || normalized.startsWith("data:image/") || (!scheme && !normalized.startsWith("//"));
    return internal ? value.trim() : null;
  }

  return value;
}

function sanitizeTag(closing: boolean, rawName: string, rawAttrs: string): string {
  const tag = rawName.toLowerCase();
  if (DROP_TAGS.has(tag)) return "";
  if (closing) return `</${tag}>`;

  let attrs = "";
  for (const m of rawAttrs.matchAll(ATTR_RE)) {
    const name = m[1].toLowerCase();
    const raw = m[2] ?? m[3] ?? m[4];
    if (raw === undefined) {
      if (!name.startsWith("on") && !URL_ATTRS.has(name) && !ALWAYS_DROP_ATTRS.has(name)) attrs += ` ${name}`;
      continue;
    }
    const kept = keepAttribute(tag, name, raw);
    if (kept !== null) attrs += ` ${name}="${escapeAttr(kept)}"`;
  }
  const selfClosing = /\/\s*$/.test(rawAttrs) ? " /" : "";
  return `<${tag}${attrs}${selfClosing}>`;
}

/**
 * Remove scripts and other active content, on* handlers, and external resources.
 * - Removed with contents: script, style, iframe, object, embed, ...
 * - Dropped attributes: on*, srcdoc, srcset, and any src/href/etc. that is not #fragment,
 *   relative, or a data:image/ URI. Anchors (<a href>) may keep external links but never
 *   javascript:, vbscript: or data: (those become "#").
 * - url(...) in style attributes is replaced with "none" unless it is a data:image/ URI.
 * Idempotent: sanitizeHtml(sanitizeHtml(x)) === sanitizeHtml(x).
 */
export function sanitizeHtml(html: string): string {
  let s = html.replace(/<!--[\s\S]*?-->/g, "");
  for (let i = 0; i < 5; i++) {
    const before = s;
    s = removeBlocks(s);
    if (s === before) break;
  }

  let out = "";
  let last = 0;
  for (const m of s.matchAll(TAG_RE)) {
    out += escapeStray(s.slice(last, m.index));
    out += sanitizeTag(m[1] === "/", m[2], m[3]);
    last = m.index + m[0].length;
  }
  return out + escapeStray(s.slice(last));
}
