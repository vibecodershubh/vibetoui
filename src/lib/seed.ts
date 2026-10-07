import type { Canvas } from "./schema";

// Hardcoded canvas for testing selection/locking before any AI is involved.
export const seedCanvas: Canvas = {
  designSystem: {
    typography: { headingFont: "Inter", bodyFont: "Inter", scale: "default" },
    color: {
      primary: "#4f46e5",
      secondary: "#0f172a",
      background: "#ffffff",
      foreground: "#0f172a",
      accent: "#f59e0b",
    },
    spacing: { density: "comfortable" },
    radius: { scale: "lg" },
    motion: { level: "subtle" },
  },
  components: [
    {
      id: "navbar-1",
      type: "navbar",
      variant: "simple",
      locked: false,
      props: {},
      html: `<header class="flex items-center justify-between border-b border-slate-200 bg-white px-8 py-4">
  <span class="text-lg font-semibold text-slate-900">Brewline</span>
  <nav class="flex gap-6 text-sm text-slate-600"><a href="#">Menu</a><a href="#">Story</a><a href="#">Visit</a></nav>
  <a href="#" class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white">Order</a>
</header>`,
    },
    {
      id: "hero-1",
      type: "hero",
      variant: "centered",
      locked: false,
      props: {},
      html: `<section class="bg-slate-950 px-8 py-24 text-center text-white">
  <h1 class="mx-auto max-w-2xl text-5xl font-semibold tracking-tight">Coffee worth waking up for.</h1>
  <p class="mx-auto mt-5 max-w-xl text-slate-400">Small-batch roasts delivered fresh to your door every two weeks.</p>
  <a href="#" class="mt-8 inline-block rounded-lg bg-amber-400 px-6 py-3 font-semibold text-slate-900">Start your subscription</a>
</section>`,
    },
    {
      id: "features-1",
      type: "features",
      variant: "three-column",
      locked: false,
      props: {},
      html: `<section class="grid gap-6 bg-white px-8 py-16 md:grid-cols-3">
  <div class="rounded-xl border border-slate-200 p-6"><h3 class="font-semibold text-slate-900">Fresh roasted</h3><p class="mt-2 text-sm text-slate-600">Roasted within 48 hours of shipping.</p></div>
  <div class="rounded-xl border border-slate-200 p-6"><h3 class="font-semibold text-slate-900">Ethically sourced</h3><p class="mt-2 text-sm text-slate-600">Direct trade with farms we know by name.</p></div>
  <div class="rounded-xl border border-slate-200 p-6"><h3 class="font-semibold text-slate-900">Skip anytime</h3><p class="mt-2 text-sm text-slate-600">Pause or cancel in one click, no emails.</p></div>
</section>`,
    },
  ],
  metadata: { intent: null, history: [] },
};
