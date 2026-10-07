import type { GeneratedComponent } from "./schema";

/** Shown when generation fails for good, so the canvas always has something tidy to render. */
export function fallbackComponents(): GeneratedComponent[] {
  return [
    {
      id: "generation-failed",
      type: "notice",
      variant: "error",
      html: `<section class="bg-bg">
  <div class="mx-auto max-w-6xl px-s4 py-s6">
    <div class="max-w-xl border-t border-line pt-s3">
      <h2 class="text-2xl font-semibold tracking-tight text-ink">Couldn't generate this</h2>
      <p class="mt-s2 leading-relaxed text-muted">Something went wrong while building your page. Try again, or adjust your request a little.</p>
    </div>
  </div>
</section>`,
      props: { fallback: true },
    },
  ];
}
