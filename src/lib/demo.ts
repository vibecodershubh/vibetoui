import { z } from "zod";
import aiSecurity from "../../demo/ai-security.json";
import aiSecurityPatches from "../../demo/ai-security-patches.json";
import landingPage from "../../demo/landing-page.json";
import pricing from "../../demo/pricing.json";
import { DEMO_HEADER } from "./demo-header";
import { GeneratedComponentSchema, GeneratedComponentsSchema, type Component, type GeneratedComponent } from "./schema";

// Demo mode serves pre-saved output from /demo/*.json. The files are statically imported (not read with fs)
// so they are always bundled, and they pass through the same schemas as live model output so they cannot drift.

/** Demo mode is on for the whole server (DEMO_MODE=true) or for this one request (the client's demo switch). */
export function isDemoRequest(request: Request): boolean {
  return process.env.DEMO_MODE === "true" || request.headers.get(DEMO_HEADER) === "1";
}

/**
 * Demo mode answers instantly, which hides every loading state. A short pause keeps the skeleton and the
 * "Editing…" state visible so the demo looks like the real thing. DEMO_DELAY_SCALE=0 turns it off (tests do).
 */
const DEMO_DELAY_MS = { interview: 350, generate: 1400, patch: 900 } as const;

export function demoDelay(kind: keyof typeof DEMO_DELAY_MS): Promise<void> {
  const ms = DEMO_DELAY_MS[kind] * (Number(process.env.DEMO_DELAY_SCALE ?? 1) || 0);
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

/** The exact demo flow: hero for an enterprise AI security product, then editorial and feature patches. */
const AI_SECURITY = "ai-security";

const DEMOS: { match: RegExp; data: unknown }[] = [
  { match: /secur|\bAI\b/i, data: aiSecurity },
  { match: /pric/i, data: pricing },
  { match: /./, data: landingPage },
];

/** Saved generate output for the idea. `goal` is the brief's goal (the user's idea); `targetType` is what is being built. */
export function loadDemo(targetType: string, goal = ""): GeneratedComponent[] {
  const text = `${goal} ${targetType}`;
  const demo = DEMOS.find((d) => d.match.test(text)) ?? DEMOS[DEMOS.length - 1];
  return GeneratedComponentsSchema.parse(demo.data);
}

const SavedPatchesSchema = z.record(z.string(), z.array(z.object({ match: z.string(), component: GeneratedComponentSchema })));

/**
 * A pre-saved patch result for this component and request, if the demo has one. Only components that belong to
 * the saved AI-security page (props.demo) are eligible; the first entry whose `match` regex fits the request wins.
 */
export function findSavedPatch(component: Component, request: string): GeneratedComponent | undefined {
  if (component.props?.demo !== AI_SECURITY) return undefined;
  const entries = SavedPatchesSchema.parse(aiSecurityPatches)[component.id] ?? [];
  return entries.find((e) => new RegExp(e.match, "i").test(request))?.component;
}
