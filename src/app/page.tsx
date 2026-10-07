"use client";

import { useState } from "react";
import { CanvasFrame } from "@/components/CanvasFrame";
import { useGenerateStore } from "@/store/generate";

export default function Home() {
  const [idea, setIdea] = useState("");
  const { status, error, generate } = useGenerateStore();
  const loading = status === "loading";

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Vibe To UI</h1>

      <form
        className="flex gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!loading && idea.trim()) generate(idea);
        }}
      >
        <input
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          placeholder="Describe your idea, e.g. a landing page for a coffee subscription"
          className="flex-1 rounded-lg border border-zinc-300 px-4 py-2 outline-none focus:border-zinc-900"
        />
        <button
          type="submit"
          disabled={loading || !idea.trim()}
          className="rounded-lg bg-zinc-900 px-5 py-2 font-medium text-white disabled:opacity-50"
        >
          {loading ? "Generating…" : "Generate"}
        </button>
      </form>

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <CanvasFrame className="h-[75vh]" />
    </main>
  );
}
