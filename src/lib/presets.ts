import type { DesignSystem } from "./schema";

export interface Preset {
  id: string;
  name: string;
  /** One sentence for the generation prompt: what this direction feels like. */
  direction: string;
  designSystem: DesignSystem;
}

// Fonts are all variable/static families that cover weights 400-700, so the Google Fonts
// URL built in theme.ts is valid for every preset.
export const PRESETS: Preset[] = [
  {
    id: "editorial",
    name: "Editorial",
    direction:
      "A well-set magazine: warm paper, serif headlines, generous margins, asymmetric layouts, hairline rules instead of boxes.",
    designSystem: {
      typography: { headingFont: "Newsreader", bodyFont: "Inter" },
      color: {
        bg: "#FAF7F2",
        surface: "#F0EBE1",
        ink: "#1B1A17",
        muted: "#6B665C",
        accent: "#9A3412",
        onAccent: "#FFFFFF",
      },
      spacing: {
        density: "comfortable",
        scale: ["0.375rem", "0.75rem", "1.25rem", "2rem", "3.5rem", "clamp(5rem,10vw,9rem)"],
      },
      radius: { base: "2px" },
      motion: { level: "subtle" },
    },
  },
  {
    id: "technical",
    name: "Technical",
    direction:
      "A developer tool: dark, dense, precise. Tight spacing, sharp corners, information first, one signal color.",
    designSystem: {
      typography: { headingFont: "Space Grotesk", bodyFont: "IBM Plex Sans" },
      color: {
        bg: "#0B0D10",
        surface: "#12161B",
        ink: "#E6EAF0",
        muted: "#8B95A5",
        accent: "#34D399",
        onAccent: "#04281B",
      },
      spacing: {
        density: "compact",
        scale: ["0.25rem", "0.5rem", "0.875rem", "1.25rem", "2rem", "clamp(3rem,6vw,5rem)"],
      },
      radius: { base: "6px" },
      motion: { level: "subtle" },
    },
  },
  {
    id: "soft-friendly",
    name: "Soft & Friendly",
    direction:
      "Warm and approachable: rounded corners, roomy spacing, relaxed type, a calm teal accent, gentle state transitions.",
    designSystem: {
      typography: { headingFont: "Bricolage Grotesque", bodyFont: "DM Sans" },
      color: {
        bg: "#FFFBF5",
        surface: "#F6EFE4",
        ink: "#2B2A33",
        muted: "#6E6C7A",
        accent: "#0F766E",
        onAccent: "#FFFFFF",
      },
      spacing: {
        density: "spacious",
        scale: ["0.5rem", "0.875rem", "1.25rem", "2rem", "3rem", "clamp(4rem,8vw,7rem)"],
      },
      radius: { base: "14px" },
      motion: { level: "expressive" },
    },
  },
  {
    id: "bold-minimal",
    name: "Bold Minimal",
    direction:
      "Stark and confident: white space, oversized type, square corners, black on white with one hot accent used once.",
    designSystem: {
      typography: { headingFont: "Inter Tight", bodyFont: "Inter" },
      color: {
        bg: "#FFFFFF",
        surface: "#F4F4F5",
        ink: "#0A0A0A",
        muted: "#5F5F66",
        accent: "#D92D0B",
        onAccent: "#FFFFFF",
      },
      spacing: {
        density: "spacious",
        scale: ["0.5rem", "1rem", "1.5rem", "2.5rem", "4rem", "clamp(5rem,12vw,10rem)"],
      },
      radius: { base: "0px" },
      motion: { level: "subtle" },
    },
  },
];

export const DEFAULT_PRESET = PRESETS[0];

export const getPreset = (id: string): Preset | undefined => PRESETS.find((p) => p.id === id);
