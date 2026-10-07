import type { DesignSystem } from "./schema";

const DURATION = { none: "0ms", subtle: "150ms", expressive: "250ms" } as const;

/** Google Fonts stylesheet URL for the design system's two families (weights 400-700). */
export function fontsHref(ds: DesignSystem): string {
  const families = [...new Set([ds.typography.headingFont, ds.typography.bodyFont])]
    .map((f) => `family=${f.replace(/ /g, "+")}:wght@400;500;600;700`)
    .join("&");
  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}

/** The design system as CSS variables on :root. Values are schema-validated before they get here. */
function cssVars(ds: DesignSystem): string[] {
  const { color: c, typography: t, spacing: s, radius: r, motion: m } = ds;
  // Native UI inside the page (scrollbars, form controls) should match a dark page.
  const [red, green, blue] = [1, 3, 5].map((i) => parseInt(c.bg.slice(i, i + 2), 16));
  const colorScheme = (0.299 * red + 0.587 * green + 0.114 * blue) / 255 < 0.45 ? "dark" : "light";
  const vars = [
    `color-scheme:${colorScheme}`,
    `--bg:${c.bg}`,
    `--surface:${c.surface}`,
    `--ink:${c.ink}`,
    `--muted:${c.muted}`,
    `--accent:${c.accent}`,
    `--on-accent:${c.onAccent}`,
    `--line:color-mix(in srgb,var(--ink) 14%,transparent)`,
    `--radius:${r.base}`,
    ...s.scale.map((v, i) => `--space-${i + 1}:${v}`),
    `--dur:${DURATION[m.level]}`,
    `--ease:cubic-bezier(.2,0,0,1)`,
    `--heading-font:"${t.headingFont}",ui-sans-serif,system-ui,sans-serif`,
    `--body-font:"${t.bodyFont}",ui-sans-serif,system-ui,sans-serif`,
  ];
  // "name:value" declarations; the two builders below format them.
  return vars;
}

/** Compact form, used inside the live preview. rounded-full is built into Tailwind (not a theme value), so the pill ban is enforced here. */
export function designSystemCss(ds: DesignSystem): string {
  return `:root{${cssVars(ds).join(";")}}.rounded-full{border-radius:var(--radius)!important}`;
}

/** Readable form (one declaration per line), used in the exported file. */
export function designSystemCssPretty(ds: DesignSystem): string {
  const lines = cssVars(ds).map((v) => {
    const i = v.indexOf(":");
    return `  ${v.slice(0, i)}: ${v.slice(i + 1)};`;
  });
  return `:root {\n${lines.join("\n")}\n}\n.rounded-full {\n  border-radius: var(--radius) !important;\n}`;
}

/**
 * Tailwind v4 theme (goes in <style type="text/tailwindcss">). It REPLACES the default colors,
 * fonts and radii with the tokens, so classes outside the token set (bg-slate-500, rounded-full,
 * font-mono...) generate no CSS instead of silently breaking the look.
 */
export const TAILWIND_THEME = `
@theme inline {
  --color-*: initial;
  --color-bg: var(--bg);
  --color-surface: var(--surface);
  --color-ink: var(--ink);
  --color-muted: var(--muted);
  --color-accent: var(--accent);
  --color-on-accent: var(--on-accent);
  --color-line: var(--line);
  --font-*: initial;
  --font-heading: var(--heading-font);
  --font-body: var(--body-font);
  --radius-*: initial;
  --radius-ui: var(--radius);
  --radius-ui-lg: calc(var(--radius) * 2);
  --spacing-s1: var(--space-1);
  --spacing-s2: var(--space-2);
  --spacing-s3: var(--space-3);
  --spacing-s4: var(--space-4);
  --spacing-s5: var(--space-5);
  --spacing-s6: var(--space-6);
  --default-transition-duration: var(--dur);
  --default-transition-timing-function: var(--ease);
}
@layer base {
  body { background: var(--bg); color: var(--ink); font-family: var(--body-font); -webkit-font-smoothing: antialiased; }
  h1, h2, h3, h4 { font-family: var(--heading-font); }
}
`;
