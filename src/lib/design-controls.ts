import type { DesignSystem } from "./schema";

// The design panel's radius and density controls. They rewrite concrete design-system tokens, so the
// result is still schema-valid and flows through the same CSS variables as every preset.

export const RADIUS_OPTIONS = [
  { id: "sharp", label: "Sharp", value: "0px" },
  { id: "soft", label: "Soft", value: "6px" },
  { id: "round", label: "Round", value: "14px" },
] as const;
export type RadiusId = (typeof RADIUS_OPTIONS)[number]["id"];

export const DENSITY_OPTIONS = [
  { id: "compact", label: "Compact", scale: ["0.25rem", "0.5rem", "0.875rem", "1.25rem", "2rem", "clamp(3rem,6vw,5rem)"] },
  { id: "comfortable", label: "Comfortable", scale: ["0.375rem", "0.75rem", "1.25rem", "2rem", "3.5rem", "clamp(5rem,10vw,9rem)"] },
  { id: "spacious", label: "Spacious", scale: ["0.5rem", "1rem", "1.5rem", "2.5rem", "4rem", "clamp(5rem,12vw,10rem)"] },
] as const;
export type DensityId = (typeof DENSITY_OPTIONS)[number]["id"];

export function withRadius(ds: DesignSystem, id: RadiusId): DesignSystem {
  const option = RADIUS_OPTIONS.find((o) => o.id === id) ?? RADIUS_OPTIONS[1];
  return { ...ds, radius: { base: option.value } };
}

export function withDensity(ds: DesignSystem, id: DensityId): DesignSystem {
  const option = DENSITY_OPTIONS.find((o) => o.id === id) ?? DENSITY_OPTIONS[1];
  return { ...ds, spacing: { density: option.id, scale: [...option.scale] } };
}

/** The option closest to the current radius (presets use values like 2px that are not an option). */
export function currentRadiusId(ds: DesignSystem): RadiusId {
  const px = parseFloat(ds.radius.base) || 0;
  let best: (typeof RADIUS_OPTIONS)[number] = RADIUS_OPTIONS[0];
  for (const o of RADIUS_OPTIONS) {
    if (Math.abs(parseFloat(o.value) - px) < Math.abs(parseFloat(best.value) - px)) best = o;
  }
  return best.id;
}

export const currentDensityId = (ds: DesignSystem): DensityId => ds.spacing.density;
