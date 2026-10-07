"use client";

import { useEffect, useRef, useState } from "react";
import { useGenerateStore } from "@/store/generate";
import { progressOf, useInterviewStore } from "@/store/interview";
import { SummaryCard } from "./SummaryCard";

const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900";

function Bubble({ role, children }: { role: "user" | "assistant"; children: React.ReactNode }) {
  return (
    <div className={role === "user" ? "flex justify-end" : "flex justify-start"}>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
          role === "user" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-900"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

export function ChatPanel() {
  const { phase, messages, options, confidence, answer, start, skip, retry, reset } = useInterviewStore();
  const failed = useGenerateStore((s) => s.status === "error");
  const [draft, setDraft] = useState("");
  const [custom, setCustom] = useState<string | null>(null); // null = "Something else" closed
  const logRef = useRef<HTMLDivElement>(null);

  const progress = progressOf(confidence, messages, phase);
  const busy = phase === "thinking" || phase === "generating";
  const canSkip = !busy && phase !== "done" && (phase !== "idle" || draft.trim().length > 0);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages, phase]);

  return (
    <section
      aria-label="Brief assistant"
      className="flex max-h-[80vh] min-h-[420px] flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white text-zinc-900 shadow-sm"
    >
      <div
        role="progressbar"
        aria-label="How close the brief is to ready"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        className="h-1 w-full bg-zinc-100"
      >
        <div className="h-full bg-zinc-900 transition-all duration-300" style={{ width: `${progress * 100}%` }} />
      </div>

      <div ref={logRef} role="log" aria-live="polite" className="flex-1 space-y-3 overflow-y-auto p-4">
        {phase === "idle" && (
          <Bubble role="assistant">
            Tell me what you want to build, even roughly. I&apos;ll ask a few quick questions to get it right.
          </Bubble>
        )}
        {messages.map((m, i) => (
          <Bubble key={i} role={m.role}>
            {m.content}
          </Bubble>
        ))}
        {phase === "thinking" && <Bubble role="assistant">Thinking…</Bubble>}
        {phase === "summary" && <SummaryCard />}
        {phase === "generating" && <Bubble role="assistant">Building your page…</Bubble>}
        {phase === "done" && (
          <>
            <Bubble role="assistant">
              {failed ? "I couldn't build that one. You can try again or start over." : "Your page is ready. Click any section to select it."}
            </Bubble>
            <div className="flex gap-4 text-sm text-zinc-600">
              {failed && (
                <button onClick={retry} className="underline underline-offset-4">
                  Try again
                </button>
              )}
              <button onClick={reset} className="underline underline-offset-4">
                Start over
              </button>
            </div>
          </>
        )}
      </div>

      {phase === "asking" && (
        <div className="border-t border-zinc-200 p-3" key={messages.length}>
          <div className="flex flex-wrap gap-2">
            {options.map((o) => (
              <button
                key={o}
                onClick={() => answer(o)}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm transition hover:border-zinc-900"
              >
                {o}
              </button>
            ))}
            <button
              onClick={() => setCustom(custom === null ? "" : null)}
              aria-expanded={custom !== null}
              className="rounded-md border border-dashed border-zinc-400 px-3 py-1.5 text-sm text-zinc-600 transition hover:border-zinc-900"
            >
              Something else
            </button>
          </div>
          {custom !== null && (
            <form
              className="mt-2 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (custom.trim()) {
                  answer(custom);
                  setCustom(null);
                }
              }}
            >
              <input
                autoFocus
                className={inputClass}
                value={custom}
                maxLength={300}
                onChange={(e) => setCustom(e.target.value)}
                placeholder="Type your own answer"
                aria-label="Your own answer"
              />
              <button type="submit" disabled={!custom.trim()} className="rounded-md bg-zinc-900 px-3 text-sm text-white disabled:opacity-40">
                Send
              </button>
            </form>
          )}
        </div>
      )}

      {phase === "idle" && (
        <form
          className="flex gap-2 border-t border-zinc-200 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (draft.trim()) start(draft);
          }}
        >
          <input
            className={inputClass}
            value={draft}
            maxLength={1000}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="e.g. a landing page for a coffee subscription"
            aria-label="Describe your idea"
          />
          <button type="submit" disabled={!draft.trim()} className="rounded-md bg-zinc-900 px-4 text-sm font-medium text-white disabled:opacity-40">
            Start
          </button>
        </form>
      )}

      <div className="border-t border-zinc-200 px-3 py-2">
        <button
          onClick={() => skip(draft)}
          disabled={!canSkip}
          className="text-sm text-zinc-600 underline underline-offset-4 disabled:no-underline disabled:opacity-40"
        >
          Skip, just generate
        </button>
      </div>
    </section>
  );
}
