import { describe, expect, it } from "vitest";
import { loadDemo } from "./demo";
import { sanitizeHtml } from "./html";

describe("demo outputs", () => {
  it("pass the output schema and are unchanged by the sanitizer", () => {
    for (const target of ["landing page", "pricing page"]) {
      const components = loadDemo(target);
      expect(components.length).toBeGreaterThanOrEqual(3);
      for (const c of components) expect(sanitizeHtml(c.html)).toBe(c.html);
    }
  });
});
