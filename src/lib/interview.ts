import { z } from "zod";
import { DEFAULT_PRESET, PRESETS } from "./presets";
import { IntentSchema, type Intent } from "./schema";

// The interview only ever produces a brief (an Intent). It never generates UI.

export const MAX_QUESTIONS = 6;
export const CONFIDENCE_TARGET = 0.8;
/** Without all four core fields the brief can't be "confident", whatever the model claims. */
const CONFIDENCE_CAP_INCOMPLETE = 0.7;

const FIELDS = ["goal", "audience", "targetUi", "visualDirection", "contentNotes"] as const;
const CORE_FIELDS = ["goal", "audience", "targetUi", "visualDirection"] as const;
type Field = (typeof FIELDS)[number];

export const ChatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(1000),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const InterviewRequestSchema = z
  .object({
    messages: z.array(ChatMessageSchema).min(1).max(40),
    intent: IntentSchema,
  })
  .strict()
  .refine(
    (r) => r.messages[0].role === "user" && r.messages[r.messages.length - 1].role === "user",
    "conversation must start and end with a user message",
  );
export type InterviewRequest = z.infer<typeof InterviewRequestSchema>;

const IntentUpdateSchema = IntentSchema.omit({ confidence: true }).partial();
export type IntentUpdate = z.infer<typeof IntentUpdateSchema>;

/** What the model returns. */
export const InterviewOutputSchema = z
  .object({
    nextQuestion: z.string().trim().min(5).max(200).nullable(),
    options: z.array(z.string().trim().min(1).max(60)).max(5).default([]),
    intentUpdate: IntentUpdateSchema.default({}),
    confidence: z.number().min(0).max(1),
  })
  .refine((o) => o.nextQuestion === null || (o.options.length >= 2 && o.options.length <= 4), {
    message: "when asking a question, options must contain 2 to 4 items",
    path: ["options"],
  })
  .refine((o) => !/[<>]/.test(JSON.stringify(o)), "output must not contain HTML or markup");
export type InterviewOutput = z.infer<typeof InterviewOutputSchema>;

/** What the route returns (and the client validates). */
export const InterviewResponseSchema = z.object({
  nextQuestion: z.string().nullable(),
  options: z.array(z.string()),
  intentUpdate: IntentUpdateSchema,
  confidence: z.number().min(0).max(1),
  /** The brief after applying intentUpdate (the client does not have to merge). */
  intent: IntentSchema,
  done: z.boolean(),
  fallback: z.boolean().optional(),
  demo: z.boolean().optional(),
  error: z.string().optional(),
});
export type InterviewResponse = z.infer<typeof InterviewResponseSchema>;

export const countQuestions = (messages: ChatMessage[]) => messages.filter((m) => m.role === "assistant").length;

export const EMPTY_INTENT: Intent = {
  goal: "",
  audience: "",
  targetUi: "",
  visualDirection: "",
  contentNotes: "",
  confidence: 0,
};

/** Fill the blanks of an unfinished brief with safe defaults (used by "Skip, just generate"). */
export function completeIntent(i: Intent): Intent {
  return {
    ...i,
    goal: i.goal || "a website",
    audience: i.audience || "general visitors",
    targetUi: i.targetUi || "Landing page",
    visualDirection: i.visualDirection || DEFAULT_PRESET.name,
  };
}

// ---------- prompt ----------

export const INTERVIEW_SYSTEM = `You are the intake interviewer for an AI UI generator. You turn a rough idea into a clear design brief by asking a few high-value questions. You NEVER generate UI, HTML, page copy or code. You only maintain the brief and ask questions.

## Each turn
1. Read the conversation and the current brief. Fold what the user just said into the brief: return intentUpdate containing the FULL new value of every field you change (omit fields you do not change).
2. Decide whether another question would materially change the design. If yes, ask exactly ONE question.
3. Report your confidence (0 to 1) that you could now design the right thing.

## Brief fields
- goal: a short phrase: what the page is for and the main action visitors should take ("book a demo for an enterprise AI security product").
- audience: who it is for, specific ("CISOs at large enterprises").
- targetUi: what to build ("Landing page", "Hero section", "Pricing page", "Dashboard").
- visualDirection: one of the visual directions below, or leave it out until known.
- contentNotes: facts, brand name, tone or constraints the user actually stated. Never invent.

## What to ask
- Ask only what would materially change the design: the audience, the main action, what is being built, the visual direction, or a key content constraint. Do not ask about things you can decide well yourself (colors, fonts, exact copy, section order). Never ask something the user already answered. Ask the biggest unknown first.
- One short, friendly sentence per question.
- Always give 2 to 4 short answer options (at most 6 words each) covering the likely answers. Do not include "Something else": the interface adds it.
- When you ask about visual direction, use exactly these option names, choosing the 2 to 4 that fit the idea best.

## Visual directions
${PRESETS.map((p) => `- ${p.name}: ${p.direction}`).join("\n")}

## Confidence
A one-line vague idea is at most 0.3. Confidence rises as goal, audience, target UI and visual direction become known and specific. Reach 0.8 or more only when all four are known. Be honest: inflated confidence produces a worse design.

## Output
Return ONLY a JSON object, no markdown and no prose:
{"nextQuestion": string | null, "options": string[], "intentUpdate": {...}, "confidence": number}
Use nextQuestion null and options [] when no further question is worth asking.`;

