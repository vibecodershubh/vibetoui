import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CanvasBoundary, CanvasCrash } from "./CanvasBoundary";

describe("CanvasBoundary", () => {
  it("renders its children when nothing has gone wrong", () => {
    expect(renderToStaticMarkup(<CanvasBoundary><p>the preview</p></CanvasBoundary>)).toBe("<p>the preview</p>");
  });

  it("turns a render error into state (that is what makes React show the fallback instead of a blank page)", () => {
    const error = new Error("boom");
    expect(CanvasBoundary.getDerivedStateFromError(error)).toEqual({ error });
  });

  it("shows a calm, actionable fallback: reload, undo (only when possible), start over", () => {
    const noop = () => {};
    const withUndo = renderToStaticMarkup(<CanvasCrash onReload={noop} onUndo={noop} onStartOver={noop} />);
    expect(withUndo).toContain('role="alert"');
    expect(withUndo).toContain("The preview hit a problem.");
    expect(withUndo).toContain("Your work is safe");
    for (const label of ["Reload preview", "Undo last change", "Start over"]) expect(withUndo).toContain(label);

    const withoutUndo = renderToStaticMarkup(<CanvasCrash onReload={noop} onStartOver={noop} />);
    expect(withoutUndo).not.toContain("Undo last change");
  });
});
