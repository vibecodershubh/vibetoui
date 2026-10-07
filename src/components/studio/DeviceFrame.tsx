"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { fitScale, getDevice } from "@/lib/devices";
import { useStudioStore } from "@/store/studio";

export interface DeviceView {
  /** The page's layout width in CSS px (1280, 820 or 390). */
  width: number;
  /** How much the frame is scaled down to fit the stage (1 = actual size). */
  scale: number;
}

/**
 * The frame around the preview. Desktop is a slim window; tablet and mobile get a rounded hairline bezel.
 * The page is laid out at the device's real width and scaled down if the stage is narrower, so the
 * 1280 / 820 / 390 layouts are always the real ones. Size changes animate for 200ms.
 */
export function DeviceFrame({ children }: { children: (view: DeviceView) => ReactNode }) {
  const device = useStudioStore((s) => s.device);
  const { id, width, label } = getDevice(device);
  const desktop = id === "desktop";
  const hostRef = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState(0);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const observer = new ResizeObserver(([entry]) => setAvailable(entry.contentRect.width));
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  const chrome = desktop ? 2 : 16; // border widths
  const scale = fitScale(available - chrome, width);
  const outerWidth = Math.round(width * scale + chrome);

  return (
    <div ref={hostRef} className="flex h-full items-start justify-center overflow-auto p-4 sm:p-8">
      <div
        style={{ width: outerWidth, maxWidth: "100%", transition: "width 200ms ease" }}
        className={`flex h-full min-h-[320px] flex-col overflow-hidden bg-panel ${
          desktop ? "rounded-card border border-line" : "rounded-[28px] border-[8px] border-line"
        }`}
      >
        {desktop && (
          <div className="flex h-8 shrink-0 items-center gap-1.5 border-b border-line px-3" aria-hidden="true">
            <span className="size-2 rounded-full bg-line" />
            <span className="size-2 rounded-full bg-line" />
            <span className="size-2 rounded-full bg-line" />
            <span className="ml-3 text-xs text-stone">
              Preview · {width}px{scale < 1 ? ` · ${Math.round(scale * 100)}%` : ""}
            </span>
          </div>
        )}
        <div className="min-h-0 flex-1">{children({ width, scale })}</div>
        <span className="sr-only">
          {label} preview, {width} pixels wide
        </span>
      </div>
    </div>
  );
}
