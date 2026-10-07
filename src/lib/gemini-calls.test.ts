import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A fake Gemini client: nothing here touches the network or a real key.
const calls = vi.hoisted(() => ({ generate: [] as unknown[], respond: null as null | (() => unknown) }));
vi.mock("./gemini", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./gemini")>()),
  getAi: () => ({
    models: {
      generateContent: async (params: unknown) => {
        calls.generate.push(params);
        return calls.respond!();
      },
    },
  }),
  getModel: () => "test-model",
  outputTokenBudget: async (_model: string, wanted: number) => Math.min(wanted, 4096),
}));

import { ApiError } from "@google/genai";
import { checkConfig, checkHealth, resetHealthCache } from "./health";
import { LlmError, createGeminiComplete } from "./llm";

const ok = (text = '{"a":1}', finishReason = "STOP") => () => ({ text, candidates: [{ finishReason }] });
const saved = { ...process.env };

beforeEach(() => {
  calls.generate.length = 0;
  calls.respond = ok();
  resetHealthCache();
  process.env.GEMINI_API_KEY = "AIzaFAKE-KEY-FOR-TESTS-ONLY-1";
  process.env.GEMINI_MODEL = "test-model";
  delete process.env.DEMO_MODE;
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  process.env = { ...saved };
  vi.restoreAllMocks();
});

describe("createGeminiComplete", () => {
  const signal = new AbortController().signal;

  it("calls ai.models.generateContent with systemInstruction, JSON mode, the abort signal and mapped roles", async () => {
    const complete = createGeminiComplete();
    const result = await complete({
      system: "TASTE + RULES",
      messages: [
        { role: "user", content: "first" },
        { role: "assistant", content: "answer" },
        { role: "user", content: "fix it" },
      ],
      signal,
    });

    expect(result).toEqual({ text: '{"a":1}', truncated: false });
    expect(calls.generate).toHaveLength(1);
    expect(calls.generate[0]).toMatchObject({
      model: "test-model",
      contents: [
        { role: "user", parts: [{ text: "first" }] },
        { role: "model", parts: [{ text: "answer" }] }, // Gemini calls the assistant "model"
        { role: "user", parts: [{ text: "fix it" }] },
      ],
      config: {
        systemInstruction: "TASTE + RULES",
        responseMimeType: "application/json",
        abortSignal: signal,
        maxOutputTokens: 4096, // capped by the model's limit
      },
    });
  });

  it("omits JSON mode when asked, and uses a per-call model override", async () => {
    await createGeminiComplete({ json: false, model: "other-model" })({ system: "s", messages: [{ role: "user", content: "x" }], signal });
    const config = (calls.generate[0] as { model: string; config: Record<string, unknown> });
    expect(config.model).toBe("other-model");
    expect(config.config).not.toHaveProperty("responseMimeType");
  });

  it("reports truncation, and treats a blocked response as a non-retryable refusal", async () => {
    calls.respond = ok('{"cut":', "MAX_TOKENS");
    const cut = await createGeminiComplete()({ system: "s", messages: [{ role: "user", content: "x" }], signal });
    expect(cut.truncated).toBe(true);

    calls.respond = ok("", "SAFETY");
    await expect(createGeminiComplete()({ system: "s", messages: [{ role: "user", content: "x" }], signal })).rejects.toMatchObject({
      retryable: false,
      userMessage: "The model declined this request.",
    });
    calls.respond = () => ({ text: undefined, candidates: [], promptFeedback: { blockReason: "OTHER" } });
    await expect(createGeminiComplete()({ system: "s", messages: [{ role: "user", content: "x" }], signal })).rejects.toBeInstanceOf(LlmError);
  });
});

describe("checkHealth", () => {
  it("makes one trivial call and returns only { ok: true }", async () => {
    expect(await checkHealth()).toEqual({ ok: true, deep: true });
    expect(calls.generate).toHaveLength(1);
    expect(calls.generate[0]).toMatchObject({ model: "test-model", config: { maxOutputTokens: expect.any(Number) } });
  });

  it("remembers a good answer for 5 minutes and a bad one for 30 seconds, so it cannot burn a small daily quota", async () => {
    await checkHealth({ now: 1_000 });
    await checkHealth({ now: 200_000 }); // within 5 minutes: served from memory
    expect(calls.generate).toHaveLength(1);
    await checkHealth({ now: 1_000 + 301_000 });
    expect(calls.generate).toHaveLength(2);

    resetHealthCache();
    calls.generate.length = 0;
    calls.respond = () => {
      throw new ApiError({ message: "nope", status: 503 });
    };
    await checkHealth({ now: 1_000 });
    await checkHealth({ now: 20_000 }); // a failure is remembered for 30s
    expect(calls.generate).toHaveLength(1);
    await checkHealth({ now: 40_000 });
    expect(calls.generate).toHaveLength(2);
  });

  it("the config check makes no model call at all", () => {
    expect(checkConfig()).toEqual({ ok: true, deep: false });
    delete process.env.GEMINI_MODEL;
    expect(checkConfig()).toMatchObject({ ok: false, reason: "missing_config" });
    expect(checkConfig({ demo: true })).toEqual({ ok: true, demo: true });
    expect(calls.generate).toHaveLength(0);
  });

  it("reports a missing variable without calling Gemini, naming only the variable", async () => {
    delete process.env.GEMINI_MODEL;
    const health = await checkHealth();
    expect(health).toMatchObject({ ok: false, reason: "missing_config", message: expect.stringContaining("GEMINI_MODEL") });
    expect(calls.generate).toHaveLength(0);
  });

  it("never exposes key material or provider error text when the call fails", async () => {
    const key = process.env.GEMINI_API_KEY!;
    calls.respond = () => {
      throw new ApiError({ message: `API key not valid: ${key} (request ?key=${key})`, status: 400 });
    };
    const health = await checkHealth();
    const body = JSON.stringify(health);
    expect(health).toMatchObject({ ok: false, reason: "auth" });
    expect(body).not.toContain(key);
    expect(body).not.toContain("AIzaFAKE");
    expect(body).not.toMatch(/request \?key/);
    const logged = JSON.stringify((console.error as unknown as { mock: { calls: unknown[] } }).mock.calls);
    expect(logged).not.toContain(key); // and it is not logged either
  });

  it("answers ok in DEMO_MODE without calling Gemini", async () => {
    process.env.DEMO_MODE = "true";
    expect(await checkHealth()).toEqual({ ok: true, demo: true });
    delete process.env.DEMO_MODE;
    expect(await checkHealth({ demo: true })).toEqual({ ok: true, demo: true }); // the per-request switch
    expect(calls.generate).toHaveLength(0);
  });
});
