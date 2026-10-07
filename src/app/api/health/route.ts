import { checkHealth } from "@/lib/health";

export const maxDuration = 30;

/**
 * GET /api/health -> { ok: true } | { ok: false, reason, message }
 *
 * Makes one trivial Gemini call (see lib/health.ts). The response never contains key material or raw provider
 * errors. 200 when healthy, 503 otherwise. Results are cached for a few seconds so this cannot be used to
 * spam the API. In DEMO_MODE it answers { ok: true, demo: true } without calling Gemini.
 */
export async function GET(request: Request) {
  new URL(request.url); // reading the request keeps this handler dynamic (never prerendered at build time)
  const health = await checkHealth();
  return Response.json(health, { status: health.ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
