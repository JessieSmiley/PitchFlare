import Link from "next/link";
import { HelpSearch } from "@/components/help/help-search";

export const dynamic = "force-static";

const TOPICS: Array<{
  id: string;
  title: string;
  body: string;
  href?: string;
}> = [
  {
    id: "level-set",
    title: "Level-Set: why every field matters",
    body: "Every Level-Set field feeds AI prompts downstream. The richer your voice, pillars, and spokespeople, the better pitches, status reports, and talking points come back. 100% completion unlocks Strategize.",
    href: "/dashboard/level-set",
  },
  {
    id: "ideation",
    title: "Generating pitch angles",
    body: "Ideation uses your brand context plus the campaign setup to return five structured angles with hook, rationale, media fit, and risk. Promote one as primary — downstream flows (Targets, Pitches) read it as the campaign's strategic thesis.",
    href: "/dashboard/strategize/ideation",
  },
  {
    id: "targets",
    title: "Target Compilation and match scoring",
    body: "Match score = beat overlap × 0.5 + recent-work keyword × 0.3 + contact type × 0.2. Scores appear only after you've set a primary angle. Click 'Find contacts for this angle' to build a MediaList of the top 20 matches.",
    href: "/dashboard/strategize/targets",
  },
  {
    id: "pitches",
    title: "Pitches: generate, variants, approve",
    body: "Generate a draft per contact, batch across the whole list, or ask for three tonally-distinct variants. Approve a draft to move it into the Execute queue — nothing auto-sends.",
    href: "/dashboard/draft/pitches",
  },
  {
    id: "execute",
    title: "Sending with tracking",
    body: "Execute sends approved pitches one at a time (never BCC) and throttles to one message every 3 seconds. Each email carries a 1×1 open-tracking pixel and wrapped links for click-tracking.",
    href: "/dashboard/execute/email",
  },
  {
    id: "analyze",
    title: "Coverage, sentiment, Share of Voice",
    body: "The Analyze feed accepts manual URLs and auto-ingests Google News RSS every 6 hours. Claude scores sentiment + reach per clip. SoV is brand clips vs. brand + competitor count; per-competitor monitoring lands in a future release.",
    href: "/dashboard/analyze",
  },
  {
    id: "reports",
    title: "Status Reports, Media Briefs, Talking Points",
    body: "Three one-click generators. Each writes a markdown doc and offers a branded PDF download. Media Briefs are per-contact; the other two are per-campaign.",
    href: "/dashboard/report",
  },
  {
    id: "billing",
    title: "Plans, usage, limits",
    body: "Solo = 1 seat / 1 brand. Boutique = seats × brands ≤ 3. Agency = 5 seats / 10 brands. Upgrades open Stripe Checkout; everything else (card, cancel, cycle switch) runs through the Customer Portal.",
    href: "/dashboard/settings/billing",
  },
  {
    id: "integrations",
    title: "Data partners (BYO accounts)",
    body: "Hunter.io, Apollo, Podchaser, SparkToro. You connect your own account; we store the key encrypted AES-256-GCM and run lookups on your behalf. Partner-written fields carry a 'Data partner' badge and never overwrite values you typed by hand.",
    href: "/dashboard/settings/integrations",
  },
  {
    id: "shortcuts",
    title: "Keyboard shortcuts",
    body: "⌘K / Ctrl+K — jump to any screen · ⌘/ — this page · ⌘⇧N — new pitch. On Windows/Linux, Ctrl replaces ⌘.",
  },
];

export default function HelpPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="font-display text-4xl text-brand-navy">Help</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          How the six phases fit together. Press{" "}
          <kbd className="rounded bg-muted px-1.5 py-0.5 text-[10px]">⌘/</kbd>{" "}
          from anywhere to get back here.
        </p>
      </div>

      <HelpSearch topics={TOPICS} />

      <p className="mt-4 text-xs text-muted-foreground">
        Nothing useful above? See{" "}
        <Link href="/" className="text-brand-pink hover:underline">
          the landing page
        </Link>{" "}
        for a full product overview or check{" "}
        <Link href="/dashboard/settings/billing" className="text-brand-pink hover:underline">
          Billing
        </Link>{" "}
        for plan-specific questions.
      </p>
    </div>
  );
}
