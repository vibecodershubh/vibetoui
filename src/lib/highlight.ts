export type TokenKind = "tag" | "attr" | "value" | "punct" | "comment" | "text";
export interface Token {
  text: string;
  kind: TokenKind;
}

const MAX_CHARS = 120_000; // beyond this, skip highlighting rather than render tens of thousands of spans

/**
 * Splits html into tokens for syntax highlighting. Pure and text-only: the UI renders each token as a
 * React text node inside a span, so nothing here is ever injected as markup.
 */
export function highlightHtml(code: string): Token[] {
  if (code.length > MAX_CHARS) return [{ text: code, kind: "text" }];

  const tokens: Token[] = [];
  const push = (text: string, kind: TokenKind) => text && tokens.push({ text, kind });
  const re = /(<!--[\s\S]*?-->)|(<\/?)([a-zA-Z][\w:-]*)((?:"[^"]*"|'[^']*'|[^'">])*?)(\/?>)|([^<]+|<)/g;

  for (const m of code.matchAll(re)) {
    if (m[1]) {
      push(m[1], "comment");
    } else if (m[3]) {
      push(m[2], "punct");
      push(m[3], "tag");
      for (const a of m[4].matchAll(/(\s+)|([^\s=]+)(\s*=\s*)?("[^"]*"|'[^']*'|[^\s"']+)?/g)) {
        if (a[1]) push(a[1], "text");
        else {
          push(a[2], "attr");
          if (a[3]) push(a[3], "punct");
          if (a[4]) push(a[4], "value");
        }
      }
      push(m[5], "punct");
    } else {
      push(m[6], "text");
    }
  }
  return tokens;
}
