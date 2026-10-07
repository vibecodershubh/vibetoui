"use client";

import { useGenerateStore } from "@/store/generate";
import { useInterviewStore } from "@/store/interview";
import { CanvasFrame } from "../CanvasFrame";
import { CanvasBoundary } from "./CanvasBoundary";
import { DeviceFrame } from "./DeviceFrame";
import { EmptyState } from "./EmptyState";
import { PageSkeleton } from "./Skeleton";

export type Stage = "empty" | "briefing" | "generating" | "ready";

/** Which of the four center states we are in. A page is only "ready" once it has been generated. */
export function useStage(): Stage {
  const phase = useInterviewStore((s) => s.phase);
  const status = useGenerateStore((s) => s.status);
  if (status === "loading" || phase === "generating") return "generating";
  if (status === "done" || status === "error") return "ready";
  if (phase === "thinking" || phase === "asking" || phase === "summary") return "briefing";
  return "empty";
}

/** The center of the studio: welcome, brief in progress, skeleton, or the page in its device frame. */
export function CenterStage({ className = "" }: { className?: string }) {
  const stage = useStage();

  return (
    <main
      id="main"
      tabIndex={-1}
      aria-busy={stage === "generating"}
      className={`canvas-backdrop min-h-0 min-w-0 overflow-hidden ${className}`}
    >
      {stage === "empty" && <EmptyState />}
      {stage === "briefing" && (
        <div className="mx-auto flex h-full max-w-md flex-col justify-center px-6 text-center">
          <h2 className="font-serif text-4xl text-ink">Getting the brief right.</h2>
          <p className="mt-3 text-stone">Answer a few quick questions on the left. Nothing is built until you confirm.</p>
        </div>
      )}
      {(stage === "generating" || stage === "ready") && (
        <CanvasBoundary>
          <DeviceFrame>
            {({ width, scale }) =>
              stage === "generating" ? <PageSkeleton /> : <CanvasFrame className="h-full" width={width} scale={scale} />
            }
          </DeviceFrame>
        </CanvasBoundary>
      )}
    </main>
  );
}
