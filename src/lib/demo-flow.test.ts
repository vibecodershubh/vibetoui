import { afterEach, describe, expect, it } from "vitest";
import { DEMO_HEADER } from "./demo-header";
import { findSavedPatch, isDemoRequest, loadDemo } from "./demo";
import { sanitizeHtml } from "./html";
import { PatchError, applyPatch, demoPatch, patchOutputSchema } from "./patch";
import { GeneratedComponentSchema, type Component } from "./schema";

const IDEA = "A hero for an enterprise AI security product";
const asComponents = () => loadDemo("Landing page", IDEA).map((c): Component => ({ ...c, locked: false }));
const req = (headers: Record<string, string> = {}) => new Request("http://test/api/x", { headers });

describe("the saved demo flow: hero for an enterprise AI security product", () => {
  it("is picked for the security idea (and the other demos still work)", () => {
    expect(loadDemo("Landing page", IDEA).map((c) => c.id)).toEqual(["navbar-1", "hero-1", "features-1"]);
    expect(loadDemo("Landing page", IDEA)[1].html).toContain("Every model call, inspected");
    expect(loadDemo("Pricing page", "a pricing block for a design tool")[1].id).toBe("pricing-header-1");
    expect(loadDemo("Landing page", "a coffee subscription")[1].html).toContain("coffee you can taste");
  });

  it("step 1 to 4: editorial patch, lock the hero, then the feature section, with the hero untouched", () => {
    const page = asComponents();
    const [navbar, hero, features] = page;

    // 2. "make it more editorial and reduce visual noise" -> the saved editorial hero
    const savedHero = findSavedPatch(hero, "make it more editorial and reduce visual noise");
    expect(savedHero).toBeDefined();
    const patched = applyPatch(page, "hero-1", demoPatch(hero, "make it more editorial", savedHero));
    expect(patched.component.html).not.toBe(hero.html);
    expect(patched.component.html).toContain("md:grid-cols-12"); // the editorial split layout
    expect(patched.component).toMatchObject({ id: "hero-1", type: "hero", locked: false });
    expect(patched.components[0]).toBe(navbar); // nothing else moved
    expect(patched.components[2]).toBe(features);

    // 3. lock the hero: any further patch on it is refused
    const locked = patched.components.map((c) => (c.id === "hero-1" ? { ...c, locked: true } : c));
    expect(() => applyPatch(locked, "hero-1", demoPatch(locked[1], "again"))).toThrow(PatchError);

    // 4. the feature section can still be edited, and the locked hero is byte-identical afterwards
    const savedFeatures = findSavedPatch(locked[2], "make the feature section calmer and shorter");
    expect(savedFeatures).toBeDefined();
    const afterFeatures = applyPatch(locked, "features-1", demoPatch(locked[2], "calmer", savedFeatures));
    expect(afterFeatures.component.html).toContain("<ol");
    expect(afterFeatures.components[1]).toBe(locked[1]);
    expect(afterFeatures.components[1].html).toBe(patched.component.html);
    expect(afterFeatures.components[1].locked).toBe(true);
  });

  it("only applies saved patches to the AI-security page, and only for matching requests", () => {
    const coffee = loadDemo("Landing page", "a coffee subscription")[1] as unknown as Component;
    expect(findSavedPatch({ ...coffee, locked: false }, "make it more editorial")).toBeUndefined();
    const hero = asComponents()[1];
    expect(findSavedPatch(hero, "make the button bigger")).toBeUndefined(); // falls back to the generic demo edit
    const generic = demoPatch(hero, "make the button bigger");
    expect(generic.replacement.html).toContain("Edited:");
  });

  it("every saved component is valid, token-only, and unchanged by the sanitizer", () => {
    const all = [...asComponents(), findSavedPatch(asComponents()[1], "editorial")!, findSavedPatch(asComponents()[2], "x")!];
    for (const c of all) {
      expect(GeneratedComponentSchema.safeParse(c).success).toBe(true);
      expect(sanitizeHtml(c.html)).toBe(c.html);
      expect(c.html).not.toMatch(/\b(?:bg|text|border)-(?:slate|gray|zinc|red|blue|white|black)\b|#[0-9a-f]{3,6}\b|rounded-full/i);
      expect(c.props).toMatchObject({ demo: "ai-security" });
    }
    // and they survive the same validation as a live model reply
    expect(patchOutputSchema("hero-1").safeParse(findSavedPatch(asComponents()[1], "editorial")).success).toBe(true);
  });
});

describe("isDemoRequest", () => {
  const saved = process.env.DEMO_MODE;
  afterEach(() => {
    if (saved === undefined) delete process.env.DEMO_MODE;
    else process.env.DEMO_MODE = saved;
  });

  it("is on for DEMO_MODE=true or for a request carrying the demo header", () => {
    delete process.env.DEMO_MODE;
    expect(isDemoRequest(req())).toBe(false);
    expect(isDemoRequest(req({ [DEMO_HEADER]: "1" }))).toBe(true);
    expect(isDemoRequest(req({ [DEMO_HEADER]: "0" }))).toBe(false);
    process.env.DEMO_MODE = "true";
    expect(isDemoRequest(req())).toBe(true);
  });
});

describe("demo wording and pacing", () => {
  it("turns the example ideas into a natural subject for the summary card, and leaves other ideas alone", async () => {
    const { demoGoal } = await import("./interview");
    expect(demoGoal("A hero for an enterprise AI security product")).toBe("an enterprise AI security product");
    expect(demoGoal("A pricing block for a design tool")).toBe("a design tool");
    expect(demoGoal("A landing page for a coffee subscription")).toBe("a coffee subscription");
    expect(demoGoal("AI security for enterprises")).toBe("AI security for enterprises");
    expect(demoGoal("  something else entirely ")).toBe("something else entirely");
    // the security demo is still picked from the shortened goal
    expect(loadDemo("Landing page", demoGoal("A hero for an enterprise AI security product"))[1].html).toContain("Every model call");
  });

  it("pauses briefly in demo mode so loading states show, and not at all when scaled to 0", async () => {
    const { demoDelay } = await import("./demo");
    const { vi } = await import("vitest");
    const saved = process.env.DEMO_DELAY_SCALE;
    try {
      process.env.DEMO_DELAY_SCALE = "0";
      let done = false;
      void demoDelay("generate").then(() => (done = true));
      await Promise.resolve();
      await Promise.resolve();
      expect(done).toBe(true); // no timer involved

      process.env.DEMO_DELAY_SCALE = "1";
      vi.useFakeTimers();
      done = false;
      void demoDelay("generate").then(() => (done = true));
      await vi.advanceTimersByTimeAsync(1000);
      expect(done).toBe(false);
      await vi.advanceTimersByTimeAsync(500);
      expect(done).toBe(true);
    } finally {
      vi.useRealTimers();
      if (saved === undefined) delete process.env.DEMO_DELAY_SCALE;
      else process.env.DEMO_DELAY_SCALE = saved;
    }
  });
});
