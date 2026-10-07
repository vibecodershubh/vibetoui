import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEVICES } from "./devices";
import { DENSITY_OPTIONS, RADIUS_OPTIONS, currentRadiusId, withDensity, withRadius } from "./design-controls";
import { EXAMPLE_PROMPTS } from "./examples";
import { buildDocument } from "./export";
import { PRESETS } from "./presets";
import { DesignSystemSchema, type Component } from "./schema";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

function tokens(block: RegExp): Record<string, string> {
  const body = css.match(block)?.[1] ?? "";
  return Object.fromEntries([...body.matchAll(/--([a-z-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map((m) => [m[1], m[2]]));
}
const light = tokens(/:root\s*\{([^}]*)\}/);
const dark = { ...light, ...tokens(/:root\[data-theme="dark"\]\s*\{([^}]*)\}/) };

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe("studio theme tokens", () => {
  it("matches the requested palette", () => {
    expect(light).toMatchObject({ paper: "#FAF8F5", ink: "#1C1917", stone: "#78716C", line: "#E7E2DA", accent: "#4338CA" });
  });

  it.each([
    ["light", light],
    ["dark", dark],
  ])("%s theme: text and controls meet contrast targets", (_name, t) => {
    for (const bg of [t.paper, t.panel]) {
      expect(contrast(t.ink, bg)).toBeGreaterThanOrEqual(7);
      expect(contrast(t.stone, bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t.accent, bg)).toBeGreaterThanOrEqual(4.5); // links, selected labels, focus ring
    }
    expect(contrast(t["on-accent"], t["accent-fill"])).toBeGreaterThanOrEqual(4.5); // primary button text
  });

  it("uses exactly one gradient: the loading shimmer", () => {
    expect(css.match(/gradient\(/g)).toHaveLength(1);
    expect(css).toMatch(/\.skeleton::after\s*\{[^}]*linear-gradient/);
  });
});

describe("design controls", () => {
  it("always produce a valid design system, for every preset and option", () => {
    for (const p of PRESETS) {
      for (const r of RADIUS_OPTIONS) expect(DesignSystemSchema.safeParse(withRadius(p.designSystem, r.id)).success).toBe(true);
      for (const d of DENSITY_OPTIONS) {
        const ds = withDensity(p.designSystem, d.id);
        expect(DesignSystemSchema.safeParse(ds).success).toBe(true);
        expect(ds.spacing.density).toBe(d.id);
      }
    }
  });

  it("reports the nearest radius option (presets use values like 2px)", () => {
    expect(currentRadiusId(PRESETS[0].designSystem)).toBe("sharp"); // Editorial 2px
    expect(currentRadiusId(PRESETS[2].designSystem)).toBe("round"); // Soft & Friendly 14px
    expect(currentRadiusId(withRadius(PRESETS[0].designSystem, "soft"))).toBe("soft");
  });
});

describe("export document and studio data", () => {
  const components: Component[] = [
    { id: "hero-1", type: "hero", variant: "v", locked: false, props: {}, html: '<section class="bg-bg"><h1>Hi</h1><script>alert(1)</script></section>' },
  ];

  it("builds a standalone export without editor code, and a framed preview with it", () => {
    const ds = PRESETS[0].designSystem;
    const exported = buildDocument(components, ds, { frame: false });
    expect(exported).toContain("fonts.googleapis.com");
    expect(exported).toContain("--bg:#FAF7F2");
    expect(exported).toContain("<h1>Hi</h1>");
    expect(exported).not.toMatch(/data-vui-id|alert\(1\)|vui-flash/);

    const framed = buildDocument(components, ds, { frame: true });
    expect(framed).toContain('data-vui-id="hero-1"');
    expect(framed).toContain("vui-flash");
    expect(framed).not.toContain("alert(1)");
  });

  it("has the three devices and four distinct example prompts", () => {
    expect(DEVICES.map((d) => [d.id, d.width])).toEqual([["desktop", null], ["tablet", 768], ["mobile", 390]]);
    expect(new Set(EXAMPLE_PROMPTS).size).toBe(4);
  });
});

describe("preview color scheme", () => {
  it("tells the browser a dark page is dark (scrollbars, form controls)", async () => {
    const { designSystemCss } = await import("./theme");
    const byId = (id: string) => PRESETS.find((p) => p.id === id)!.designSystem;
    expect(designSystemCss(byId("technical"))).toContain("color-scheme:dark");
    expect(designSystemCss(byId("editorial"))).toContain("color-scheme:light");
    expect(designSystemCss(byId("bold-minimal"))).toContain("color-scheme:light");
  });
});
