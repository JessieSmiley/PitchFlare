import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-brand-pink" />
        <h1 className="font-display text-5xl text-brand-navy">404</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          That page is off the campaign map. Head back to the dashboard.
        </p>
        <Link
          href="/dashboard"
          className="mt-4 inline-block rounded-full bg-brand-pink px-4 py-2 text-sm text-white hover:opacity-90"
        >
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
