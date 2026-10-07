"use client";

import { EXAMPLE_PROMPTS } from "@/lib/examples";
import { useInterviewStore } from "@/store/interview";
import { useStudioStore } from "@/store/studio";

export const primaryButton =
  "rounded-control bg-accent-fill px-4 py-2.5 text-sm font-medium text-on-accent transition-colors duration-150 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40";

/** Welcome screen: one input and four example prompts. */
export function EmptyState() {
  const draft = useStudioStore((s) => s.draft);
  const setDraft = useStudioStore((s) => s.setDraft);
  const start = useInterviewStore((s) => s.start);

  return (
    <div className="mx-auto flex h-full w-full max-w-2xl flex-col justify-center px-6 py-12">
      <h1 className="font-serif text-5xl leading-[1.05] tracking-tight text-ink sm:text-6xl">
        Describe what you&apos;re making.
      </h1>
      <p className="mt-4 max-w-md text-stone">
        A rough idea is enough. I&apos;ll ask a few quick questions, then build it so you can refine one section at a time.
      </p>

      <form
        className="mt-8 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.trim()) start(draft);
        }}
      >
        <input
          value={draft}
          maxLength={1000}
          onChange={(e) => setDraft(e.target.value)}
          aria-label="Describe what you're making"
          placeholder="e.g. a landing page for a coffee subscription"
          className="min-w-0 flex-1 rounded-card border border-line bg-panel px-4 py-3 text-ink placeholder:text-stone"
        />
        <button type="submit" disabled={!draft.trim()} className={primaryButton}>
          Start
        </button>
      </form>

      <p className="mt-8 text-sm text-stone">Or start from an example</p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {EXAMPLE_PROMPTS.map((example) => (
          <li key={example}>
            <button
              type="button"
              onClick={() => start(example)}
              className="w-full rounded-card border border-line bg-panel px-4 py-3 text-left text-sm text-ink transition-colors duration-150 hover:border-stone"
            >
              {example}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
