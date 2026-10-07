"use client";

import { useEffect, useRef, useState } from "react";
import { useGenerateStore } from "@/store/generate";
import { progressOf, useInterviewStore } from "@/store/interview";
import { useStudioStore } from "@/store/studio";
import { SummaryCard } from "./SummaryCard";
import { primaryButton } from "./studio/EmptyState";
import { secondaryButton } from "./studio/Popover";

function Message({ role, children }: { role: "user" | "assistant"; children: React.ReactNode }) {
  return role === "user" ? (
    <div className="flex justify-end">
      <p className="max-w-[88%] rounded-card bg-line px-3 py-2 text-sm text-ink">{children}</p>
    </div>
  ) : (
    <p className="max-w-[92%] text-sm leading-relaxed text-ink">{children}</p>
  );
}

const chip =
  "rounded-control border border-line bg-panel px-3 py-1.5 text-sm text-ink transition-colors duration-150 hover:border-ink";

export function ChatPanel() {
  const { phase, messages, options, confidence, answer, skip, retry, reset } = useInterviewStore();
  const draft = useStudioStore((s) => s.draft);
  const failed = useGenerateStore((s) => s.status === "error");
  const [custom, setCustom] = useState<string | null>(null); // null = "Something else" closed
  const logRef = useRef<HTMLDivElement>(null);

  const progress = progressOf(confidence, messages, phase);
  const busy = phase === "thinking" || phase === "generating";
  const canSkip = !busy && phase !== "done" && (phase !== "idle" || draft.trim().length > 0);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages, phase]);

  return (
    <section aria-label="Conversation" className="flex h-full min-h-[360px] flex-col">
      <div className="flex items-baseline justify-between px-4 pb-3 pt-4">
        <h2 className="font-serif text-xl text-ink">Conversation</h2>
        <span className="text-xs text-stone">{phase === "idle" ? "Not started" : `${Math.round(progress * 100)}% clear`}</span>
      </div>
      <div
        role="progressbar"
        aria-label="How close the brief is to ready"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        className="mx-4 h-0.5 rounded-full bg-line"
      >
        <div className="h-full rounded-full bg-ink transition-all duration-200" style={{ width: `${progress * 100}%` }} />
      </div>

      <div ref={logRef} role="log" aria-live="polite" className="flex-1 space-y-3 overflow-y-auto p-4">
        {phase === "idle" && (
          <Message role="assistant">
            Describe what you&apos;re making in the middle of the screen. I&apos;ll ask a few quick questions here so the first
            result is close.
          </Message>
        )}
        {messages.map((m, i) => (
          <Message key={i} role={m.role}>
            {m.content}
          </Message>
        ))}
        {phase === "thinking" && <p className="text-sm text-stone">Thinking…</p>}
        {phase === "summary" && <SummaryCard />}
        {phase === "generating" && <p className="text-sm text-stone">Building your page…</p>}
        {phase === "done" && (
          <>
            <Message role="assistant">
              {failed
                ? "I couldn't build that one. You can try again or start over."
                : "Your page is ready. Click any section to select it and describe a change."}
            </Message>
            <div className="flex gap-2">
              {failed && (
                <>
                  <button type="button" onClick={retry} className={secondaryButton}>
                    Try again
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      useStudioStore.getState().setDemo(true);
                      retry();
                    }}
                    className={secondaryButton}
                  >
                    Use demo data
                  </button>
                </>
              )}
              <button type="button" onClick={reset} className={secondaryButton}>
                Start over
              </button>
            </div>
          </>
        )}
      </div>

      {phase === "asking" && (
        <div className="border-t border-line p-4" key={messages.length}>
          <div className="flex flex-wrap gap-2">
            {options.map((o) => (
              <button key={o} type="button" onClick={() => answer(o)} className={chip}>
                {o}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setCustom(custom === null ? "" : null)}
              aria-expanded={custom !== null}
              className={`${chip} border-dashed text-stone`}
            >
              Something else
            </button>
          </div>
          {custom !== null && (
            <form
              className="mt-3 flex gap-2"
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
                value={custom}
                maxLength={300}
                onChange={(e) => setCustom(e.target.value)}
                placeholder="Type your own answer"
                aria-label="Your own answer"
                className="min-w-0 flex-1 rounded-control border border-line bg-panel px-3 py-2 text-sm text-ink placeholder:text-stone"
              />
              <button type="submit" disabled={!custom.trim()} className={primaryButton}>
                Send
              </button>
            </form>
          )}
        </div>
      )}

      <div className="border-t border-line px-4 py-3">
        <button
          type="button"
          onClick={() => skip(draft)}
          disabled={!canSkip}
          className="text-sm text-stone underline underline-offset-4 transition-colors duration-150 hover:text-ink disabled:no-underline disabled:opacity-40"
        >
          Skip, just generate
        </button>
      </div>
    </section>
  );
}
