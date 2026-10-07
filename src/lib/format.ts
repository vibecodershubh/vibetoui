// HTML pretty-printing and cleanup for the code panel and the exported index.html.

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
/** Contents are whitespace-sensitive or not HTML: copied through verbatim. */
const RAW = new Set(["pre", "textarea", "script", "style"]);
/** Inline-level tags: formatting around them can change rendered spacing, so they stay on one line when short. */
const INLINE = new Set([
  "a", "abbr", "b", "bdi", "bdo", "br", "button", "cite", "code", "data", "dfn", "em", "i", "img", "kbd",
  "label", "mark", "q", "s", "samp", "small", "span", "strong", "sub", "sup", "time", "u", "var", "wbr",
]);
const MAX_INLINE_LINE = 120;

type Node =
  | { kind: "text"; text: string }
  | { kind: "comment"; raw: string }
  | { kind: "el"; tag: string; open: string; close: string | null; children: Node[]; raw?: string };

const TOKEN = "<!--[\\s\\S]*?-->|<\\/?[a-zA-Z][a-zA-Z0-9:-]*(?:\"[^\"]*\"|'[^']*'|[^'\">])*>";

function parse(html: string): Node[] {
  const root: Node[] = [];
  const stack: { tag: string; children: Node[]; el: Extract<Node, { kind: "el" }> | null }[] = [{ tag: "", children: root, el: null }];
  const top = () => stack[stack.length - 1];
  const re = new RegExp(TOKEN, "g");
  let last = 0;
  let m: RegExpExecArray | null;

  const pushText = (text: string) => {
    if (text.trim()) top().children.push({ kind: "text", text });
  };

  while ((m = re.exec(html))) {
    pushText(html.slice(last, m.index));
    last = re.lastIndex;
    const token = m[0];

    if (token.startsWith("<!--")) {
      top().children.push({ kind: "comment", raw: token });
    } else if (token.startsWith("</")) {
      const tag = token.slice(2).replace(/[\s>][\s\S]*$/, "").toLowerCase();
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i].tag === tag) {
          stack[i].el!.close = `</${tag}>`;
          stack.length = i;
          break;
        }
      }
    } else {
      const tag = /^<([a-zA-Z][a-zA-Z0-9:-]*)/.exec(token)![1].toLowerCase();
      const el: Extract<Node, { kind: "el" }> = { kind: "el", tag, open: normalizeTag(token), close: null, children: [] };
      top().children.push(el);
      if (VOID.has(tag) || token.endsWith("/>")) continue;
      if (RAW.has(tag)) {
        const end = html.toLowerCase().indexOf(`</${tag}`, last);
        const closeEnd = end === -1 ? -1 : html.indexOf(">", end);
        el.raw = html.slice(last, end === -1 ? html.length : end);
        el.close = `</${tag}>`;
        last = re.lastIndex = closeEnd === -1 ? html.length : closeEnd + 1;
        continue;
      }
      stack.push({ tag, children: el.children, el });
    }
  }
  pushText(html.slice(last));
  return root;
}

const collapse = (s: string) => s.replace(/\s+/g, " ");

/** Single spaces between attributes, none before ">", quoted values untouched. */
const normalizeTag = (token: string) =>
  token.replace(/("[^"]*"|'[^']*')|(\s+)/g, (_m, quoted: string | undefined) => quoted ?? " ").replace(/ >$/, ">");

/** The whole subtree on one line (whitespace runs collapsed to a single space, never removed). */
function compact(node: Node): string {
  if (node.kind === "text") return collapse(node.text);
  if (node.kind === "comment") return node.raw;
  if (node.raw !== undefined) return node.open + node.raw + (node.close ?? "");
  return node.open + node.children.map(compact).join("") + (node.close ?? "");
}

function render(node: Node, depth: number, out: string[]) {
  const pad = "  ".repeat(depth);
  if (node.kind === "text") return void out.push(pad + collapse(node.text).trim());
  if (node.kind === "comment") return void out.push(pad + node.raw);
  if (node.raw !== undefined) return void out.push(pad + node.open + node.raw + (node.close ?? ""));
  if (node.close === null && node.children.length === 0) return void out.push(pad + node.open);
  if (node.children.length === 0) return void out.push(pad + node.open + node.close);

  const hasText = node.children.some((c) => c.kind === "text");
  const inlineOnly = node.children.every((c) => c.kind === "el" && INLINE.has(c.tag));
  // Text mixed with tags is an inline formatting context: re-flowing it could change spacing.
  if (hasText || (inlineOnly && pad.length + compact(node).length <= MAX_INLINE_LINE)) {
    return void out.push(pad + compact(node));
  }
  out.push(pad + node.open);
  for (const child of node.children) render(child, depth + 1, out);
  if (node.close) out.push(pad + node.close);
}

/**
 * Indents HTML two spaces per level. Text and inline markup are kept on one line so rendering does not
 * change. Idempotent: formatting formatted html returns it unchanged.
 */
export function formatHtml(html: string, baseDepth = 0): string {
  const out: string[] = [];
  for (const node of parse(html)) render(node, baseDepth, out);
  return out.join("\n");
}

/** Removes the editor's data-vui-* attributes (and nothing else) from html. */
export function stripEditorAttributes(html: string): string {
  return html.replace(/\s+data-vui-[\w-]*(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?/gi, "");
}
