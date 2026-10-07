import { useStudioStore } from "@/store/studio";
import { DEMO_HEADER } from "./demo-header";

/**
 * Client-side time limits. They sit just above the server's worst case (two 25s model attempts, and the route's
 * maxDuration of 60s), so the UI gives up only after the server has, and nothing can hang forever.
 */
export const TIMEOUTS = { interview: 65_000, generate: 65_000, patch: 65_000, health: 15_000 } as const;

export class TimeoutError extends Error {
  constructor(readonly ms: number) {
    super(`Request timed out after ${ms}ms`);
  }
}

/**
 * fetch + JSON with a hard timeout (it covers waiting for the body too). Sends the demo header when the demo switch
 * is on. Resolves with the parsed JSON whatever the HTTP status (the API's 4xx/5xx bodies are JSON too); throws
 * TimeoutError on timeout and the underlying error for network failures or a non-JSON body.
 */
export async function requestJson(url: string, opts: { body?: unknown; timeoutMs: number }): Promise<unknown> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, opts.timeoutMs);
  const hasBody = opts.body !== undefined;
  try {
    const res = await fetch(url, {
      method: hasBody ? "POST" : "GET",
      headers: {
        ...(hasBody ? { "Content-Type": "application/json" } : {}),
        ...(useStudioStore.getState().demo ? { [DEMO_HEADER]: "1" } : {}),
      },
      body: hasBody ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
      cache: "no-store",
    });
    return await res.json();
  } catch (err) {
    if (timedOut) throw new TimeoutError(opts.timeoutMs);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
