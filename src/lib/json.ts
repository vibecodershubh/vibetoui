/** Remove ```json ... ``` style markdown fences the model sometimes wraps output in. */
export function stripFences(text: string): string {
  const fenced = text.match(/```[a-zA-Z]*\s*([\s\S]*?)```/);
  return (fenced ? fenced[1] : text).trim();
}

/**
 * Best-effort repair of model-written JSON. Fixes the failures models actually produce:
 * markdown fences, prose before/after the value, trailing commas, and raw newlines/tabs
 * inside strings (very common when a string holds HTML).
 *
 * It deliberately does NOT close unterminated brackets: truncated output must fail to parse
 * (and trigger a retry) rather than be silently accepted as a shorter, "valid" result.
 */
export function repairJson(text: string): string {
  const s = stripFences(text);
  const start = s.search(/[[{]/);
  if (start === -1) return s.trim();

  let out = "";
  let inString = false;
  let escaped = false;
  let depth = 0;

  for (let i = start; i < s.length; i++) {
    const c = s[i];

    if (inString) {
      if (escaped) {
        out += c;
        escaped = false;
      } else if (c === "\\") {
        out += c;
        escaped = true;
      } else if (c === '"') {
        out += c;
        inString = false;
      } else if (c === "\n") out += "\\n";
      else if (c === "\r") out += "\\r";
      else if (c === "\t") out += "\\t";
      else if (c < " ") out += "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0");
      else out += c;
      continue;
    }

    if (c === '"') {
      inString = true;
      out += c;
    } else if (c === "{" || c === "[") {
      depth++;
      out += c;
    } else if (c === "}" || c === "]") {
      // drop a trailing comma before the closer
      let j = out.length - 1;
      while (j >= 0 && /\s/.test(out[j])) j--;
      if (out[j] === ",") out = out.slice(0, j) + out.slice(j + 1);
      out += c;
      depth--;
      if (depth === 0) break; // ignore anything after the top-level value
    } else {
      out += c;
    }
  }
  return out;
}

/** repairJson + JSON.parse. Throws SyntaxError if it still isn't valid JSON. */
export function parseModelJson(text: string): unknown {
  return JSON.parse(repairJson(text));
}
