import { describe, expect, it } from "vitest";
import { parseModelJson, repairJson } from "./json";

describe("repairJson", () => {
  it("fixes fences, surrounding prose, trailing commas and raw newlines in strings", () => {
    const messy = 'Sure! Here you go:\n```json\n[\n  {"id": "hero-1", "html": "<section>\n\t<h1>Hi</h1>\n</section>", "props": {"a": "b",},},\n]\n```\nHope that helps.';
    const parsed = parseModelJson(messy) as { id: string; html: string; props: { a: string } }[];
    expect(parsed).toHaveLength(1);
    expect(parsed[0].html).toBe("<section>\n\t<h1>Hi</h1>\n</section>");
    expect(parsed[0].props).toEqual({ a: "b" });
  });

  it("leaves commas, brackets and escaped quotes inside strings alone", () => {
    const tricky = '{"html": "<a href=\\"#\\">x,]</a>", "n": [1, 2,]}';
    expect(parseModelJson(tricky)).toEqual({ html: '<a href="#">x,]</a>', n: [1, 2] });
  });

  it("does not close truncated output, so it fails and triggers a retry", () => {
    expect(() => parseModelJson('[{"id": "hero-1", "html": "<section>cut')).toThrow();
    expect(() => parseModelJson('[{"id": "hero-1"},')).toThrow();
    expect(repairJson("no json here")).toBe("no json here");
  });
});
