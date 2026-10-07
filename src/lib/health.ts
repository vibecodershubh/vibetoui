import { getAi, getModel, missingGeminiConfig, redactSecrets } from "./gemini";
import { toLlmError } from "./llm";

export type HealthReason = "missing_config" | "auth" | "model_not_found" | "rate_limited" | "timeout" | "unavailable";

/** What /api/health returns. Nothing here is derived from the key, and no provider error text is passed through. */
export interface Health {
  ok: boolean;
  reason?: HealthReason;
  /** A fixed, human-readable sentence for `reason` (variable NAMES only, never values). */
  message?: string;
  demo?: boolean;
}

const MESSAGES: Record<HealthReason, string> = {
  missing_config: "Gemini is not configured.",
  auth: "The Gemini API key was rejected. Check GEMINI_API_KEY.",
  model_not_found: "The Gemini model was not found. Check GEMINI_MODEL.",
  rate_limited: "Rate limited by the Gemini API.",
  timeout: "The Gemini API did not answer in time.",
  unavailable: "Couldn't get a response from the Gemini API.",
};

const TIMEOUT_MS = 10_000;
const TTL_MS = 15_000; // each uncached check is a real (tiny) API call, so repeated hits are served from memory
let cache: { at: number; value: Health } | null = null;

export const resetHealthCache = () => {
  cache = null;
};

function reasonOf(err: unknown): HealthReason {
  const e = toLlmError(err);
  if (e.message.startsWith("auth")) return "auth";
  if (e.message.startsWith("model not found")) return "model_not_found";
  if (e.message.startsWith("rate limited")) return "rate_limited";
  if (e.message === "aborted" || e.message === "timeout") return "timeout";
  return "unavailable";
}

const fail = (reason: HealthReason): Health => ({
  ok: false,
  reason,
  message: reason === "missing_config" ? (missingGeminiConfig() ?? MESSAGES[reason]) : MESSAGES[reason],
});

/** One trivial Gemini call. Returns only ok/reason: never the key, never raw provider messages. */
export async function checkHealth(now = Date.now()): Promise<Health> {
  if (process.env.DEMO_MODE === "true") return { ok: true, demo: true }; // demo mode makes no API calls
  if (missingGeminiConfig()) return fail("missing_config");
  if (cache && now - cache.at < TTL_MS) return cache.value;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let value: Health;
  try {
    await getAi().models.generateContent({
      model: getModel(),
      contents: "Reply with the single word: ok",
      config: { maxOutputTokens: 256, temperature: 0, abortSignal: controller.signal },
    });
    value = { ok: true };
  } catch (err) {
    const reason = controller.signal.aborted ? "timeout" : reasonOf(err);
    console.error(`[health] gemini check failed: ${reason}`, redactSecrets(err instanceof Error ? err.message : ""));
    value = fail(reason);
  } finally {
    clearTimeout(timer);
  }
  cache = { at: now, value };
  return value;
}
