import { z } from "zod";
import { sanitizeHtml } from "./html";
import { designSystemBrief } from "./prompt";
import { ComponentSchema, DesignSystemSchema, GeneratedComponentSchema, type Component, type GeneratedComponent } from "./schema";
import { TASTE_SKILL } from "./taste";

// Scoped patching: the model sees ONE component and returns a replacement for it. Everything that
// keeps the change scoped (which id, which type, locked or not, what to do with extra output)
// is decided here in code, never by the model.

export const PatchRequestSchema = z
  .object({
    componentId: ComponentSchema.shape.id,
    request: z.string().trim().min(1).max(500),
    designSystem: DesignSystemSchema,
    /** The current canvas. The server holds no state, so it needs this to find the target and its lock. */
    components: z.array(ComponentSchema).min(1).max(12),
  })
  .strict()
  .refine((r) => r.components.reduce((n, c) => n + c.html.length, 0) <= 500_000, "canvas is too large");
export type PatchRequest = z.infer<typeof PatchRequestSchema>;

/** What the route returns. `component` is the replacement (or, on failure, the untouched original). */
export const PatchResponseSchema = z.union([
  z.object({
    component: ComponentSchema,
    discarded: z.array(z.string()),
    fallback: z.boolean().optional(),
    demo: z.boolean().optional(),
    error: z.string().optional(),
  }),
  z.object({ error: z.string(), locked: z.boolean().optional() }),
]);
export type PatchResponse = z.infer<typeof PatchResponseSchema>;

export interface PatchOutput {
  replacement: GeneratedComponent;
  /** Ids of any other components the model returned. They are never applied. */
  discardedIds: string[];
}

const Loose = z.object({ id: z.string() }).loose();

/**
 * Model output for a patch: one component object, or an array. Only the element for `componentId`
 * is validated and kept. If the model returned a single element with another id, it is taken as the
 * replacement with the id forced; extras are not validated at all (they are discarded anyway).
 */
export function patchOutputSchema(componentId: string) {
  return z.union([Loose, z.array(Loose).min(1).max(20)]).transform((reply, ctx): PatchOutput => {
    const items = Array.isArray(reply) ? reply : [reply];
    const target = items.find((i) => i.id === componentId) ?? (items.length === 1 ? items[0] : undefined);
    if (!target) {
      ctx.issues.push({ code: "custom", message: `none of the returned components has id "${componentId}"`, input: reply });
      return z.NEVER;
    }
    const parsed = GeneratedComponentSchema.safeParse({ ...target, id: componentId });
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        ctx.issues.push({ code: "custom", message: issue.message, path: issue.path, input: reply });
      }
      return z.NEVER;
    }
    return { replacement: parsed.data, discardedIds: items.filter((i) => i !== target).map((i) => i.id) };
  });
}

export class PatchError extends Error {
  constructor(readonly code: "not_found" | "locked") {
    super(code === "locked" ? "This section is locked. Unlock it to edit it." : "No such section.");
  }
}

export interface ApplyResult {
  /** The canvas after the patch: every other component is the SAME object as before. */
  components: Component[];
  component: Component;
  discarded: string[];
}

/**
 * Replaces ONLY the component with `componentId`. Throws if it does not exist or is locked.
 * The replacement can change html, variant and props; it can never change the id, the type or the
 * lock state, and its html is sanitized. All other components are returned untouched.
 */
export function applyPatch(components: Component[], componentId: string, output: PatchOutput): ApplyResult {
  const index = components.findIndex((c) => c.id === componentId);
  if (index === -1) throw new PatchError("not_found");
  const original = components[index];
  if (original.locked) throw new PatchError("locked");

  const component: Component = {
    id: original.id,
    type: original.type,
    variant: output.replacement.variant,
    html: sanitizeHtml(output.replacement.html),
    props: output.replacement.props,
    locked: original.locked,
  };
  return {
    components: components.map((c, i) => (i === index ? component : c)),
    component,
    discarded: output.discardedIds,
  };
}

// ---------- prompt ----------

const PATCH_RULES = `## YOUR TASK: EDIT ONE COMPONENT (this overrides the output format above)
You receive ONE component (its HTML), the design system, and an edit request. Return a replacement for this component only.
- Keep the same id and the same type. Return one section as a single root element.
- Keep every piece of content the user did not mention (copy, links, structure) exactly as it is. Change only what the request implies: a small request means a small change.
- Use only the design tokens and token classes described above: no raw colors, fonts or radii, no shadows, no external URLs. All the rules above, including the anti-slop rules, apply to anything you add or change.
- You can see only this component. Do not return, mention or modify any other component.
- Return ONLY one JSON object, no markdown fences, no prose:
{"id": "<same id>", "type": "<same type>", "variant": "<short layout name>", "html": "<section ...>...</section>", "props": {}}
html is a JSON string: escape double quotes and write newlines as \\n. props holds the component's main editable copy as flat strings, or {}.`;

/** Static (cacheable) system prompt. */
export const PATCH_SYSTEM = `${TASTE_SKILL}\n\n${PATCH_RULES}`;

/** The user message contains ONLY the target component, the tokens and the request. */
export function buildPatchPrompt(component: Component, request: string, designSystem: PatchRequest["designSystem"]): string {
  return `<component id="${component.id}" type="${component.type}" variant="${component.variant}">
${component.html}
</component>

<design_system>
The look is applied through the design tokens (use the token classes, never raw values). For orientation only:
${designSystemBrief(designSystem)}
</design_system>

<request>
${request}
</request>

Return the JSON object for this component now.`;
}

// ---------- DEMO_MODE ----------

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Deterministic stand-in for the model. With a saved result (see demo.ts) it returns that; otherwise it appends
 * a visible "Edited" line inside the component.
 */
export function demoPatch(original: Component, request: string, saved?: GeneratedComponent): PatchOutput {
  if (saved) return { replacement: { ...saved, id: original.id, type: original.type }, discardedIds: [] };
  const note = `<p class="mx-auto max-w-6xl px-s4 pb-s3 text-sm text-muted">Edited: &ldquo;${escapeHtml(request)}&rdquo;</p>`;
  const closing = /(<\/[a-z0-9]+>)\s*$/i;
  const html = closing.test(original.html) ? original.html.replace(closing, (_, close: string) => note + close) : original.html + note;
  return {
    replacement: { id: original.id, type: original.type, variant: original.variant, html, props: original.props },
    discardedIds: [],
  };
}
