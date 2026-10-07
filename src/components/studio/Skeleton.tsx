/** Placeholder shown while a page is being generated (shimmer is defined in globals.css). */
export function PageSkeleton() {
  return (
    <div role="status" aria-label="Building your page" className="flex h-full flex-col gap-10 overflow-hidden bg-panel p-8">
      <div className="flex items-center justify-between">
        <div className="skeleton h-5 w-28" />
        <div className="flex gap-4">
          <div className="skeleton h-4 w-12" />
          <div className="skeleton h-4 w-16" />
          <div className="skeleton h-4 w-12" />
        </div>
      </div>
      <div className="grid gap-4">
        <div className="skeleton h-3 w-40" />
        <div className="skeleton h-12 w-3/4" />
        <div className="skeleton h-12 w-1/2" />
        <div className="skeleton mt-2 h-4 w-2/3" />
        <div className="skeleton h-4 w-1/2" />
        <div className="skeleton mt-4 h-10 w-44" />
      </div>
      <div className="grid gap-6 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="grid gap-3">
            <div className="skeleton h-4 w-1/2" />
            <div className="skeleton h-3 w-full" />
            <div className="skeleton h-3 w-5/6" />
          </div>
        ))}
      </div>
    </div>
  );
}
