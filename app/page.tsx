import Link from "next/link";
import Image from "next/image";
import {
  BarChart3,
  Check,
  FileText,
  Lightbulb,
  Mail,
  PenLine,
  Radar,
  Send,
  Sparkles,
  Target,
  Users,
} from "lucide-react";

const NAV_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-white text-brand-ink">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-brand-pink focus:px-3 focus:py-2 focus:text-sm focus:text-white"
      >
        Skip to main content
      </a>

      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <Image
              src="/logo-mark.png"
              alt=""
              width={36}
              height={36}
              className="h-9 w-9"
              priority
            />
            <span className="text-lg font-bold tracking-tight text-brand-navy">
              PitchFlare
            </span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm font-medium text-slate-600 md:flex">
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} className="hover:text-brand-navy">
                {l.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <Link
              href="/sign-in"
              className="text-sm font-medium text-slate-600 hover:text-brand-navy"
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="rounded-lg bg-brand-pink px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-pink-deep"
            >
              Start free trial
            </Link>
          </div>
        </div>
      </header>

      <div id="main-content">
        {/* ── Hero ─────────────────────────────────────────────── */}
        <section className="border-b border-slate-100 bg-gradient-to-b from-brand-mist to-white">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 lg:grid-cols-2 lg:py-24">
            <div>
              <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-pink">
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                Ignite your strategy. From pitch to placement.
              </p>
              <h1 className="text-4xl font-bold leading-tight tracking-tight text-brand-navy md:text-5xl">
                PR strategy, pitching, tracking, and reporting in one AI
                platform.
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600">
                PitchFlare helps freelance consultants and boutique agencies run
                campaigns end-to-end — brand setup, AI pitch strategy, contact
                intelligence, send tracking, coverage analytics, and
                client-ready reports.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/sign-up"
                  className="rounded-lg bg-brand-pink px-6 py-3 font-medium text-white shadow-sm transition-colors hover:bg-brand-pink-deep"
                >
                  Start free trial
                </Link>
                <a
                  href="#how-it-works"
                  className="rounded-lg border border-slate-200 bg-white px-6 py-3 font-medium text-slate-700 transition-colors hover:border-slate-300 hover:text-brand-navy"
                >
                  See how it works
                </a>
              </div>
              <p className="mt-4 text-sm text-slate-500">
                No credit card required · Setup in minutes · Cancel anytime
              </p>
            </div>

            {/* Brand logo + product mock card */}
            <div className="relative">
              <Image
                src="/logo.png"
                alt="PitchFlare — Ignite your strategy. From pitch to placement."
                width={400}
                height={404}
                priority
                className="mx-auto w-56 sm:w-64 lg:absolute lg:-top-10 lg:right-0 lg:mx-0 lg:w-[24rem]"
              />
              <div className="relative z-10 -mt-10 rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-200/60 lg:mt-52 lg:mr-28">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Campaign
                  </p>
                  <p className="text-sm font-semibold text-slate-900">
                    Series B launch — TechDaily &amp; friends
                  </p>
                </div>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-emerald-700">
                  On track
                </span>
              </div>
              <ul className="divide-y divide-slate-100">
                <MockRow
                  name="Sarah Okafor"
                  outlet="TechDaily · Enterprise beat"
                  badge="Coverage secured"
                  badgeClass="bg-emerald-50 text-emerald-700"
                />
                <MockRow
                  name="Miguel Ferreira"
                  outlet="The SaaS Report · Podcast"
                  badge="Replied"
                  badgeClass="bg-sky-50 text-sky-700"
                />
                <MockRow
                  name="Dana Lindqvist"
                  outlet="MarketWatch Weekly"
                  badge="Opened 3×"
                  badgeClass="bg-amber-50 text-amber-700"
                />
                <MockRow
                  name="Priya Raman"
                  outlet="Growth Signals newsletter"
                  badge="Follow-up due"
                  badgeClass="bg-pink-50 text-brand-pink"
                />
              </ul>
              <div className="flex items-center justify-between rounded-b-2xl border-t border-slate-100 bg-brand-mist px-5 py-3.5">
                <p className="text-xs text-slate-500">
                  Share of voice this week
                </p>
                <p className="text-sm font-bold text-brand-navy">
                  34% <span className="font-medium text-emerald-600">▲ 6pts</span>
                </p>
              </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Features ─────────────────────────────────────────── */}
        <section id="features" className="mx-auto max-w-6xl px-6 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-brand-navy">
              Everything a PR campaign needs, in one place
            </h2>
            <p className="mt-3 text-lg text-slate-600">
              Six phases, one workflow. Stop stitching together spreadsheets,
              media databases, and mail merge.
            </p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon={<Target className="h-5 w-5" aria-hidden />}
              title="Level-Set"
              body="Capture brand voice, pillars, spokespeople, and boilerplate once — every AI draft stays on-message after that."
            />
            <FeatureCard
              icon={<Lightbulb className="h-5 w-5" aria-hidden />}
              title="Strategize"
              body="AI ideation grounded in your brand, plus multi-source contact intelligence to build the right target list."
            />
            <FeatureCard
              icon={<PenLine className="h-5 w-5" aria-hidden />}
              title="Draft"
              body="Pitches, press releases, social posts, and follow-ups drafted in your voice, personalized per journalist."
            />
            <FeatureCard
              icon={<Send className="h-5 w-5" aria-hidden />}
              title="Execute"
              body="Send tracked email direct or push to wire distribution. Opens, clicks, and replies land back on the contact."
            />
            <FeatureCard
              icon={<Radar className="h-5 w-5" aria-hidden />}
              title="Analyze"
              body="Coverage monitoring and sentiment analysis, so you know what landed and how it was received."
            />
            <FeatureCard
              icon={<BarChart3 className="h-5 w-5" aria-hidden />}
              title="Report"
              body="Coverage, share of voice, and ROI in client-ready PDF reports — generated in minutes, not afternoons."
            />
          </div>
        </section>

        {/* ── How it works ─────────────────────────────────────── */}
        <section
          id="how-it-works"
          className="border-y border-slate-100 bg-brand-mist"
        >
          <div className="mx-auto max-w-6xl px-6 py-20">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-brand-navy">
                From angle to ROI, without the busywork
              </h2>
              <p className="mt-3 text-lg text-slate-600">
                A campaign in three moves.
              </p>
            </div>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              <StepCard
                n={1}
                title="Set your brand foundation"
                body="Answer a short brand questionnaire — voice, pillars, products, competitors. PitchFlare turns it into context every AI feature uses."
              />
              <StepCard
                n={2}
                title="Strategize & draft with AI"
                body="Generate campaign angles, build a vetted media list with contact intelligence, and draft personalized pitches in your brand voice."
              />
              <StepCard
                n={3}
                title="Send, track & report"
                body="Send tracked pitches, watch coverage and sentiment roll in, and export client-ready coverage, share-of-voice, and ROI reports."
              />
            </div>
          </div>
        </section>

        {/* ── Dark: built for agencies ─────────────────────────── */}
        <section className="bg-brand-ink text-white">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-bold tracking-tight">
                Built for consultants and boutique agencies.
              </h2>
              <p className="mt-3 text-lg leading-relaxed text-slate-300">
                Not a bloated enterprise suite. PitchFlare is shaped around how
                small teams actually run PR — many brands, few people, zero
                time for admin.
              </p>
            </div>
            <div className="mt-12 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
              <DarkItem
                icon={<Users className="h-5 w-5" aria-hidden />}
                title="Multi-brand workspaces"
                body="Keep every client's voice, contacts, and campaigns cleanly separated, and switch between them in one click."
              />
              <DarkItem
                icon={<Mail className="h-5 w-5" aria-hidden />}
                title="Tracked sending built in"
                body="Opens, clicks, and replies tracked per journalist — no BCC hacks or mail-merge plugins."
              />
              <DarkItem
                icon={<Sparkles className="h-5 w-5" aria-hidden />}
                title="AI that knows the brand"
                body="Every draft is grounded in the brand profile you set up, so output sounds like the client — not like a bot."
              />
              <DarkItem
                icon={<Radar className="h-5 w-5" aria-hidden />}
                title="Contact intelligence"
                body="Journalist and podcast discovery backed by Apollo, Hunter, Podchaser, and SparkToro integrations."
              />
              <DarkItem
                icon={<BarChart3 className="h-5 w-5" aria-hidden />}
                title="Proof for every retainer"
                body="Share-of-voice and ROI reporting that shows clients exactly what their spend produced."
              />
              <DarkItem
                icon={<FileText className="h-5 w-5" aria-hidden />}
                title="Client-ready PDFs"
                body="Status, coverage, and ROI reports exported as polished PDFs you can send without touching a slide deck."
              />
            </div>
          </div>
        </section>

        {/* ── Pain / stats ─────────────────────────────────────── */}
        <section className="mx-auto max-w-6xl px-6 py-20">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-brand-navy">
                Manual PR is quietly expensive.
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-slate-600">
                Building media lists by hand, personalizing pitches one by one,
                chasing coverage links, and assembling monthly reports — it all
                comes out of billable hours. PitchFlare gives those hours back.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  "Media list research that took a day happens in minutes",
                  "Personalized pitch drafts in your brand voice, not templates",
                  "Coverage and sentiment tracked automatically, not bookmarked",
                  "Monthly client reports generated instead of assembled",
                ].map((line) => (
                  <li key={line} className="flex items-start gap-3">
                    <Check
                      className="mt-0.5 h-5 w-5 shrink-0 text-brand-green"
                      aria-hidden
                    />
                    <span className="text-slate-700">{line}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <StatTile stat="6-in-1" label="Phases of the PR workflow covered in one tool" />
              <StatTile stat="Minutes" label="From campaign brief to a personalized pitch draft" />
              <StatTile stat="4 sources" label="Of contact intelligence behind every media list" />
              <StatTile stat="1 click" label="To a client-ready coverage or ROI report" />
            </div>
          </div>
        </section>

        {/* ── Pricing ──────────────────────────────────────────── */}
        <section
          id="pricing"
          className="border-y border-slate-100 bg-brand-mist"
        >
          <div className="mx-auto max-w-6xl px-6 py-20">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-brand-navy">
                Pricing that scales with you
              </h2>
              <p className="mt-3 text-lg text-slate-600">
                Start solo, grow to an agency. Yearly billing saves ~10%.
              </p>
            </div>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              <PriceCard
                name="Solo"
                price={99}
                blurb="For independent consultants running one brand."
                features={[
                  "1 seat, 1 brand",
                  "Full six-phase workflow",
                  "AI strategy & drafting",
                  "Tracked email sending",
                  "Coverage & ROI reports",
                ]}
              />
              <PriceCard
                name="Boutique"
                price={249}
                blurb="For small consultancies juggling a few clients."
                highlighted
                features={[
                  "Up to 3 seats / 3 brands",
                  "Everything in Solo",
                  "Multi-brand workspaces",
                  "Contact intelligence integrations",
                  "Sentiment monitoring",
                ]}
              />
              <PriceCard
                name="Agency"
                price={499}
                blurb="For boutique agencies with a full client roster."
                features={[
                  "Up to 5 seats / 10 brands",
                  "Everything in Boutique",
                  "Wire distribution",
                  "Share-of-voice reporting",
                  "Priority support",
                ]}
              />
            </div>
          </div>
        </section>

        {/* ── FAQ ──────────────────────────────────────────────── */}
        <section id="faq" className="mx-auto max-w-3xl px-6 py-20">
          <h2 className="text-center text-3xl font-bold tracking-tight text-brand-navy">
            Common questions
          </h2>
          <div className="mt-10 space-y-4">
            <Faq
              q="Will the AI drafts actually sound like my client?"
              a="Yes — that's what the Level-Set phase is for. You capture the brand's voice, pillars, spokespeople, and approved boilerplate once, and every pitch, press release, and social post is generated against that profile rather than from a generic template."
            />
            <Faq
              q="Where do the journalist contacts come from?"
              a="PitchFlare combines contact intelligence from Apollo, Hunter, Podchaser, and SparkToro, then matches and de-duplicates the results into a single target list you can vet before anything is sent."
            />
            <Faq
              q="Can I manage multiple clients in one account?"
              a="Yes. Boutique and Agency plans support multiple brand workspaces with separated voice profiles, contacts, campaigns, and reports — switch between clients from the dashboard header."
            />
            <Faq
              q="What do clients see in reports?"
              a="Polished PDF reports covering coverage secured, share of voice against competitors, sentiment, and campaign ROI — designed to be forwarded to a client without editing."
            />
          </div>
        </section>

        {/* ── Final CTA ────────────────────────────────────────── */}
        <section className="bg-gradient-to-br from-brand-navy via-brand-navy to-brand-ink text-white">
          <div className="mx-auto max-w-4xl px-6 py-20 text-center">
            <Image
              src="/logo.png"
              alt="PitchFlare — Ignite your strategy. From pitch to placement."
              width={192}
              height={194}
              className="mx-auto mb-8 w-48"
            />
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              See PitchFlare on your own campaigns.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-slate-300">
              Set up a brand, generate a strategy, and send your first tracked
              pitch — all before your next client call.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/sign-up"
                className="rounded-lg bg-brand-pink px-6 py-3 font-medium text-white shadow-sm transition-colors hover:bg-brand-pink-deep"
              >
                Start free trial
              </Link>
              <Link
                href="/sign-in"
                className="rounded-lg border border-white/25 px-6 py-3 font-medium text-white transition-colors hover:bg-white/10"
              >
                Sign in
              </Link>
            </div>
          </div>
        </section>

        {/* ── Footer ───────────────────────────────────────────── */}
        <footer className="border-t border-white/10 bg-brand-ink text-slate-400">
          <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 md:grid-cols-4">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2.5">
                <Image
                  src="/logo-mark.png"
                  alt=""
                  width={32}
                  height={32}
                  className="h-8 w-8"
                />
                <span className="text-lg font-bold tracking-tight text-white">
                  PitchFlare
                </span>
              </div>
              <p className="mt-3 max-w-sm text-sm leading-relaxed">
                Ignite your strategy. From pitch to placement. AI-native PR for
                freelance consultants and boutique agencies.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Product</h3>
              <ul className="mt-3 space-y-2 text-sm">
                <li>
                  <a href="#features" className="hover:text-white">
                    Features
                  </a>
                </li>
                <li>
                  <a href="#how-it-works" className="hover:text-white">
                    How it works
                  </a>
                </li>
                <li>
                  <a href="#pricing" className="hover:text-white">
                    Pricing
                  </a>
                </li>
                <li>
                  <a href="#faq" className="hover:text-white">
                    FAQ
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Get started</h3>
              <ul className="mt-3 space-y-2 text-sm">
                <li>
                  <Link href="/sign-up" className="hover:text-white">
                    Start free trial
                  </Link>
                </li>
                <li>
                  <Link href="/sign-in" className="hover:text-white">
                    Sign in
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/10">
            <p className="mx-auto max-w-6xl px-6 py-5 text-xs">
              © {new Date().getFullYear()} PitchFlare. All rights reserved.
            </p>
          </div>
        </footer>
      </div>
    </main>
  );
}

