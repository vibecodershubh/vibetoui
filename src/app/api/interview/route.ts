import { demoDelay, isDemoRequest } from "@/lib/demo";
import {
  InterviewOutputSchema,
  InterviewRequestSchema,
  INTERVIEW_SYSTEM,
  buildInterviewPrompt,
  demoInterview,
  fallbackInterview,
  finalizeInterview,
} from "@/lib/interview";
import { missingGeminiConfig } from "@/lib/gemini";
import { createGeminiComplete, generateValidated } from "@/lib/llm";

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

  if (isDemoRequest(request)) {
    await demoDelay("interview");
    return Response.json({ ...finalizeInterview(demoInterview(req), req), demo: true });
  }

  const missing = missingGeminiConfig();
  if (missing) {
    console.error(`[interview] ${missing}`);
    return Response.json(fallbackInterview(req, missing));
  }

  const result = await generateValidated({
    // The interview is a small, latency-sensitive call: allow a faster model than generation.
    complete: createGeminiComplete({ model: process.env.GEMINI_INTERVIEW_MODEL || undefined, maxOutputTokens: 8192 }),
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
