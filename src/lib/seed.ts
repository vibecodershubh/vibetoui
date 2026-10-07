import { DEFAULT_PRESET } from "./presets";
import type { Canvas } from "./schema";
import { EXAMPLE_HERO, EXAMPLE_SPLIT } from "./taste";

// Hardcoded canvas for testing selection/locking and the design tokens before any AI is involved.
// The hero and features are the few-shot examples from the taste prompt, so they are always on screen.
export const seedCanvas: Canvas = {
  designSystem: DEFAULT_PRESET.designSystem,
  components: [
    {
      id: "navbar-1",
      type: "navbar",
      variant: "simple",
      locked: false,
      props: {},
      html: `<header class="border-b border-line bg-bg">
  <div class="mx-auto flex max-w-6xl items-center justify-between gap-s3 px-s4 py-s3">
    <a href="#" class="font-heading text-lg font-semibold text-ink">Brewline</a>
    <nav class="flex gap-s4 text-sm text-muted"><a href="#" class="transition hover:text-ink">Lots</a><a href="#" class="transition hover:text-ink">Subscriptions</a><a href="#" class="transition hover:text-ink">Farms</a></nav>
  </div>
</header>`,
    },
    { id: "hero-1", type: "hero", variant: "split-detail", locked: false, props: {}, html: EXAMPLE_HERO },
    { id: "features-1", type: "features", variant: "divided-list", locked: false, props: {}, html: EXAMPLE_SPLIT },
  ],
  metadata: { intent: null, history: [] },
};
