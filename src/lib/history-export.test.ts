import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { fitScale } from "./devices";
import { buildDocument } from "./export";
import { formatHtml, stripEditorAttributes } from "./format";
import { highlightHtml } from "./highlight";
import { PRESETS } from "./presets";
import type { Canvas, Component } from "./schema";
import { seedCanvas } from "./seed";
import { isEditableTarget, isUndoShortcut } from "./shortcuts";
import { useCanvasStore } from "./store";

const text = (html: string) => html.replace(/<[^>]*>/g, "").replace(/\s+/g, "");

describe("formatHtml", () => {
  const messy = `<section class="a"><div   class="b"><h1>Title</h1><p>Hello <b>big</b> world, <a href="#">link</a>.</p><ul><li>One</li><li>Two</li></ul><img src="x.png" alt=""><br></div></section>`;

  it("indents blocks, keeps text with its inline markup on one line, and never changes the text", () => {
    const out = formatHtml(messy);
    expect(out.split("\n")).toEqual([
      '<section class="a">',
      '  <div class="b">',
      "    <h1>Title</h1>",
      '    <p>Hello <b>big</b> world, <a href="#">link</a>.</p>',
      "    <ul>",
      "      <li>One</li>",
      "      <li>Two</li>",
      "    </ul>",
      '    <img src="x.png" alt="">',
      "    <br>",
      "  </div>",
      "</section>",
    ]);
    expect(text(out)).toBe(text(messy));
  });

  it("is idempotent and leaves pre/textarea contents alone", () => {
    const once = formatHtml(messy);
    expect(formatHtml(once)).toBe(once);
    const pre = '<div><pre>  a\n    b  </pre></div>';
    expect(formatHtml(pre)).toContain("<pre>  a\n    b  </pre>");
  });

  it("removes data-vui-* attributes and only those", () => {
    const dirty = '<div data-vui-id="hero-1" data-vui-selected class="x" data-vui-type=\'hero\' data-keep="1"><p data-vui-locked>hi</p></div>';
    expect(stripEditorAttributes(dirty)).toBe('<div class="x" data-keep="1"><p>hi</p></div>');
  });
});

describe("highlightHtml", () => {
  it("classifies tags, attributes, values, comments and text", () => {
    const tokens = highlightHtml('<!-- note --><a href="#x" disabled>Go</a>');
    const kinds = (kind: string) => tokens.filter((t) => t.kind === kind).map((t) => t.text);
    expect(kinds("comment")).toEqual(["<!-- note -->"]);
    expect(kinds("tag")).toEqual(["a", "a"]);
    expect(kinds("attr")).toEqual(["href", "disabled"]);
    expect(kinds("value")).toEqual(['"#x"']);
    expect(kinds("text")).toContain("Go");
    expect(tokens.map((t) => t.text).join("")).toBe('<!-- note --><a href="#x" disabled>Go</a>'); // lossless
  });
});

