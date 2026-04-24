import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-5xl flex-col gap-10 px-6 py-24">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-brand-pink" aria-hidden />
            <span className="font-display text-2xl text-brand-navy">
              PitchFlare
            </span>
          </div>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/sign-in" className="text-brand-navy hover:underline">
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="rounded-full bg-brand-pink px-4 py-2 text-white hover:opacity-90"
            >
              Get started
            </Link>
          </nav>
        </header>

        <section className="flex flex-col gap-6">
          <h1 className="font-display text-5xl text-brand-navy md:text-6xl">
            AI-native PR, from angle to ROI.
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground">
            PitchFlare helps freelance consultants and boutique agencies run
            campaigns end-to-end: brand setup, AI pitch strategy, multi-channel
            contact intelligence, send tracking, coverage analytics, and
            client-ready reports.
          </p>
          <div>
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 rounded-full bg-brand-pink px-6 py-3 text-white shadow-sm hover:opacity-90"
            >
              ✦ Start your first campaign
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
