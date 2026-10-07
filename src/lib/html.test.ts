import { describe, expect, it } from "vitest";
import { sanitizeHtml } from "./html";

describe("sanitizeHtml", () => {
  it("removes scripts, active elements, on* handlers and external resources", () => {
    const dirty = `<div class="p-4" onclick="x()"><script>alert(1)</script><style>@import url(http://e.com/a.css)</style>
      <iframe src="https://e.com"></iframe><link rel="stylesheet" href="https://e.com/a.css">
      <img src="https://e.com/a.png" alt="a" onerror="x()"><img/src=x/onerror=alert(1)>
      <img src="data:image/png;base64,AAAA" alt="ok"><div style="background:url(https://e.com/b.png);color:red">t</div>
      <a href="https://example.com/docs" class="link">docs</a></div>`;
    const out = sanitizeHtml(dirty);
    expect(out).not.toMatch(/<script|<style|<iframe|<link|e\.com\/a\.png|e\.com\/b\.png|alert\(1\)<\/script/i);
    // no event-handler attribute survives. (`<img/src=x/onerror=...>` is one src value in a real
    // browser too, so "onerror" may remain as inert text inside it.)
    expect(out).not.toMatch(/[\s"']on[a-z]+\s*=/i);
    expect(out).toContain('class="p-4"'); // normal attributes survive
    expect(out).toContain('src="data:image/png;base64,AAAA"'); // data: images are allowed
    expect(out).toContain('href="https://example.com/docs"'); // anchors may link out
    expect(out).toContain("color:red"); // harmless inline styles survive
    expect(sanitizeHtml(out)).toBe(out); // idempotent: runs on the server and again in CanvasFrame
  });

  it("blocks script schemes on anchors, including entity-obfuscated ones", () => {
    const out = sanitizeHtml(
      `<a href="javascript:alert(1)">a</a><a href="jav&#x61;script:alert(1)">b</a><a href=" &#106;avascript&colon;alert(1)">c</a><a href="data:text/html,<b>x</b>">d</a><a href="#top">e</a><a href="mailto:hi@example.com">f</a>`,
    );
    expect(out).not.toMatch(/javascript|alert|data:text/i);
    expect(out).toContain('href="#top"');
    expect(out).toContain('href="mailto:hi@example.com"');
  });

  it("neutralises an unterminated tag so it cannot swallow the wrapper's closing bracket", () => {
    const out = sanitizeHtml(`<p>ok</p><img src=x onerror=alert(1)`);
    expect(out).not.toContain("<img");
    expect(`<div>${out}</div>`).not.toMatch(/<img/);
  });
});
