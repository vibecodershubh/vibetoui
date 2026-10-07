"use client";

import { useEffect } from "react";

// Last line of defense: anything that escapes the canvas boundary lands here instead of a blank screen.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[app] unhandled error:", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 text-center">
      <h1 className="font-serif text-4xl text-ink">Something went wrong.</h1>
      <p className="mt-3 text-sm text-stone">Reloading usually fixes it. If it keeps happening, try the demo data (add ?demo=1 to the address).</p>
      <div className="mt-6">
        <button
          type="button"
          onClick={reset}
          className="rounded-control bg-accent-fill px-4 py-2.5 text-sm font-medium text-on-accent transition-colors duration-150 hover:opacity-90"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
