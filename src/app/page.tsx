"use client";

import { CanvasFrame } from "@/components/CanvasFrame";
import { ChatPanel } from "@/components/ChatPanel";
import { useGenerateStore } from "@/store/generate";

export default function Home() {
  const { status, error } = useGenerateStore();
  const showCanvas = status === "done" || status === "error";

  return (
    <main className="mx-auto grid w-full max-w-7xl flex-1 content-start gap-6 px-4 py-8 lg:grid-cols-[380px_1fr]">
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Vibe To UI</h1>
        <ChatPanel />
      </div>

      <div className="flex flex-col gap-3">
        {error && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}
        {showCanvas ? (
          <CanvasFrame className="h-[80vh]" />
        ) : (
          <div className="flex h-[80vh] items-center justify-center rounded-lg border border-dashed border-zinc-400 text-sm text-zinc-500">
            {status === "loading" ? "Building your page…" : "Your page will appear here."}
          </div>
        )}
      </div>
    </main>
  );
}
