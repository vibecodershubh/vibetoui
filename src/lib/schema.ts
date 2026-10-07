import { z } from "zod";

export const DesignSystemSchema = z.object({
  typography: z.object({
    headingFont: z.string(),
    bodyFont: z.string(),
    scale: z.enum(["compact", "default", "large"]),
  }),
  color: z.object({
    primary: z.string(),
    secondary: z.string(),
    background: z.string(),
    foreground: z.string(),
    accent: z.string(),
  }),
  spacing: z.object({
    density: z.enum(["compact", "comfortable", "spacious"]),
  }),
  radius: z.object({
    scale: z.enum(["none", "sm", "md", "lg", "full"]),
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

export const IntentSchema = z.object({
  goal: z.string(),
  audience: z.string(),
  targetUi: z.string(),
  visualDirection: z.string(),
  contentNotes: z.string(),
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
