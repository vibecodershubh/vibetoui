import type { GenerateRequest } from "./schema";
import { TASTE_SKILL } from "./taste";

const OUTPUT_FORMAT = `## OUTPUT FORMAT (overrides any earlier "output only HTML" instruction)
Return ONLY a JSON array. No prose, no markdown fences. Each element is one page section:
{"id": "hero-1", "type": "hero", "variant": "split-detail", "html": "<section class=\\"bg-bg\\">...</section>", "props": {"headline": "..."}}
- id: unique, lowercase kebab-case, at most 40 characters (for example "navbar-1", "features-1").
- type: the section's role (navbar, hero, features, process, pricing, testimonial, faq, cta, footer, ...).
- variant: a short name for the layout you chose.
- html: ONE root element for the section, following every rule above. It is a JSON string: escape double quotes and write newlines as \\n.
- props: the main editable copy of the section as flat key/value strings (for example headline, subhead, ctaLabel). Use {} if there is none.
- Return between 3 and 7 sections, ordered top to bottom, forming one visual story that ends with a single call to action.`;

/** Static (cacheable) system prompt: the taste rules plus the output contract. */
export const GENERATION_SYSTEM = `${TASTE_SKILL}\n\n${OUTPUT_FORMAT}`;

/**
 * Builds the generation prompt from structured inputs only. The raw user prompt never reaches
 * this function: the intent object (from the interview step) and the design system are the brief.
 */
export function buildGenerationPrompt({ intent, designSystem: ds, targetType }: GenerateRequest) {
  const lowConfidence = intent.confidence < 0.5;
  const user = `Design a ${targetType}.

<intent>
Goal: ${intent.goal}
Audience: ${intent.audience}
Target UI: ${intent.targetUi}
Visual direction: ${intent.visualDirection}
Content notes: ${intent.contentNotes || "none"}
Confidence in this brief: ${intent.confidence.toFixed(2)}${
    lowConfidence
      ? "\n(Low confidence: do not invent specifics such as names, prices, features or numbers. Write modest, honest copy and keep content general.)"
      : ""
  }
</intent>

<design_system>
The look is already applied through the design tokens (use the token classes, never raw values). For orientation only:
Heading font: ${ds.typography.headingFont}. Body font: ${ds.typography.bodyFont}.
Palette: background ${ds.color.bg}, surface ${ds.color.surface}, ink ${ds.color.ink}, muted ${ds.color.muted}, single accent ${ds.color.accent}.
Corner radius: ${ds.radius.base}. Density: ${ds.spacing.density}. Motion: ${ds.motion.level}.
</design_system>

Return the JSON array now.`;
  return { system: GENERATION_SYSTEM, user };
}
