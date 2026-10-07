import { demoDelay, findSavedPatch, isDemoRequest } from "@/lib/demo";
import { missingGeminiConfig } from "@/lib/gemini";
import { createGeminiComplete, generateValidated } from "@/lib/llm";
import {
  PATCH_SYSTEM,
  PatchError,
  PatchRequestSchema,
  applyPatch,
  buildPatchPrompt,
  demoPatch,
  patchOutputSchema,
  type PatchOutput,
} from "@/lib/patch";
import type { Component } from "@/lib/schema";

export const maxDuration = 60;

/**
 * POST /api/patch  { componentId, request, designSystem, components }
 *   -> { component, discarded, fallback?, error?, demo? }
 *
 * The model sees only the selected component. The server decides what is applied: the target must
 * exist and must not be locked (409), only that id is replaced, its id/type/lock are kept, extra
 * components in the model's reply are discarded, and the html is sanitized. If the model fails, the
 * original component is returned unchanged with `fallback: true` (an error block must never replace
 * real content).
 */
export async function POST(request: Request) {
  const parsed = PatchRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid request: expected { componentId, request, designSystem, components }." },
      { status: 400 },
    );
  }
  const { componentId, request: edit, designSystem, components } = parsed.data;

  const target = components.find((c) => c.id === componentId);
  if (!target) return Response.json({ error: `No section "${componentId}" on the canvas.` }, { status: 400 });
  // Checked before anything else: a locked section never reaches the model.
  if (target.locked) {
    return Response.json({ error: "This section is locked. Unlock it to edit it.", locked: true }, { status: 409 });
  }

  const respond = (output: PatchOutput, extra: { demo?: boolean } = {}) => {
    try {
      const { component, discarded } = applyPatch(components, componentId, output);
      return Response.json({ component, discarded, ...extra });
    } catch (err) {
      if (err instanceof PatchError) {
        return Response.json({ error: err.message, locked: err.code === "locked" }, { status: 409 });
      }
      throw err;
    }
  };
  const unchanged = (error: string) => Response.json({ component: target satisfies Component, discarded: [], fallback: true, error });

  if (isDemoRequest(request)) {
    await demoDelay("patch");
    return respond(demoPatch(target, edit, findSavedPatch(target, edit)), { demo: true });
  }

  const missing = missingGeminiConfig();
  if (missing) {
    console.error(`[patch] ${missing}`);
    return unchanged(missing);
  }

  const result = await generateValidated({
    complete: createGeminiComplete(),
    system: PATCH_SYSTEM,
    user: buildPatchPrompt(target, edit, designSystem),
    schema: patchOutputSchema(componentId),
    fallback: () => ({ replacement: target, discardedIds: [] }),
    label: "patch",
  });

  if (result.fallback) return unchanged(result.error ?? "Couldn't apply that edit, try again.");
  return respond(result.data);
}