function MockRow({
  name,
  outlet,
  badge,
  badgeClass,
}: {
  name: string;
  outlet: string;
  badge: string;
  badgeClass: string;
}) {
  return (
    <li className="flex items-center justify-between gap-3 px-5 py-3.5">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-800">{name}</p>
        <p className="truncate text-xs text-slate-500">{outlet}</p>
      </div>
      <span
        className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${badgeClass}`}
      >
        {badge}
      </span>
    </li>
  );
}

function FeatureCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-brand-pink">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-500">{body}</p>
    </div>
  );
}

function StepCard({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex h-8 w-8 items-center justify-center rounded-full bg-brand-navy text-sm font-bold text-white">
        {n}
      </div>
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-500">{body}</p>
    </div>
  );
}

function DarkItem({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div>
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-brand-gold">
        {icon}
      </div>
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{body}</p>
    </div>
  );
}

function StatTile({ stat, label }: { stat: string; label: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-brand-mist p-6">
      <p className="text-2xl font-bold text-brand-navy">{stat}</p>
      <p className="mt-1.5 text-sm leading-snug text-slate-500">{label}</p>
    </div>
  );
}

function PriceCard({
  name,
  price,
  blurb,
  features,
  highlighted = false,
}: {
  name: string;
  price: number;
  blurb: string;
  features: string[];
  highlighted?: boolean;
}) {
  return (
    <div
      className={`relative flex flex-col rounded-2xl border bg-white p-6 shadow-sm ${
        highlighted ? "border-brand-pink ring-1 ring-brand-pink" : "border-slate-200"
      }`}
    >
      {highlighted && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-pink px-3 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
          Most popular
        </span>
      )}
      <h3 className="text-base font-semibold text-slate-900">{name}</h3>
      <p className="mt-1 text-sm text-slate-500">{blurb}</p>
      <p className="mt-4">
        <span className="text-4xl font-bold tracking-tight text-brand-navy">
          ${price}
        </span>
        <span className="text-sm text-slate-500"> /month</span>
      </p>
      <ul className="mt-5 flex-1 space-y-2.5">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-sm text-slate-600">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-green" aria-hidden />
            {f}
          </li>
        ))}
      </ul>
      <Link
        href="/sign-up"
        className={`mt-6 rounded-lg px-4 py-2.5 text-center text-sm font-medium transition-colors ${
          highlighted
            ? "bg-brand-pink text-white hover:bg-brand-pink-deep"
            : "border border-slate-200 text-slate-700 hover:border-slate-300 hover:text-brand-navy"
        }`}
      >
        Start free trial
      </Link>
    </div>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <details className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900 marker:content-none">
        <span className="flex items-center justify-between gap-3">
          {q}
          <span
            aria-hidden
            className="text-slate-400 transition-transform group-open:rotate-45"
          >
            +
          </span>
        </span>
      </summary>
      <p className="mt-3 text-sm leading-relaxed text-slate-500">{a}</p>
    </details>
  );
}