describe("exported index.html", () => {
  const components: Component[] = [
    {
      id: "hero-1",
      type: "hero",
      variant: "v",
      locked: false,
      props: {},
      html: '<section class="bg-bg" data-vui-id="hero-1" onclick="x()"><div class="max-w-6xl"><h1>Hi</h1><script>alert(1)</script><p>Text</p></div></section>',
    },
  ];
  const out = buildDocument(components, PRESETS[0].designSystem, { frame: false, title: "Coffee" });

  it("is a clean, indented standalone document with Tailwind, fonts and CSS variables", () => {
    expect(out.startsWith("<!doctype html>\n<html lang=\"en\">\n  <head>")).toBe(true);
    expect(out).toContain("<title>Coffee</title>");
    expect(out).toContain('<script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>');
    expect(out).toContain("fonts.googleapis.com/css2?family=Newsreader");
    expect(out).toMatch(/\n {6}:root \{\n {8}color-scheme: light;\n {8}--bg: #FAF7F2;/); // one variable per line
    expect(out).toContain("<!-- hero -->");
    expect(out).toContain('    <section class="bg-bg">\n      <div class="max-w-6xl">\n        <h1>Hi</h1>');
    expect(out.endsWith("</html>\n")).toBe(true);
  });

  it("has no editor attributes, handlers or scripts from the content", () => {
    expect(out).not.toMatch(/data-vui|onclick|alert\(1\)|vui-flash|postMessage/);
    expect(out.split("\n").every((l) => !/\s$/.test(l))).toBe(true); // no trailing whitespace
  });
});

describe("device scaling", () => {
  it("fits a wide layout into a narrow stage without ever upscaling", () => {
    expect(fitScale(640, 1280)).toBe(0.5);
    expect(fitScale(2000, 1280)).toBe(1);
    expect(fitScale(0, 1280)).toBe(1); // not measured yet
    expect(fitScale(50, 1280)).toBe(0.2); // floor
  });
});

describe("version history", () => {
  const fresh = (): Canvas => ({ ...seedCanvas, components: seedCanvas.components.map((c) => ({ ...c })) });
  const html = (id: string) => useCanvasStore.getState().canvas.components.find((c) => c.id === id)!.html;
  beforeEach(() =>
    useCanvasStore.setState({ canvas: fresh(), selectedId: null, history: [], currentLabel: "Generated page", currentAt: 1000 }),
  );

  it("records a timestamped, labeled version for every change", () => {
    const { replaceComponent, duplicateComponent } = useCanvasStore.getState();
    const hero = useCanvasStore.getState().canvas.components[1];
    replaceComponent("hero-1", { ...hero, html: "<section>one</section>" }, "Edited Hero: “one”");
    duplicateComponent("features-1");
    const s = useCanvasStore.getState();
    expect(s.history.map((v) => v.label)).toEqual(["Generated page", "Edited Hero: “one”"]);
    expect(s.history[0].at).toBe(1000);
    expect(s.history[1].at).toBeGreaterThanOrEqual(1000);
    expect(s.currentLabel).toBe("Duplicated Features");
  });

  it("undo steps back one version and restores its label and time", () => {
    const { replaceComponent, undo } = useCanvasStore.getState();
    const original = html("hero-1");
    replaceComponent("hero-1", { ...useCanvasStore.getState().canvas.components[1], html: "<section>changed</section>" });
    undo();
    const s = useCanvasStore.getState();
    expect(html("hero-1")).toBe(original);
    expect(s.history).toHaveLength(0);
    expect([s.currentLabel, s.currentAt]).toEqual(["Generated page", 1000]);
  });

  it("restoring an old version is non-destructive and can itself be undone", () => {
    const { replaceComponent } = useCanvasStore.getState();
    const original = html("hero-1");
    const edit = (n: string) =>
      replaceComponent("hero-1", { ...useCanvasStore.getState().canvas.components[1], html: `<section>${n}</section>` }, `Edit ${n}`);
    edit("A");
    edit("B");
    // history: [Generated page (original), Edit A]; current: Edit B
    const target = useCanvasStore.getState().history[0];
    expect(useCanvasStore.getState().restoreVersion(target.id)).toBe(true);

    let s = useCanvasStore.getState();
    expect(html("hero-1")).toBe(original);
    expect(s.currentLabel).toBe("Restored: Generated page");
    expect(s.history.map((v) => v.label)).toEqual(["Generated page", "Edit A", "Edit B"]); // "Edit B" state is kept

    s.undo();
    s = useCanvasStore.getState();
    expect(html("hero-1")).toBe("<section>B</section>"); // the restore was undone
    expect(useCanvasStore.getState().restoreVersion("nope")).toBe(false);
  });

  it("restore keeps the current lock flags and caps history at 50 versions", () => {
    const { replaceComponent, toggleLock, restoreVersion } = useCanvasStore.getState();
    replaceComponent("hero-1", { ...useCanvasStore.getState().canvas.components[1], html: "<section>x</section>" });
    toggleLock("navbar-1");
    restoreVersion(useCanvasStore.getState().history[0].id);
    expect(useCanvasStore.getState().canvas.components.find((c) => c.id === "navbar-1")!.locked).toBe(true);

    for (let i = 0; i < 60; i++) {
      replaceComponent("hero-1", { ...useCanvasStore.getState().canvas.components[1], html: `<section>${i}</section>` });
    }
    expect(useCanvasStore.getState().history).toHaveLength(50);
  });
});

describe("undo shortcut", () => {
  const key = (over: object) => ({ key: "z", metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, ...over });

  it("matches Cmd+Z and Ctrl+Z only (not redo, not bare z)", () => {
    expect(isUndoShortcut(key({ metaKey: true }))).toBe(true);
    expect(isUndoShortcut(key({ ctrlKey: true, key: "Z" }))).toBe(true);
    expect(isUndoShortcut(key({ ctrlKey: true, shiftKey: true }))).toBe(false);
    expect(isUndoShortcut(key({}))).toBe(false);
    expect(isUndoShortcut(key({ ctrlKey: true, key: "y" }))).toBe(false);
  });

  it("leaves text fields to the browser", () => {
    const el = (closest: boolean) => ({ closest: () => (closest ? {} : null) }) as unknown as EventTarget;
    expect(isEditableTarget(el(true))).toBe(true);
    expect(isEditableTarget(el(false))).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });
});

describe("code highlight colors", () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const vars = (block: RegExp) =>
    Object.fromEntries([...(css.match(block)?.[1] ?? "").matchAll(/--([a-z-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map((m) => [m[1], m[2]]));
  const light = vars(/:root\s*\{([^}]*)\}/);
  const dark = { ...light, ...vars(/:root\[data-theme="dark"\]\s*\{([^}]*)\}/) };
  const lum = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrast = (a: string, b: string) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };

  it.each([
    ["light", light],
    ["dark", dark],
  ])("%s theme: tag, attribute and value colors are readable on the code background", (_n, t) => {
    for (const name of ["syn-tag", "syn-attr", "syn-value"]) expect(contrast(t[name], t.paper)).toBeGreaterThanOrEqual(4.5);
  });
});
