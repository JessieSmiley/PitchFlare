/**
 * Temporary placeholder used for phase/sub-phase screens that are scaffolded
 * but will be implemented in later chunks (D–G). Each page imports this and
 * sets `title` + `chunk` so the roadmap is legible from the UI itself.
 */
export function PhaseStub({
  n,
  title,
  description,
  chunk,
}: {
  n?: number;
  title: string;
  description: string;
  chunk: string;
}) {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center gap-3">
        {typeof n === "number" && (
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
            {n}
          </span>
        )}
        <h1 className="font-display text-4xl text-brand-navy">{title}</h1>
      </div>
      <p className="mt-3 text-muted-foreground">{description}</p>
      <div className="mt-8 rounded-lg border border-dashed border-border bg-card p-6">
        <div className="text-sm font-semibold text-brand-pink">Coming soon</div>
        <p className="mt-1 text-sm text-muted-foreground">
          Lands in <span className="font-medium">{chunk}</span>. See SPEC.md
          and the build guide for what this screen does.
        </p>
      </div>
    </div>
  );
}
