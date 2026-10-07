import Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";
import { parseModelJson } from "./json";

export interface LlmMessage {
  role: "user" | "assistant";
  content: string;
}

export interface Completion {
  text: string;
  /** True when the model stopped because it hit max_tokens (output is incomplete). */
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

const MODEL = () => process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
const MAX_TOKENS = 16_000;
export const DEFAULT_TIMEOUT_MS = 25_000;
const MAX_ECHO_CHARS = 20_000;

function toLlmError(err: unknown): LlmError {
  if (err instanceof LlmError) return err;
  if (err instanceof Anthropic.AuthenticationError)
    return new LlmError("auth", false, "The API key was rejected. Check ANTHROPIC_API_KEY.");
  if (err instanceof Anthropic.NotFoundError)
    return new LlmError("model not found", false, `Model "${MODEL()}" was not found. Check ANTHROPIC_MODEL.`);
  if (err instanceof Anthropic.BadRequestError)
    return new LlmError(`bad request: ${err.message}`, false, "The model API rejected the request.");
  if (err instanceof Anthropic.RateLimitError)
    return new LlmError("rate limited", true, "Rate limited by the API. Wait a moment and try again.");
  if (err instanceof Anthropic.APIConnectionError)
    return new LlmError(`connection: ${err.message}`, true, "Couldn't reach the Anthropic API.");
  if (err instanceof Anthropic.APIError)
    return new LlmError(`api ${err.status}: ${err.message}`, true, "The model API returned an error.");
  return new LlmError(err instanceof Error ? err.message : String(err), true, "Something went wrong calling the model.");
}

/** The real model call. The abort signal cancels the underlying HTTP request. */
export function createAnthropicComplete(opts: { model?: string; maxTokens?: number } = {}): Complete {
  const client = new Anthropic();
  return async ({ system, messages, signal }) => {
    try {
      const res = await client.messages.create(
        {
          model: opts.model || MODEL(),
          max_tokens: opts.maxTokens ?? MAX_TOKENS,
          // The system prompt is static, so it is a cache candidate (no-op if under the model's minimum).
          system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
          messages,
        },
        { signal, maxRetries: 0 },
      );
      if (res.stop_reason === "refusal")
        throw new LlmError("refusal", false, "The model declined this request.");
      const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
      return { text, truncated: res.stop_reason === "max_tokens" };
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
      console.error(`[llm:${opts.label}] attempt ${attempt}/${maxAttempts} failed: ${failure.message}`);

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
