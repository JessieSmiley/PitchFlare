import Link from "next/link";
import type { CompletionResult } from "@/lib/brand/completion";

export function CompletionMeter({ result }: { result: CompletionResult }) {
  const complete = result.score >= 100;
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg text-brand-navy">
            Brand completeness
          </h2>
          <p className="text-xs text-muted-foreground">
            Every field feeds AI prompts downstream. 100% unlocks Strategize.
          </p>
        </div>
        <div className="text-right">
          <div className="font-display text-3xl text-brand-pink">
            {result.score}%
          </div>
          {complete && (
            <Link
              href="/dashboard/strategize/ideation"
              className="text-xs text-brand-pink hover:underline"
            >
              Go to Strategize →
            </Link>
          )}
        </div>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-brand-pink transition-[width]"
          style={{ width: `${result.score}%` }}
          aria-hidden
        />
      </div>

      {result.missing.length > 0 && (
        <details className="mt-3 text-xs text-muted-foreground">
          <summary className="cursor-pointer">
            {result.missing.length} item
            {result.missing.length === 1 ? "" : "s"} remaining
          </summary>
          <ul className="mt-2 list-disc space-y-0.5 pl-5">
            {result.missing.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
