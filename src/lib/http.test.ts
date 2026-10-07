import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEMO_HEADER } from "./demo-header";
import { TIMEOUTS, TimeoutError, requestJson } from "./http";
import { useHealthStore } from "@/store/health";
import { useStudioStore } from "@/store/studio";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** A fetch that never answers on its own but honors the abort signal, like the real one. */
const hangingFetch = () =>
  vi.fn((_url: unknown, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
    }),
  );

beforeEach(() => {
  useStudioStore.setState({ demo: false });
  useHealthStore.setState({ status: "checking", message: null, serverDemo: false });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("requestJson", () => {
  it("gives up with a TimeoutError instead of hanging, and cancels the request", async () => {
    vi.useFakeTimers();
    const fetchMock = hangingFetch();
    vi.stubGlobal("fetch", fetchMock);
    const result = requestJson("/api/x", { body: { a: 1 }, timeoutMs: 5_000 });
    const assertion = expect(result).rejects.toBeInstanceOf(TimeoutError);
    await vi.advanceTimersByTimeAsync(5_000);
    await assertion;
    expect((fetchMock.mock.calls[0][1] as RequestInit).signal?.aborted).toBe(true);
  });

  it("returns the JSON body even for an error status, and sends the demo header only when the switch is on", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ error: "nope" }, 400));
    vi.stubGlobal("fetch", fetchMock);
    expect(await requestJson("/api/x", { body: {}, timeoutMs: 1000 })).toEqual({ error: "nope" });
    expect((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].headers).not.toHaveProperty(DEMO_HEADER);

    useStudioStore.setState({ demo: true });
    await requestJson("/api/x", { body: {}, timeoutMs: 1000 });
    expect((fetchMock.mock.calls[1] as unknown as [string, RequestInit])[1].headers).toMatchObject({ [DEMO_HEADER]: "1" });
  });

  it("uses a sensible time limit for every kind of request", () => {
    expect(TIMEOUTS.health).toBeLessThan(TIMEOUTS.generate);
    for (const ms of Object.values(TIMEOUTS)) expect(ms).toBeGreaterThan(0);
    expect(TIMEOUTS.generate).toBeGreaterThan(50_000); // above two 25s server attempts
  });
});

describe("health store (the status indicator)", () => {
  const url = (call: unknown) => String((call as unknown[])[0]);

  it("the free config check never calls the model, and reports ready / demo / missing config", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ ok: true, deep: false }));
    vi.stubGlobal("fetch", fetchMock);
    await useHealthStore.getState().checkConfig();
    expect(useHealthStore.getState()).toMatchObject({ status: "ready", serverDemo: false });
    expect(url(fetchMock.mock.calls[0])).toBe("/api/health?mode=config");

    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ ok: true, demo: true })));
    await useHealthStore.getState().checkConfig();
    expect(useHealthStore.getState()).toMatchObject({ status: "demo", serverDemo: true });

    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ ok: false, reason: "missing_config", message: "GEMINI_API_KEY is not set." }, 503)));
    await useHealthStore.getState().checkConfig();
    expect(useHealthStore.getState()).toMatchObject({ status: "down", message: "GEMINI_API_KEY is not set." });
  });

  it("learns from real requests and does not let a config check overrule them", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ ok: true })));
    useHealthStore.getState().report(false, "Gemini's quota for this key is used up.");
    expect(useHealthStore.getState()).toMatchObject({ status: "down", message: "Gemini's quota for this key is used up." });
    await useHealthStore.getState().checkConfig(); // configured, but real requests are failing: stay down
    expect(useHealthStore.getState().status).toBe("down");

    useHealthStore.getState().report(true);
    expect(useHealthStore.getState()).toMatchObject({ status: "ok", message: null });
    await useHealthStore.getState().checkConfig();
    expect(useHealthStore.getState().status).toBe("ok");
  });

  it("verify makes the one real call (/api/health) and reports its result, including a timeout", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ ok: true, deep: true }));
    vi.stubGlobal("fetch", fetchMock);
    await useHealthStore.getState().verify();
    expect(useHealthStore.getState().status).toBe("ok");
    expect(url(fetchMock.mock.calls[0])).toBe("/api/health");

    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ ok: false, reason: "quota_exceeded", message: "Gemini's quota for this key is used up." }, 503)));
    await useHealthStore.getState().verify();
    expect(useHealthStore.getState()).toMatchObject({ status: "down", message: "Gemini's quota for this key is used up." });

    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("fetch failed"))));
    await useHealthStore.getState().verify();
    expect(useHealthStore.getState()).toMatchObject({ status: "down", message: "Can't reach the server." });

    vi.useFakeTimers();
    vi.stubGlobal("fetch", hangingFetch());
    const pending = useHealthStore.getState().verify();
    await vi.advanceTimersByTimeAsync(TIMEOUTS.health);
    await pending;
    expect(useHealthStore.getState()).toMatchObject({ status: "down", message: "The health check timed out." });
  });

  it("in demo mode nothing is requested and real-request reports are ignored", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    useStudioStore.setState({ demo: true });
    await useHealthStore.getState().checkConfig();
    await useHealthStore.getState().verify();
    useHealthStore.getState().report(false, "ignored");
    expect(useHealthStore.getState().status).toBe("demo");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("health store race: the demo switch flips while a check is in flight", () => {
  it("a late answer from before the switch does not overwrite 'demo' (the ?demo=1 case)", async () => {
    let release!: (r: Response) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => (release = resolve))));
    const pending = useHealthStore.getState().checkConfig(); // started before the flag was known
    useStudioStore.setState({ demo: true }); // ...then ?demo=1 is read
    await useHealthStore.getState().checkConfig();
    expect(useHealthStore.getState().status).toBe("demo");
    release(jsonResponse({ ok: true, deep: false })); // the stale answer finally arrives
    await pending;
    expect(useHealthStore.getState().status).toBe("demo");
  });
});
