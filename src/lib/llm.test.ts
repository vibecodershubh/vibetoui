import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fallbackComponents } from "./fallback";
import { LlmError, generateValidated, type Complete, type LlmMessage } from "./llm";
import { GeneratedComponentsSchema } from "./schema";

const good = JSON.stringify([
  { id: "hero-1", type: "hero", variant: "simple", html: '<section class="bg-bg">Hello world, this is long enough</section>', props: {} },
]);
const base = { system: "sys", user: "make it", schema: GeneratedComponentsSchema, fallback: fallbackComponents, label: "test", timeoutMs: 50 };

beforeEach(() => void vi.spyOn(console, "error").mockImplementation(() => {}));
afterEach(() => vi.restoreAllMocks());

describe("generateValidated", () => {
  it("retries once with the validation error appended, then succeeds", async () => {
    const seen: LlmMessage[][] = [];
    const outputs = ['[{"id": "Bad Id!", "type": "hero", "variant": "v", "html": "<p>short html here ok?</p>"}]', "```json\n" + good + "\n```"];
    const complete: Complete = async ({ messages }) => {
      seen.push(messages);
      return { text: outputs[seen.length - 1], truncated: false };
    };
    const result = await generateValidated({ ...base, complete });
    expect(result.fallback).toBe(false);
    expect(result.data[0].id).toBe("hero-1");
    expect(seen).toHaveLength(2);
    expect(seen[1].map((m) => m.role)).toEqual(["user", "assistant", "user"]);
    expect(seen[1][2].content).toMatch(/rejected[\s\S]*0\.id/); // names the failing field
  });

  it("returns the fallback block after the final failure, on timeout and on truncation", async () => {
    const hang: Complete = () => new Promise(() => {});
    const timedOut = await generateValidated({ ...base, complete: hang });
    expect(timedOut).toMatchObject({ fallback: true, error: "The model took too long to respond." });
    expect(timedOut.data[0].props).toEqual({ fallback: true });

    const cutOff: Complete = async () => ({ text: good.slice(0, 40), truncated: true });
    expect((await generateValidated({ ...base, complete: cutOff })).fallback).toBe(true);
  });

  it("does not spend the retry on non-retryable errors (bad key, refusal)", async () => {
    let calls = 0;
    const complete: Complete = async () => {
      calls++;
      throw new LlmError("auth", false, "The API key was rejected.");
    };
    const result = await generateValidated({ ...base, complete });
    expect(calls).toBe(1);
    expect(result).toMatchObject({ fallback: true, error: "The API key was rejected." });
  });
});
