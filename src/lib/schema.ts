import { z } from "zod";

// These values are interpolated into a <style> block and a Google Fonts URL, so they are
// validated strictly: a bad (or model-written) value must not be able to break out of either.
const HexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const CssLength = z
  .string()
  .regex(/^(?:0|\d*\.?\d+(?:px|rem|em|vw|vh|%)|clamp\([0-9a-z.,\s%+*/-]+\))$/);
const FontName = z.string().regex(/^[A-Za-z0-9 ]{1,40}$/);

export const DesignSystemSchema = z.object({
  typography: z.object({
    headingFont: FontName, // Google Fonts family name
    bodyFont: FontName,
  }),
  color: z.object({
    bg: HexColor,
    surface: HexColor,
    ink: HexColor,
    muted: HexColor,
    accent: HexColor, // the ONE accent
    onAccent: HexColor, // text color on accent fills
  }),
  spacing: z.object({
    density: z.enum(["compact", "comfortable", "spacious"]),
    scale: z.array(CssLength).length(6), // --space-1 .. --space-6 (6 = section rhythm)
  }),
  radius: z.object({
    base: CssLength, // --radius; large containers use 2x
  }),
  motion: z.object({
    level: z.enum(["none", "subtle", "expressive"]),
  }),
});
export type DesignSystem = z.infer<typeof DesignSystemSchema>;

export const ComponentSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1), // e.g. "navbar", "hero", "features"
  variant: z.string(),
  html: z.string(), // Tailwind HTML snippet owned by this component
  props: z.record(z.string(), z.unknown()),
  locked: z.boolean(),
});
export type Component = z.infer<typeof ComponentSchema>;

// Length caps matter: these strings are interpolated into the generation prompt.
export const IntentSchema = z.object({
  goal: z.string().max(1000),
  audience: z.string().max(500),
  targetUi: z.string().max(200),
  visualDirection: z.string().max(500),
  contentNotes: z.string().max(4000),
  confidence: z.number().min(0).max(1),
});
export type Intent = z.infer<typeof IntentSchema>;

export const HistoryEntrySchema = z.object({
  at: z.string(), // ISO timestamp
  summary: z.string(),
  componentId: z.string().optional(),
});
export type HistoryEntry = z.infer<typeof HistoryEntrySchema>;

export const CanvasSchema = z
  .object({
    designSystem: DesignSystemSchema,
    components: z.array(ComponentSchema),
    metadata: z.object({
      intent: IntentSchema.nullable(),
      history: z.array(HistoryEntrySchema),
    }),
  })
  .refine((c) => new Set(c.components.map((x) => x.id)).size === c.components.length, {
    message: "component ids must be unique",
    path: ["components"],
  });
export type Canvas = z.infer<typeof CanvasSchema>;

// ---- /api/generate ----

/** Request body. strict(): there is deliberately no place to put a raw user prompt. */
export const GenerateRequestSchema = z
  .object({
    intent: IntentSchema,
    designSystem: DesignSystemSchema,
    targetType: z.string().trim().min(1).max(60),
  })
  .strict();
export type GenerateRequest = z.infer<typeof GenerateRequestSchema>;

/** One component as the model returns it. No `locked`: the model never controls locking. */
export const GeneratedComponentSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,39}$/, "id must be lowercase kebab-case, max 40 chars"),
  type: z.string().min(1).max(40),
  variant: z.string().min(1).max(60),
  html: z
    .string()
    .min(20)
    .max(30000)
    .refine((h) => /<[a-z][\s\S]*>/i.test(h), "html must contain at least one element"),
  props: z.record(z.string(), z.unknown()).default({}),
});
export type GeneratedComponent = z.infer<typeof GeneratedComponentSchema>;

export const GeneratedComponentsSchema = z
  .array(GeneratedComponentSchema)
  .min(1)
  .max(12)
  .refine((cs) => new Set(cs.map((c) => c.id)).size === cs.length, "component ids must be unique");
