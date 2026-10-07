import { create } from "zustand";
import {
  EMPTY_INTENT,
  InterviewResponseSchema,
  MAX_QUESTIONS,
  CONFIDENCE_TARGET,
  completeIntent,
  countQuestions,
  type ChatMessage,
} from "@/lib/interview";
import type { Intent } from "@/lib/schema";
import { useGenerateStore } from "./generate";

type Phase = "idle" | "thinking" | "asking" | "summary" | "generating" | "done";

interface InterviewState {
  phase: Phase;
  /** The visible conversation. Questions are assistant messages, answers are user messages. */
  messages: ChatMessage[];
  /** Answer chips for the current question (the UI adds "Something else"). */
  options: string[];
  intent: Intent;
  confidence: number;
  /** Set when the interviewer failed; the user can still generate from the brief we have. */
  notice: string | null;

  start: (idea: string) => Promise<void>;
  answer: (text: string) => Promise<void>;
  updateIntent: (patch: Partial<Intent>) => void;
  confirm: () => Promise<void>;
  /** Run generation again with the same brief (after a failure). */
  retry: () => Promise<void>;
  /** "Skip, just generate": generate now from whatever brief exists (an idea may be passed from the input box). */
  skip: (idea?: string) => Promise<void>;
  reset: () => void;
}

/** 0..1, roughly how close the brief is to done. */
export function progressOf(confidence: number, messages: ChatMessage[], phase: Phase): number {
  if (phase === "summary" || phase === "generating" || phase === "done") return 1;
  return Math.min(1, Math.max(confidence / CONFIDENCE_TARGET, countQuestions(messages) / MAX_QUESTIONS));
}

export const useInterviewStore = create<InterviewState>((set, get) => {
  /** One interview turn: send the conversation and brief, apply the reply. Never throws. */
  async function turn(messages: ChatMessage[], intent: Intent) {
    set({ phase: "thinking", messages, notice: null });
    try {
      const res = await fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, intent }),
      });
      const parsed = InterviewResponseSchema.safeParse(await res.json());
      if (!parsed.success) throw new Error("bad response");
      const r = parsed.data;

      if (r.nextQuestion) {
        set({
          phase: "asking",
          messages: [...messages, { role: "assistant", content: r.nextQuestion }],
          options: r.options,
          intent: r.intent,
          confidence: r.confidence,
        });
      } else {
        set({
          phase: "summary",
          options: [],
          intent: r.intent,
          confidence: r.confidence,
          notice: r.fallback ? (r.error ?? "The interviewer is unavailable.") : null,
        });
      }
    } catch {
      // Never leave the user stuck: fall through to the summary with the brief we have.
      set({ phase: "summary", options: [], notice: "Couldn't reach the interviewer, so we'll go with what we have." });
    }
  }

  async function runGeneration(intent: Intent) {
    set({ phase: "generating", intent, options: [] });
    await useGenerateStore.getState().generate(intent);
    set({ phase: "done" });
  }

  return {
    phase: "idle",
    messages: [],
    options: [],
    intent: EMPTY_INTENT,
    confidence: 0,
    notice: null,

    start: async (idea) => {
      const text = idea.trim();
      if (!text) return;
      // The first message becomes an incomplete brief: just the goal, everything else still unknown.
      const intent = { ...EMPTY_INTENT, goal: text.slice(0, 1000) };
      set({ intent, confidence: 0 });
      await turn([{ role: "user", content: text.slice(0, 1000) }], intent);
    },

    answer: async (text) => {
      const answer = text.trim();
      const { messages, intent, phase } = get();
      if (!answer || phase !== "asking") return;
      await turn([...messages, { role: "user", content: answer.slice(0, 1000) }], intent);
    },

    updateIntent: (patch) => set((s) => ({ intent: { ...s.intent, ...patch } })),

    confirm: async () => {
      if (get().phase !== "summary") return;
      await runGeneration(get().intent);
    },

    retry: async () => {
      if (get().phase !== "done") return;
      await runGeneration(get().intent);
    },

    skip: async (idea) => {
      const { phase, intent } = get();
      if (phase === "thinking" || phase === "generating") return;
      let base = intent;
      if (phase === "idle") {
        const text = (idea ?? "").trim();
        if (!text) return;
        base = { ...EMPTY_INTENT, goal: text.slice(0, 1000) };
      }
      await runGeneration(completeIntent(base));
    },

    reset: () => {
      useGenerateStore.getState().reset();
      set({ phase: "idle", messages: [], options: [], intent: EMPTY_INTENT, confidence: 0, notice: null });
    },
  };
});
