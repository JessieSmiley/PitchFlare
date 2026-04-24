/**
 * Dashboard-group loading state. Renders a neutral skeleton for the main
 * content area while the server component streams. The sidebar + top bar
 * stay visible because the layout above this file remains mounted during
 * the suspense.
 */
export default function DashboardLoading() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 py-2" aria-busy="true">
      <div className="h-10 w-56 rounded-md bg-muted" />
      <div className="h-4 w-80 rounded-md bg-muted/60" />
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-32 rounded-lg border border-border bg-card p-4"
          >
            <div className="h-4 w-24 rounded bg-muted" />
            <div className="mt-2 h-3 w-40 rounded bg-muted/60" />
            <div className="mt-4 h-6 w-32 rounded bg-muted/60" />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
