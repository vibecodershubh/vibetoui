import { demoDelay, isDemoRequest, loadDemo } from "@/lib/demo";
import { fallbackComponents } from "@/lib/fallback";
import { sanitizeHtml } from "@/lib/html";
import { missingGeminiConfig } from "@/lib/gemini";
import { createGeminiComplete, generateValidated } from "@/lib/llm";
import { buildGenerationPrompt } from "@/lib/prompt";
import { GenerateRequestSchema, GeneratedComponentsSchema, type GeneratedComponent } from "@/lib/schema";

// One attempt is 25s by default and there is one retry, so allow for both.
export const maxDuration = 60;

const clean = (components: GeneratedComponent[]): GeneratedComponent[] =>
  components.map((c) => ({ ...c, html: sanitizeHtml(c.html) }));

/**
 * POST /api/generate  { intent, designSystem, targetType }  ->  { components, fallback?, error?, demo? }
 *
 * There is no field for a raw user prompt (the request schema is strict). The prompt is built from
 * the taste skill + the structured intent + the design system. Every non-400 outcome is HTTP 200
 * with a usable `components` array: on failure it is a tidy fallback block and `error` says why.
 */
export async function POST(request: Request) {
  const parsed = GenerateRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid request: expected { intent, designSystem, targetType }." }, { status: 400 });
  }

  if (isDemoRequest(request)) {
    await demoDelay("generate");
    try {
      return Response.json({ components: clean(loadDemo(parsed.data.targetType, parsed.data.intent.goal)), demo: true });
    } catch (err) {
      console.error("[generate] demo output failed validation:", err);
      return Response.json({ components: fallbackComponents(), fallback: true, error: "Demo data is invalid." });
    }
  }

  const missing = missingGeminiConfig();
  if (missing) {
    console.error(`[generate] ${missing}`);
    return Response.json({ components: fallbackComponents(), fallback: true, error: missing });
  }

  const { system, user } = buildGenerationPrompt(parsed.data);
  const result = await generateValidated({
    complete: createGeminiComplete(),
    system,
    user,
    schema: GeneratedComponentsSchema,
    fallback: fallbackComponents,
    label: "generate",
  });

  return Response.json({
    components: clean(result.data),
    ...(result.fallback ? { fallback: true, error: result.error } : {}),
  });
}
