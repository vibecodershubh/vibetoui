import {
  InterviewOutputSchema,
  InterviewRequestSchema,
  INTERVIEW_SYSTEM,
  buildInterviewPrompt,
  demoInterview,
  fallbackInterview,
  finalizeInterview,
} from "@/lib/interview";
import { createAnthropicComplete, generateValidated } from "@/lib/llm";

export const maxDuration = 60;

/**
 * POST /api/interview  { messages, intent }  ->  { nextQuestion, options, intentUpdate, confidence, intent, done }
 *
 * Guided intake only: it maintains the brief and asks the next question. It never generates UI.
 * The stop rules (confidence >= 0.8, at most 6 questions) are enforced here, not left to the model.
 * Every non-400 outcome is HTTP 200 and usable: if the model is unavailable the interview just ends
 * (`done: true, fallback: true`) so the user can still generate from what we have.
 */
export async function POST(request: Request) {
  const parsed = InterviewRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid request: expected { messages, intent }." }, { status: 400 });
  }
  const req = parsed.data;

  if (process.env.DEMO_MODE === "true") {
    return Response.json({ ...finalizeInterview(demoInterview(req), req), demo: true });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("[interview] ANTHROPIC_API_KEY is not set");
    return Response.json(
      fallbackInterview(req, "ANTHROPIC_API_KEY is not set. Add it to .env.local or set DEMO_MODE=true."),
    );
  }

  const result = await generateValidated({
    // The interview is a small, latency-sensitive call: allow a faster model than generation.
    complete: createAnthropicComplete({ model: process.env.ANTHROPIC_INTERVIEW_MODEL || undefined, maxTokens: 2000 }),
    system: INTERVIEW_SYSTEM,
    user: buildInterviewPrompt(req),
    schema: InterviewOutputSchema,
    fallback: () => ({ nextQuestion: null, options: [], intentUpdate: {}, confidence: req.intent.confidence }),
    label: "interview",
  });

  if (result.fallback) {
    return Response.json(fallbackInterview(req, result.error ?? "Couldn't reach the interviewer."));
  }
  return Response.json(finalizeInterview(result.data, req));
}
