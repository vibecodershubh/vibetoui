import { ApiError } from "@google/genai";
import type { z } from "zod";
import { GeminiConfigError, getAi, getModel, outputTokenBudget, redactSecrets } from "./gemini";
import { parseModelJson } from "./json";

export interface LlmMessage {
  role: "user" | "assistant";
  content: string;
}

export interface Completion {
  text: string;
  /** True when the model stopped because it hit the output-token limit (output is incomplete). */
  truncated: boolean;
}

/** One model call. Injectable so the retry/fallback logic can be tested without the network. */
export type Complete = (req: {
  system: string;
  messages: LlmMessage[];
  signal: AbortSignal;
}) => Promise<Completion>;

/** A failure that is not about the output's shape. `retryable: false` skips the retry. */
export class LlmError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly userMessage: string,
  ) {
    super(message);
  }
}

/** The model answered, but the output wasn't usable (bad JSON, failed schema, truncated). */
class OutputError extends Error {
  constructor(
    message: string,
    /** The raw model output, echoed back on retry. Empty when it should not be echoed. */
    readonly output: string,
  ) {
    super(message);
  }
}

const MAX_OUTPUT_TOKENS = 32_768;
export const DEFAULT_TIMEOUT_MS = 25_000;
const MAX_ECHO_CHARS = 20_000;
/** Gemini finish reasons that mean the model refused or the content was blocked. */
const BLOCKED = new Set(["SAFETY", "RECITATION", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII", "IMAGE_SAFETY"]);

/** Maps any failure from the Gemini SDK to an LlmError. Messages are redacted: they may be logged. */
export function toLlmError(err: unknown): LlmError {
  if (err instanceof LlmError) return err;
  if (err instanceof GeminiConfigError) return new LlmError(err.message, false, err.message);
  if (err instanceof ApiError) {
    const detail = redactSecrets(err.message ?? "");
    // Gemini reports a bad key as 400 INVALID_ARGUMENT ("API key not valid"), as well as 401/403.
    if (err.status === 401 || err.status === 403 || (err.status === 400 && /api[_ ]key/i.test(detail))) {
      return new LlmError(`auth (${err.status})`, false, "The Gemini API key was rejected. Check GEMINI_API_KEY.");
    }
    if (err.status === 404) {
      return new LlmError("model not found", false, "The Gemini model was not found. Check GEMINI_MODEL.");
    }
    if (err.status === 400) return new LlmError(`bad request: ${detail}`, false, "The model API rejected the request.");
    if (err.status === 429) {
      return new LlmError("rate limited", true, "Rate limited by the API. Wait a moment and try again.");
    }
    return new LlmError(`api ${err.status}: ${detail}`, true, "The model API returned an error.");
  }
  if (err instanceof Error && err.name === "AbortError") {
    return new LlmError("aborted", true, "The model took too long to respond.");
  }
  const detail = redactSecrets(err instanceof Error ? err.message : String(err));
  return new LlmError(detail, true, "Couldn't reach the Gemini API.");
}

/**
 * The real model call: `ai.models.generateContent({ model, contents, config })`.
 * - config.systemInstruction carries the taste skill and system rules.
 * - config.responseMimeType = "application/json" for calls that expect JSON (the default; every route does).
 * - config.abortSignal cancels the request when the timeout fires.
 */
export function createGeminiComplete(
  opts: { model?: string; maxOutputTokens?: number; json?: boolean } = {},
): Complete {
  return async ({ system, messages, signal }) => {
    try {
      const ai = getAi();
      const model = opts.model || getModel();
      const response = await ai.models.generateContent({
        model,
        contents: messages.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        })),
        config: {
          systemInstruction: system,
          maxOutputTokens: await outputTokenBudget(model, opts.maxOutputTokens ?? MAX_OUTPUT_TOKENS),
          abortSignal: signal,
          ...(opts.json === false ? {} : { responseMimeType: "application/json" }),
        },
      });
      const reason = response.candidates?.[0]?.finishReason;
      if (response.promptFeedback?.blockReason || (reason && BLOCKED.has(String(reason)))) {
        throw new LlmError("blocked", false, "The model declined this request.");
      }
      return { text: response.text ?? "", truncated: reason === "MAX_TOKENS" };
    } catch (err) {
      throw toLlmError(err);
    }
  };
}

export interface GenerateOptions<T> {
  complete: Complete;
  system: string;
  user: string;
  schema: z.ZodType<T>;
  fallback: () => T;
  /** Used in server logs, e.g. "generate". */
  label: string;
  /** Per attempt. Defaults to LLM_TIMEOUT_MS or 25s. */
  timeoutMs?: number;
}

export interface GenerateResult<T> {
  data: T;
  /** True when every attempt failed and `data` is the fallback. */
  fallback: boolean;
  /** Friendly message for the UI when `fallback` is true. */
  error?: string;
}

function formatIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, 8)
    .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("\n");
}

async function callWithTimeout(
  complete: Complete,
  system: string,
  messages: LlmMessage[],
  timeoutMs: number,
): Promise<Completion> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new LlmError("timeout", true, "The model took too long to respond."));
      controller.abort(); // cancels the in-flight request
    }, timeoutMs);
  });
  try {
    // The race guarantees the bound even if `complete` ignores the signal.
    return await Promise.race([complete({ system, messages, signal: controller.signal }), timedOut]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Calls the model, parses (and repairs) JSON, validates with Zod. On a failed attempt it retries
 * once, appending the validation error so the model can fix it. After the final failure it logs
 * server-side and returns `fallback()` so callers never crash on bad model output.
 */
export async function generateValidated<T>(opts: GenerateOptions<T>): Promise<GenerateResult<T>> {
  const timeoutMs = opts.timeoutMs ?? (Number(process.env.LLM_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS);
  const maxAttempts = 2;
  let messages: LlmMessage[] = [{ role: "user", content: opts.user }];
  let lastUserMessage = "The model returned something that couldn't be used.";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const { text, truncated } = await callWithTimeout(opts.complete, opts.system, messages, timeoutMs);

      if (truncated) {
        throw new OutputError("Output was cut off at the token limit. Return fewer or shorter sections.", "");
      }
      let parsed: unknown;
      try {
        parsed = parseModelJson(text);
      } catch (e) {
        throw new OutputError(`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`, text);
      }
      const result = opts.schema.safeParse(parsed);
      if (!result.success) throw new OutputError(formatIssues(result.error), text);
      return { data: result.data, fallback: false };
    } catch (err) {
      const failure = err instanceof OutputError ? err : toLlmError(err);
      console.error(`[llm:${opts.label}] attempt ${attempt}/${maxAttempts} failed: ${redactSecrets(failure.message)}`);

      if (failure instanceof LlmError) {
        lastUserMessage = failure.userMessage;
        if (!failure.retryable) break;
      } else {
        lastUserMessage = "The model returned output that didn't pass validation.";
      }
      if (attempt === maxAttempts) break;

      if (failure instanceof OutputError) {
        const note = `Your previous output was rejected:\n${failure.message}\nReturn the corrected JSON only.`;
        const echo = failure.output && failure.output.length <= MAX_ECHO_CHARS ? failure.output : "";
        messages = echo
          ? [
              { role: "user", content: opts.user },
              { role: "assistant", content: echo },
              { role: "user", content: note },
            ]
          : [{ role: "user", content: `${opts.user}\n\n${note}` }];
      } // transport errors retry with the same messages
    }
  }

  console.error(`[llm:${opts.label}] giving up, returning fallback`);
  return { data: opts.fallback(), fallback: true, error: lastUserMessage };
}
