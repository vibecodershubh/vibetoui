import { beforeEach, describe, expect, it } from "vitest";
import { PatchError, applyPatch, demoPatch, patchOutputSchema } from "./patch";
import { seedCanvas } from "./seed";
import type { Canvas, Component } from "./schema";
import { useCanvasStore } from "./store";

const comp = (id: string, html: string, extra: Partial<Component> = {}): Component => ({
  id,
  type: id.replace(/-\d+$/, ""),
  variant: "v",
  html,
  props: { copy: id },
  locked: false,
  ...extra,
});

// B and C contain characters that would expose any re-serialization: unicode, entities, odd spacing.
const A = comp("hero-1", '<section class="bg-bg"><h1>Original A</h1></section>');
const B = comp("features-1", '<section class="bg-surface">  B  &amp;  “quotes” é\n\t<p class="text-muted">keep me</p></section>');
const C = comp("cta-1", '<section class="bg-accent"><a href="#">C — call</a></section>');
const canvas = (): Component[] => [A, B, C];

const aPrime = { id: "hero-1", type: "hero", variant: "editorial", html: '<section class="bg-bg"><h1>Edited A</h1></section>', props: {} };

describe("applyPatch: patching A leaves B and C byte-identical", () => {
  it("replaces only the target even when the model also returns altered B and C", () => {
    const reply = [
      aPrime,
      { ...B, html: "<section>HIJACKED B</section>" },
      { id: "Not A Valid Id!", html: "garbage that is never validated" },
    ];
    const output = patchOutputSchema("hero-1").parse(reply);
    const before = JSON.stringify(canvas());

    const result = applyPatch(canvas(), "hero-1", output);

    expect(result.components[0].html).toContain("Edited A");
    // same objects, so same bytes
    expect(result.components[1]).toBe(B);
    expect(result.components[2]).toBe(C);
    expect(result.components[1].html).toBe(B.html);
    expect(result.components[2].html).toBe(C.html);
    expect(JSON.stringify(result.components.slice(1))).toBe(JSON.stringify([B, C]));
    expect(result.discarded).toEqual(["features-1", "Not A Valid Id!"]);
    expect(JSON.stringify(canvas())).toBe(before); // inputs were not mutated either
    expect(result.components.map((c) => c.id)).toEqual(["hero-1", "features-1", "cta-1"]);
  });

  it("forces id, type and lock state, and sanitizes html", () => {
    const sneaky = { ...aPrime, id: "something-else", type: "footer", locked: true, html: '<section onclick="x()"><script>alert(1)</script><h1>Hi there friend</h1></section>' };
    const output = patchOutputSchema("hero-1").parse(sneaky); // single element with another id is taken as the replacement
    const { component } = applyPatch(canvas(), "hero-1", output);
    expect(component).toMatchObject({ id: "hero-1", type: "hero", locked: false });
    expect(component.html).not.toMatch(/onclick|<script|alert/);
  });

  it("rejects a locked or missing target, and a reply with no matching id among several", () => {
    const output = patchOutputSchema("hero-1").parse(aPrime);
    expect(() => applyPatch([comp("hero-1", A.html, { locked: true }), B, C], "hero-1", output)).toThrow(PatchError);
    expect(() => applyPatch(canvas(), "nope-1", output)).toThrow(PatchError);
    const two = [{ ...B }, { ...C }];
    expect(patchOutputSchema("hero-1").safeParse(two).success).toBe(false);
    expect(patchOutputSchema("hero-1").safeParse({ id: "hero-1", html: "" }).success).toBe(false); // invalid target html
  });

  it("demo patch changes only the target and passes the same pipeline", () => {
    const result = applyPatch(canvas(), "hero-1", demoPatch(A, 'make it "bolder" <b>now</b>'));
    expect(result.component.html).toContain("Edited:");
    expect(result.component.html).not.toContain("<b>now</b>"); // request text is escaped
    expect(result.components[1]).toBe(B);
    expect(result.components[2]).toBe(C);
  });
});

describe("store: replaceComponent / duplicateComponent / undo", () => {
  const fresh = (): Canvas => ({ ...seedCanvas, components: canvas() });
  beforeEach(() => useCanvasStore.setState({ canvas: fresh(), selectedId: null, history: [] }));

  it("replacing A leaves B and C byte-identical, refuses a locked A, and undo restores", () => {
    const { replaceComponent, toggleLock, undo } = useCanvasStore.getState();
    expect(replaceComponent("hero-1", { ...A, html: '<section class="bg-bg"><h1>New</h1></section>' })).toEqual({ ok: true });
    let { components } = useCanvasStore.getState().canvas;
    expect(components[0].html).toContain("New");
    expect(components[1]).toBe(B);
    expect(components[2]).toBe(C);
    expect(useCanvasStore.getState().history).toHaveLength(1); // snapshot pushed before the change

    toggleLock("hero-1");
    const lockedHtml = useCanvasStore.getState().canvas.components[0].html;
    expect(replaceComponent("hero-1", { ...A, html: "<section>x</section>" })).toEqual({ ok: false, reason: "locked" });
    expect(useCanvasStore.getState().canvas.components[0].html).toBe(lockedHtml);
    expect(useCanvasStore.getState().history).toHaveLength(1); // a rejected patch pushes nothing

    undo();
    components = useCanvasStore.getState().canvas.components;
    expect(components[0].html).toBe(A.html);
    expect(components[1].html).toBe(B.html);
    expect(components[2].html).toBe(C.html);
  });

  it("duplicate inserts an unlocked copy with a fresh id right after the original", () => {
    useCanvasStore.getState().toggleLock("features-1");
    const id = useCanvasStore.getState().duplicateComponent("features-1");
    const { components } = useCanvasStore.getState().canvas;
    expect(id).toBe("features-2");
    expect(components.map((c) => c.id)).toEqual(["hero-1", "features-1", "features-2", "cta-1"]);
    expect(components[2]).toMatchObject({ locked: false, html: B.html });
    expect(useCanvasStore.getState().duplicateComponent("features-1")).toBe("features-3");
    expect(useCanvasStore.getState().duplicateComponent("missing")).toBeNull();
  });
});
