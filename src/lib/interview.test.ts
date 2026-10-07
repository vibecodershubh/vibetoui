import { describe, expect, it } from "vitest";
import {
  EMPTY_INTENT,
  InterviewOutputSchema,
  InterviewRequestSchema,
  completeIntent,
  demoInterview,
  finalizeInterview,
  type ChatMessage,
  type InterviewOutput,
  type InterviewRequest,
} from "./interview";
import type { Intent } from "./schema";

const FULL: Intent = {
  goal: "book a demo for an AI security product",
  audience: "CISOs",
  targetUi: "Hero section",
  visualDirection: "Editorial",
  contentNotes: "",
  confidence: 0.5,
};
const req = (messages: ChatMessage[], intent: Intent = EMPTY_INTENT): InterviewRequest => ({ messages, intent });
const ask = (n: number): ChatMessage[] =>
  Array.from({ length: n }, (_, i) => [
    { role: "assistant" as const, content: `Question number ${i}?` },
    { role: "user" as const, content: `answer ${i}` },
  ]).flat();
const out = (o: Partial<InterviewOutput>): InterviewOutput => ({
  nextQuestion: "Who is this for?",
  options: ["Developers", "Consumers"],
  intentUpdate: {},
  confidence: 0.4,
  ...o,
});

describe("finalizeInterview stop rules", () => {
  it("keeps asking while confidence is low, merging the update and dropping 'Something else'", () => {
    const r = finalizeInterview(
      out({ intentUpdate: { audience: " CISOs " }, options: ["A", "Something else", "B", "A"] }),
      req([{ role: "user", content: "idea" }]),
    );
    expect(r.done).toBe(false);
    expect(r.nextQuestion).toBe("Who is this for?");
    expect(r.options).toEqual(["A", "B"]);
    expect(r.intent.audience).toBe("CISOs");
    expect(r.intentUpdate).toEqual({ audience: "CISOs" });
  });

  it("stops at confidence >= 0.8 and after 6 questions", () => {
    const high = finalizeInterview(out({ confidence: 0.85 }), req([{ role: "user", content: "x" }], FULL));
    expect(high).toMatchObject({ done: true, nextQuestion: null, options: [] });

    const sixth = finalizeInterview(out({ confidence: 0.3 }), req(ask(6), FULL));
    expect(sixth.done).toBe(true); // 6 assistant questions already asked
    const fifth = finalizeInterview(out({ confidence: 0.3 }), req(ask(5), FULL));
    expect(fifth.done).toBe(false);
  });

  it("does not trust an inflated confidence while a core field is still unknown", () => {
    const r = finalizeInterview(out({ confidence: 0.95 }), req([{ role: "user", content: "idea" }], { ...FULL, audience: "" }));
    expect(r.confidence).toBeLessThan(0.8);
    expect(r.done).toBe(false);
  });

  it("ends the interview on a repeated or unusable question instead of looping", () => {
    const repeated = finalizeInterview(
      out({ nextQuestion: "question number 0?" }),
      req(ask(1)),
    );
    expect(repeated.done).toBe(true);
    const tooFewOptions = finalizeInterview(out({ options: ["Only one", "Something else"] }), req([{ role: "user", content: "x" }]));
    expect(tooFewOptions.done).toBe(true);
  });
});

describe("interview schemas", () => {
  it("rejects model output that contains markup or a wrong number of options", () => {
    expect(InterviewOutputSchema.safeParse({ nextQuestion: "Want <b>bold</b>?", options: ["a", "b"], confidence: 0.2 }).success).toBe(false);
    expect(InterviewOutputSchema.safeParse({ nextQuestion: "Who is it for?", options: ["only"], confidence: 0.2 }).success).toBe(false);
    expect(InterviewOutputSchema.safeParse({ nextQuestion: null, options: [], confidence: 0.9 }).success).toBe(true);
  });

  it("requires a conversation that starts and ends with the user and rejects unknown keys", () => {
    const base = { intent: EMPTY_INTENT };
    expect(InterviewRequestSchema.safeParse({ ...base, messages: [{ role: "user", content: "hi" }] }).success).toBe(true);
    expect(InterviewRequestSchema.safeParse({ ...base, messages: [{ role: "assistant", content: "hi" }] }).success).toBe(false);
    expect(InterviewRequestSchema.safeParse({ ...base, messages: [{ role: "user", content: "hi" }], extra: 1 }).success).toBe(false);
  });
});

describe("scripted demo interview", () => {
  it("walks to a complete brief in 3 questions with 2-4 chips each", () => {
    let intent = EMPTY_INTENT;
    let messages: ChatMessage[] = [{ role: "user", content: "AI security for enterprises" }];
    let questions = 0;
    for (let guard = 0; guard < 8; guard++) {
      const r = finalizeInterview(demoInterview(req(messages, intent)), req(messages, intent));
      intent = r.intent;
      if (r.done) break;
      questions++;
      expect(r.options.length).toBeGreaterThanOrEqual(2);
      expect(r.options.length).toBeLessThanOrEqual(4);
      messages = [...messages, { role: "assistant", content: r.nextQuestion! }, { role: "user", content: r.options[0] }];
    }
    expect(questions).toBe(3);
    expect(intent.confidence).toBeGreaterThanOrEqual(0.8);
    expect(intent.goal).toBe("AI security for enterprises");
    expect(completeIntent(intent)).toEqual(intent); // nothing left to default
  });
});