export function buildInterviewPrompt(req: InterviewRequest): string {
  const transcript = req.messages
    .map((m) => `${m.role === "user" ? "User" : "Interviewer"}: ${m.content}`)
    .join("\n");
  return `<conversation>
${transcript}
</conversation>

<current_brief>
${JSON.stringify(req.intent)}
</current_brief>

Questions asked so far: ${countQuestions(req.messages)} (at most ${MAX_QUESTIONS} in total).
Return the JSON now.`;
}

// ---------- deterministic rules (the server never trusts the model on these) ----------

const isSomethingElse = (s: string) => /^something else\b/i.test(s.trim());

function mergeIntent(current: Intent, update: IntentUpdate): { intent: Intent; applied: IntentUpdate } {
  const intent = { ...current };
  const applied: IntentUpdate = {};
  for (const key of FIELDS) {
    const value = update[key]?.trim();
    if (value) {
      intent[key as Field] = value;
      applied[key as Field] = value;
    }
  }
  return { intent, applied };
}

/**
 * Applies the stop rules to the model's output: stop at confidence >= 0.8 or after 6 questions,
 * cap confidence while the brief is incomplete, drop "Something else" (the UI adds it), and end
 * the interview if the model repeats itself or gives an unusable question.
 */
export function finalizeInterview(output: InterviewOutput, req: InterviewRequest): InterviewResponse {
  const asked = countQuestions(req.messages);
  const { intent: merged, applied } = mergeIntent(req.intent, output.intentUpdate);

  const complete = CORE_FIELDS.every((f) => merged[f].trim());
  const confidence = Math.min(output.confidence, complete ? 1 : CONFIDENCE_CAP_INCOMPLETE);

  const options = [...new Set(output.options.map((o) => o.trim()).filter((o) => o && !isSomethingElse(o)))].slice(0, 4);
  const question = output.nextQuestion?.trim() ?? null;
  const repeated =
    question !== null &&
    req.messages.some((m) => m.role === "assistant" && m.content.trim().toLowerCase() === question.toLowerCase());

  const done =
    question === null || options.length < 2 || repeated || confidence >= CONFIDENCE_TARGET || asked >= MAX_QUESTIONS;

  return {
    nextQuestion: done ? null : question,
    options: done ? [] : options,
    intentUpdate: applied,
    confidence,
    intent: { ...merged, confidence },
    done,
  };
}

/** Used when the model is unavailable: end the interview and keep the brief as it is. */
export function fallbackInterview(req: InterviewRequest, error: string): InterviewResponse {
  return {
    nextQuestion: null,
    options: [],
    intentUpdate: {},
    confidence: req.intent.confidence,
    intent: req.intent,
    done: true,
    fallback: true,
    error,
  };
}

// ---------- DEMO_MODE: a scripted interview, no model involved ----------

export function demoInterview(req: InterviewRequest): InterviewOutput {
  const last = req.messages[req.messages.length - 1].content;
  switch (countQuestions(req.messages)) {
    case 0:
      return {
        nextQuestion: "Who is this mainly for?",
        options: ["Developers", "Small businesses", "Enterprise buyers", "Everyday consumers"],
        intentUpdate: { goal: last },
        confidence: 0.25,
      };
    case 1:
      return {
        nextQuestion: "What are we building?",
        options: ["Landing page", "Pricing page", "Hero section"],
        intentUpdate: { audience: last },
        confidence: 0.45,
      };
    case 2:
      return {
        nextQuestion: "Which direction feels right?",
        options: PRESETS.map((p) => p.name),
        intentUpdate: { targetUi: last },
        confidence: 0.65,
      };
    default:
      return { nextQuestion: null, options: [], intentUpdate: { visualDirection: last }, confidence: 0.85 };
  }
}
