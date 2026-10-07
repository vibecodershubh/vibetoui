import { ApiError } from "@google/genai";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GeminiConfigError, getAi, getModel, missingGeminiConfig, redactSecrets } from "./gemini";
import { LlmError, toLlmError } from "./llm";

const FAKE_KEY = "AIzaFAKE-KEY-FOR-TESTS-ONLY-1";
const saved = { ...process.env };
beforeEach(() => {
  delete process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_MODEL;
});
afterEach(() => {
  process.env = { ...saved };
});

describe("gemini config", () => {
  it("fails with a clear message that names the variable, never a value", () => {
    expect(missingGeminiConfig()).toMatch(/GEMINI_API_KEY is not set/);
    expect(() => getAi()).toThrow(GeminiConfigError);
    expect(() => getModel()).toThrow(/GEMINI_MODEL is not set/);

    process.env.GEMINI_API_KEY = FAKE_KEY;
    expect(missingGeminiConfig()).toMatch(/GEMINI_MODEL is not set/);
    process.env.GEMINI_MODEL = "some-model";
    expect(missingGeminiConfig()).toBeNull();
    expect(getModel()).toBe("some-model");
  });

  it("shares one client and only rebuilds it when the key changes", () => {
    process.env.GEMINI_API_KEY = FAKE_KEY;
    const first = getAi();
    expect(getAi()).toBe(first);
    process.env.GEMINI_API_KEY = `${FAKE_KEY}-rotated`;
    expect(getAi()).not.toBe(first);
  });

  it("redacts the configured key and anything shaped like a Google API key", () => {
    process.env.GEMINI_API_KEY = "custom-key-value-12345";
    const text = `failed for custom-key-value-12345 and also ${FAKE_KEY} in a url ?key=${FAKE_KEY}`;
    const out = redactSecrets(text);
    expect(out).not.toContain("custom-key-value-12345");
    expect(out).not.toContain("AIzaFAKE");
    expect(out).toContain("[redacted]");
  });
});

describe("toLlmError", () => {
  const api = (status: number, message = "boom") => new ApiError({ message, status });

  it("treats a rejected key, a missing model and a bad request as non-retryable", () => {
    expect(toLlmError(api(403))).toMatchObject({ retryable: false, userMessage: expect.stringContaining("GEMINI_API_KEY") });
    // Gemini reports a bad key as 400 INVALID_ARGUMENT
    expect(toLlmError(api(400, "API key not valid. Please pass a valid API key."))).toMatchObject({
      retryable: false,
      userMessage: expect.stringContaining("GEMINI_API_KEY"),
    });
    expect(toLlmError(api(404))).toMatchObject({ retryable: false, userMessage: expect.stringContaining("GEMINI_MODEL") });
    expect(toLlmError(api(400, "maxOutputTokens too large"))).toMatchObject({ retryable: false });
  });

  it("retries rate limits, server errors and network failures", () => {
    expect(toLlmError(api(429)).retryable).toBe(true);
    expect(toLlmError(api(503)).retryable).toBe(true);
    expect(toLlmError(new TypeError("fetch failed")).retryable).toBe(true);
    const abort = Object.assign(new Error("The operation was aborted"), { name: "AbortError" });
    expect(toLlmError(abort)).toMatchObject({ retryable: true, userMessage: "The model took too long to respond." });
  });

  it("never lets key material into the message that gets logged", () => {
    process.env.GEMINI_API_KEY = FAKE_KEY;
    const error = toLlmError(api(500, `upstream said: bad request for key ${FAKE_KEY}`));
    expect(error).toBeInstanceOf(LlmError);
    expect(error.message).not.toContain(FAKE_KEY);
    expect(error.message).toContain("[redacted]");
  });

  it("passes a missing-config error through as a clear, non-retryable message", () => {
    expect(toLlmError(new GeminiConfigError("GEMINI_MODEL is not set."))).toMatchObject({
      retryable: false,
      userMessage: "GEMINI_MODEL is not set.",
    });
  });
});
