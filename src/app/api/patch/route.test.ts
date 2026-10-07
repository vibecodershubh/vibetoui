import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { seedCanvas } from "@/lib/seed";

// The route must never reach the model for a locked section.
const modelCalls = vi.hoisted(() => ({ n: 0 }));
vi.mock("@/lib/llm", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/llm")>()),
  createAnthropicComplete: () => {
    modelCalls.n++;
    return async () => ({ text: "[]", truncated: false });
  },
}));

import { POST } from "./route";

const body = (over: Record<string, unknown> = {}) =>
  new Request("http://test/api/patch", {
    method: "POST",
    body: JSON.stringify({
      componentId: "hero-1",
      request: "make it more editorial",
      designSystem: seedCanvas.designSystem,
      components: seedCanvas.components,
      ...over,
    }),
  });

const env = { ...process.env };
beforeEach(() => {
  modelCalls.n = 0;
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  process.env = { ...env };
  vi.restoreAllMocks();
});

describe("POST /api/patch", () => {
  it("rejects a locked section with 409 before any model call", async () => {
    process.env.DEMO_MODE = "false";
    process.env.ANTHROPIC_API_KEY = "sk-test";
    const components = seedCanvas.components.map((c) => (c.id === "hero-1" ? { ...c, locked: true } : c));
    const res = await POST(body({ components }));
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ locked: true });
    expect(modelCalls.n).toBe(0);
  });

  it("demo mode returns a replacement for the target only", async () => {
    process.env.DEMO_MODE = "true";
    const res = await POST(body());
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.component).toMatchObject({ id: "hero-1", type: "hero", locked: false });
    expect(json.component.html).toContain("Edited:");
    expect(json.discarded).toEqual([]);
  });

  it("returns the original component with fallback when there is no API key", async () => {
    process.env.DEMO_MODE = "false";
    delete process.env.ANTHROPIC_API_KEY;
    const json = await (await POST(body())).json();
    expect(json.fallback).toBe(true);
    expect(json.component.html).toBe(seedCanvas.components[1].html);
    expect(modelCalls.n).toBe(0);
  });

  it("400s on unknown keys, unknown ids and malformed bodies", async () => {
    expect((await POST(body({ prompt: "raw" }))).status).toBe(400);
    expect((await POST(body({ componentId: "nope-9" }))).status).toBe(400);
    expect((await POST(new Request("http://test/api/patch", { method: "POST", body: "{" }))).status).toBe(400);
    expect((await POST(body({ request: "   " }))).status).toBe(400);
  });
});
