import "server-only";
import { GoogleGenAI } from "@google/genai";

// The single place that touches GEMINI_API_KEY and GEMINI_MODEL. Server-only: importing this from client
// code fails the build, so the key can never end up in a browser bundle.
//
// Values are read lazily (on first use) instead of at import time, so `next build` and the test runner can
// load the routes without the variables being set. A missing variable fails with a clear message when a
// Gemini call is actually attempted. The key's value is never logged, returned or put in an error message.

/** The user-facing message for a missing variable (names only, never values). */
export class GeminiConfigError extends Error {}

const MISSING_KEY = "GEMINI_API_KEY is not set. Add it to .env.local (or set DEMO_MODE=true).";
const MISSING_MODEL = "GEMINI_MODEL is not set. Add it to .env.local (for example gemini-2.5-flash).";

/** What is missing from the environment, or null when Gemini is configured. */
export function missingGeminiConfig(): string | null {
  if (!process.env.GEMINI_API_KEY) return MISSING_KEY;
  if (!process.env.GEMINI_MODEL) return MISSING_MODEL;
  return null;
}

let client: { key: string; ai: GoogleGenAI } | undefined;

/** The one shared client. Re-created only if the key changes (e.g. after editing .env.local in dev). */
export function getAi(): GoogleGenAI {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new GeminiConfigError(MISSING_KEY);
  if (!client || client.key !== key) client = { key, ai: new GoogleGenAI({ apiKey: key }) };
  return client.ai;
}

/** The model name from GEMINI_MODEL. */
export function getModel(): string {
  const model = process.env.GEMINI_MODEL;
  if (!model) throw new GeminiConfigError(MISSING_MODEL);
  return model;
}

/** Removes anything that looks like (or is) the API key from text that may be logged or returned. */
export function redactSecrets(text: string): string {
  let out = text.replace(/AIza[0-9A-Za-z_-]{20,}/g, "[redacted]");
  const key = process.env.GEMINI_API_KEY;
  if (key && key.length >= 8) out = out.split(key).join("[redacted]");
  return out;
}

const limits = new Map<string, number>();
const LOOKUP_TIMEOUT_MS = 5_000;

/** Rejects if `work` has not settled in `ms` (the timer is always cleared). */
function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("timed out")), ms);
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

/**
 * `wanted` output tokens, capped at what the model allows (asking for more than the model's limit is a 400).
 * The limit is looked up once per model; if the lookup fails the request is made as-is and any real problem
 * (bad key, unknown model) surfaces from the generate call itself.
 */
export async function outputTokenBudget(model: string, wanted: number): Promise<number> {
  if (!limits.has(model)) {
    try {
      const info = await withTimeout(getAi().models.get({ model }), LOOKUP_TIMEOUT_MS);
      limits.set(model, info.outputTokenLimit ?? Number.POSITIVE_INFINITY);
    } catch {
      limits.set(model, Number.POSITIVE_INFINITY);
    }
  }
  return Math.min(wanted, limits.get(model) ?? wanted);
}
