// Helpers for cleaning model output before it reaches the preview iframe.

/** Remove ```html ... ``` style markdown fences the model sometimes adds. */
export function stripFences(text: string): string {
  const fenced = text.match(/```(?:html)?\s*([\s\S]*?)```/i);
  return (fenced ? fenced[1] : text).trim();
}

/**
 * Strip <script> tags, inline event handlers, and external URLs.
 * Regex-based on purpose: the iframe sandbox is the real boundary, this just
 * keeps generated snippets self-contained and inert.
 */
export function sanitizeHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<script[^>]*\/?>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\b(href|src|action|srcset|poster)\s*=\s*("|')\s*(https?:|\/\/|javascript:)[^"']*\2/gi, '$1=$2#$2')
    .replace(/url\(\s*(["']?)\s*(https?:|\/\/)[^)]*\)/gi, "none");
}
