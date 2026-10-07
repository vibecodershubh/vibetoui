"use client";

import type { ReactNode } from "react";
import { getDevice } from "@/lib/devices";
import { useStudioStore } from "@/store/studio";

/**
 * The frame around the preview. Desktop is a slim window; tablet and mobile get a rounded hairline bezel.
 * Its width follows the device switcher, so the page inside really reflows at that width.
 */
export function DeviceFrame({ children }: { children: ReactNode }) {
  const device = useStudioStore((s) => s.device);
  const { id, width, label } = getDevice(device);
  const desktop = id === "desktop";

  return (
    <div className="flex h-full items-start justify-center overflow-auto p-4 sm:p-8">
      <div
        style={{ width: width ?? "100%", maxWidth: "100%", transition: "width 200ms ease" }}
        className={`flex h-full min-h-[320px] flex-col overflow-hidden bg-panel ${
          desktop ? "rounded-card border border-line" : "rounded-[28px] border-[8px] border-line"
        }`}
      >
        {desktop && (
          <div className="flex h-8 shrink-0 items-center gap-1.5 border-b border-line px-3" aria-hidden="true">
            <span className="size-2 rounded-full bg-line" />
            <span className="size-2 rounded-full bg-line" />
            <span className="size-2 rounded-full bg-line" />
            <span className="ml-3 text-xs text-stone">Preview</span>
          </div>
        )}
        <div className="min-h-0 flex-1">{children}</div>
        <span className="sr-only">{label} preview</span>
      </div>
    </div>
  );
}
