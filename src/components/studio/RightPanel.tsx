"use client";

import { useState } from "react";
import {
  DENSITY_OPTIONS,
  RADIUS_OPTIONS,
  currentDensityId,
  currentRadiusId,
  withDensity,
  withRadius,
  type DensityId,
  type RadiusId,
} from "@/lib/design-controls";
import { PRESETS } from "@/lib/presets";
import { useCanvasStore } from "@/lib/store";
import { useGenerateStore } from "@/store/generate";
import { useStudioStore, type RightTab } from "@/store/studio";
import { secondaryButton } from "./Popover";
import { Segmented } from "./Segmented";

const TAB_OPTIONS: { value: RightTab; label: string }[] = [
  { value: "design", label: "Design" },
  { value: "code", label: "Code" },
];
const RADIUS_CHOICES = RADIUS_OPTIONS.map((o) => ({ value: o.id, label: o.label }));
const DENSITY_CHOICES = DENSITY_OPTIONS.map((o) => ({ value: o.id, label: o.label }));

const sectionTitle = "text-xs font-medium uppercase tracking-wide text-stone";

function DesignTab() {
  const { presetId, setPreset } = useStudioStore();
  const designSystem = useCanvasStore((s) => s.canvas.designSystem);
  const status = useGenerateStore((s) => s.status);
  const pageReady = status === "done" || status === "error";

  const apply = (next: typeof designSystem) => {
    const { canvas, setCanvas } = useCanvasStore.getState();
    setCanvas({ ...canvas, designSystem: next });
  };
  const swatches = Object.entries(designSystem.color);

  return (
    <div className="grid gap-6">
      <section aria-labelledby="dir-title" className="grid gap-2">
        <h2 id="dir-title" className={sectionTitle}>
          Direction
        </h2>
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={p.id === presetId}
            onClick={() => setPreset(p.id, { applyToPage: pageReady })}
            className={`rounded-card border p-3 text-left transition-colors duration-150 ${
              p.id === presetId ? "border-accent bg-accent-soft" : "border-line bg-panel hover:border-stone"
            }`}
          >
            <span className="flex items-center justify-between gap-3">
              <span className="font-serif text-lg text-ink">{p.name}</span>
              <span className="flex gap-1" aria-hidden="true">
                {[p.designSystem.color.bg, p.designSystem.color.surface, p.designSystem.color.ink, p.designSystem.color.accent].map(
                  (c, i) => (
                    <span key={i} style={{ background: c }} className="size-3.5 rounded-[4px] border border-line" />
                  ),
                )}
              </span>
            </span>
            <span className="mt-1 block text-xs leading-relaxed text-stone">{p.direction}</span>
          </button>
        ))}
      </section>

      <section aria-labelledby="shape-title" className="grid gap-3">
        <h2 id="shape-title" className={sectionTitle}>
          Shape and space
        </h2>
        <div className="grid gap-1.5">
          <span className="text-sm text-ink">Corner radius</span>
          <Segmented
            label="Corner radius"
            value={currentRadiusId(designSystem)}
            options={RADIUS_CHOICES}
            disabled={!pageReady}
            onChange={(id: RadiusId) => apply(withRadius(designSystem, id))}
          />
        </div>
        <div className="grid gap-1.5">
          <span className="text-sm text-ink">Density</span>
          <Segmented
            label="Density"
            value={currentDensityId(designSystem)}
            options={DENSITY_CHOICES}
            disabled={!pageReady}
            onChange={(id: DensityId) => apply(withDensity(designSystem, id))}
          />
        </div>
        {!pageReady && <p className="text-xs text-stone">Generate a page to adjust radius and density.</p>}
      </section>

      <section aria-labelledby="tokens-title" className="grid gap-2">
        <h2 id="tokens-title" className={sectionTitle}>
          Palette and type
        </h2>
        <ul className="grid grid-cols-3 gap-2">
          {swatches.map(([name, hex]) => (
            <li key={name} className="grid gap-1">
              <span style={{ background: hex }} className="h-9 rounded-control border border-line" />
              <span className="text-xs text-ink">{name}</span>
              <span className="font-mono text-[11px] text-stone">{hex}</span>
            </li>
          ))}
        </ul>
        <p className="text-sm text-ink">
          {designSystem.typography.headingFont}
          <span className="text-stone"> for headings, </span>
          {designSystem.typography.bodyFont}
          <span className="text-stone"> for text</span>
        </p>
      </section>
    </div>
  );
}

function CodeTab() {
  const components = useCanvasStore((s) => s.canvas.components);
  const selectedId = useCanvasStore((s) => s.selectedId);
  const status = useGenerateStore((s) => s.status);
  const [note, setNote] = useState<string | null>(null);

  if (status !== "done" && status !== "error") {
    return <p className="text-sm text-stone">Nothing to show yet. Generate a page to see its code.</p>;
  }
  const selected = components.find((c) => c.id === selectedId);
  const code = selected ? selected.html : components.map((c) => c.html).join("\n\n");

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-ink">{selected ? `Section: ${selected.id}` : "Whole page"}</span>
        <div className="flex items-center gap-2">
          <span role="status" className="text-xs text-stone">
            {note}
          </span>
          <button
            type="button"
            className={secondaryButton}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(code);
                setNote("Copied");
              } catch {
                setNote("Copy blocked");
              }
              window.setTimeout(() => setNote(null), 2000);
            }}
          >
            Copy
          </button>
        </div>
      </div>
      {!selected && <p className="text-xs text-stone">Select a section in the preview to see only its code.</p>}
      <pre
        tabIndex={0}
        aria-label="HTML source"
        className="max-h-[60vh] overflow-auto rounded-control border border-line bg-paper p-3 font-mono text-xs leading-relaxed text-ink"
      >
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function RightPanel() {
  const tab = useStudioStore((s) => s.rightTab);
  const setTab = useStudioStore((s) => s.setRightTab);

  return (
    <div className="w-80 p-4">
      <div className="mb-4">
        <Segmented label="Panel view" value={tab} options={TAB_OPTIONS} onChange={setTab} />
      </div>
      {tab === "design" ? <DesignTab /> : <CodeTab />}
    </div>
  );
}
