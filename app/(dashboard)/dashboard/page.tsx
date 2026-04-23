import Link from "next/link";

export default function DashboardHome() {
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="font-display text-4xl text-brand-navy">Welcome back</h1>
      <p className="mt-2 text-muted-foreground">
        Start by locking in your brand context, then move through the six
        phases. Everything from Strategize onward uses your Level-Set data as
        AI context.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <HomeCard
          href="/dashboard/level-set"
          n={1}
          title="Level-Set"
          desc="Define your brand voice, boilerplate, and messaging pillars."
        />
        <HomeCard
          href="/dashboard/strategize/ideation"
          n={2}
          title="Strategize"
          desc="Generate campaign angles and build your target list."
        />
        <HomeCard
          href="/dashboard/draft/pitches"
          n={3}
          title="Draft"
          desc="AI-compose pitches, releases, social posts, and follow-ups."
        />
        <HomeCard
          href="/dashboard/execute/email"
          n={4}
          title="Execute"
          desc="Send pitches with open + click tracking; export wire kits."
        />
        <HomeCard
          href="/dashboard/analyze"
          n={5}
          title="Analyze"
          desc="Monitor coverage, sentiment, and share of voice."
        />
        <HomeCard
          href="/dashboard/report"
          n={6}
          title="Report"
          desc="Coverage + ROI reports and on-demand status briefs."
        />
      </div>
    </div>
  );
}

function HomeCard({
  href,
  n,
  title,
  desc,
}: {
  href: string;
  n: number;
  title: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-lg border border-border bg-card p-5 transition hover:border-brand-pink"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
          {n}
        </span>
        <h2 className="font-display text-xl text-brand-navy">{title}</h2>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{desc}</p>
    </Link>
  );
}
