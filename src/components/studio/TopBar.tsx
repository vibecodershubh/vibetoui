"use client";

import { useState } from "react";
import { DEVICES } from "@/lib/devices";
import { buildDocument } from "@/lib/export";
import { PRESETS, presetOfDesignSystem } from "@/lib/presets";
import { useCanvasStore } from "@/lib/store";
import { useGenerateStore } from "@/store/generate";
import { useStudioStore } from "@/store/studio";
import { MenuItem, Popover, secondaryButton } from "./Popover";
import { Segmented } from "./Segmented";
import { StatusIndicator } from "./StatusIndicator";

const DEVICE_OPTIONS = DEVICES.map((d) => ({ value: d.id, label: d.label }));
const THEME_OPTIONS = [
  { value: "light" as const, label: "Light" },
  { value: "dark" as const, label: "Dark" },
];

function currentDocument() {
  const { canvas } = useCanvasStore.getState();
  const title = canvas.metadata.intent?.goal.trim().slice(0, 60) || undefined;
  return buildDocument(canvas.components, canvas.designSystem, { frame: false, title });
}

function ExportMenu({ disabled }: { disabled: boolean }) {
  const [note, setNote] = useState<string | null>(null);
  const flash = (text: string) => {
    setNote(text);
    window.setTimeout(() => setNote(null), 2000);
  };

  return (
    <div className="flex items-center gap-2">
      <span role="status" className="text-xs text-stone">
        {note}
      </span>
      <Popover label="Export" trigger="Export" disabled={disabled}>
        {(close) => (
          <>
            <MenuItem
              onSelect={() => {
                const url = URL.createObjectURL(new Blob([currentDocument()], { type: "text/html" }));
                const a = document.createElement("a");
                a.href = url;
                a.download = "index.html";
                a.click();
                URL.revokeObjectURL(url);
                close();
                flash("Downloaded");
              }}
            >
              Download index.html
            </MenuItem>
            <MenuItem
              onSelect={async () => {
                try {
                  await navigator.clipboard.writeText(currentDocument());
                  flash("Copied");
                } catch {
                  flash("Copy blocked by the browser");
                }
                close();
              }}
            >
              Copy HTML
            </MenuItem>
          </>
        )}
      </Popover>
    </div>
  );
}

export function TopBar() {
  const { device, setDevice, theme, setTheme, presetId, setPreset, rightOpen, setRightOpen, historyOpen, setHistoryOpen } =
    useStudioStore();
  const designSystem = useCanvasStore((s) => s.canvas.designSystem);
  const status = useGenerateStore((s) => s.status);
  const pageReady = status === "done" || status === "error";
  // After undo/restore the page may be in a different direction than the last one picked: trust the page.
  const preset =
    (pageReady ? presetOfDesignSystem(designSystem) : undefined) ?? PRESETS.find((p) => p.id === presetId) ?? PRESETS[0];

  return (
    <header className="flex min-h-14 shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-paper px-4 py-2">
      <span className="font-serif text-2xl leading-none text-ink">Vibe to UI</span>
      <StatusIndicator />

      <div className="mx-auto">
        <Segmented label="Device" value={device} options={DEVICE_OPTIONS} onChange={setDevice} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Popover label="Direction" trigger={<>Direction: {preset.name}</>}>
          {(close) =>
            PRESETS.map((p) => (
              <MenuItem
                key={p.id}
                role="menuitemradio"
                checked={p.id === preset.id}
                onSelect={() => {
                  setPreset(p.id, { applyToPage: pageReady });
                  close();
                }}
              >
                {p.name}
              </MenuItem>
            ))
          }
        </Popover>
        <Segmented label="Theme" value={theme} options={THEME_OPTIONS} onChange={setTheme} />
        <ExportMenu disabled={!pageReady} />
        <button
          type="button"
          id="history-toggle"
          aria-expanded={historyOpen}
          aria-controls="history-drawer"
          disabled={!pageReady}
          onClick={() => setHistoryOpen(!historyOpen)}
          className={secondaryButton}
        >
          History
        </button>
        <button
          type="button"
          aria-expanded={rightOpen}
          aria-controls="right-panel"
          onClick={() => setRightOpen(!rightOpen)}
          className={secondaryButton}
        >
          Panel
        </button>
      </div>
    </header>
  );
}
