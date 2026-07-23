import Link from "next/link";
import { requireTenant } from "@/lib/auth/tenant";
import { db } from "@/lib/db";
import { AddContactForm } from "@/components/targets/add-contact-form";
import { TargetsShell } from "@/components/targets/targets-shell";
import { CampaignSwitcher } from "@/components/strategize/campaign-switcher";
import { PROVIDERS, providerFor } from "@/lib/providers";
import { scoreContactsForCampaign } from "@/lib/contacts/match";
import { scoreContactsLikelihood } from "@/lib/contacts/likelihood-service";
import { likelihoodBand } from "@/lib/contacts/likelihood";
import type { DiscoveryConfig } from "@/components/targets/contact-table";
import type { EnrichPartner } from "@/components/targets/contact-drawer";
import type { ContactRow } from "@/components/targets/contact-table";
import type { ContactDetail } from "@/components/targets/contact-drawer";

export const dynamic = "force-dynamic";

export default async function TargetsPage({
  searchParams,
}: {
  searchParams: Promise<{ campaignId?: string }>;
}) {
  const tenant = await requireTenant();
  if (!tenant.brand) {
    return <p className="text-sm text-muted-foreground">Pick a brand first.</p>;
  }
  const brandId = tenant.brand.id;

  const params = await searchParams;
  const campaignId = params.campaignId ?? null;

  const [campaigns, campaign, allContacts] = await Promise.all([
    db.campaign.findMany({
      where: { brandId },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true },
    }),
    campaignId
      ? db.campaign.findFirst({
          where: { id: campaignId, brandId },
          include: {
            primaryAngle: true,
            angles: {
              where: { selected: true },
              select: { title: true, hook: true, audienceFit: true },
            },
          },
        })
      : Promise.resolve(null),
    db.contact.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        outlets: {
          include: { outlet: { select: { name: true } } },
          where: { isPrimary: true },
          take: 1,
        },
        beats: { include: { beat: { select: { name: true } } } },
        fields: {
          select: { key: true, value: true, source: true },
          orderBy: { createdAt: "asc" },
        },
        recentWork: {
          select: {
            title: true,
            url: true,
            source: true,
            excerpt: true,
            publishedAt: true,
          },
          orderBy: { publishedAt: "desc" },
          take: 30,
        },
      },
    }),
  ]);

  // Which partners has this account connected? Drives both the discovery
  // search affordance (Hunter) and the per-contact "Enrich" buttons in the
  // drawer (any live email partner).
  const connectedIntegrations = await db.integration.findMany({
    where: {
      accountId: tenant.account.id,
      partner: {
        in: ["HUNTER", "PROSPEO", "APOLLO", "PODCHASER", "SPARKTORO", "DROPCONTACT"],
      },
      status: "CONNECTED",
    },
    select: { partner: true },
  });
  const connectedPartners = new Set(
    connectedIntegrations.map((i) => i.partner),
  );

  // The brand's existing lists, for the "Add to list" pickers.
  const mediaLists = await db.mediaList.findMany({
    where: { brandId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true },
  });

  const discoveryProvider = PROVIDERS.find((p) => p.supportsDiscovery);
  const discovery: DiscoveryConfig | null = discoveryProvider
    ? {
        partner: discoveryProvider.partner as DiscoveryConfig["partner"],
        label: discoveryProvider.label,
        connected: connectedPartners.has(discoveryProvider.partner),
      }
    : null;

  // Live email-enrichment partners the drawer can offer (excludes
  // discovery-only / non-email stubs like Podchaser/SparkToro).
  const enrichPartners: EnrichPartner[] = (
    ["HUNTER", "APOLLO", "PROSPEO", "DROPCONTACT"] as const
  )
    .filter((p) => connectedPartners.has(p))
    .map((p) => ({ partner: p, label: providerFor(p)?.label ?? p }));

  // Topic terms drive both the legacy topical match and the behavioral
  // "covered your topic in 30 days" signal. Assemble them from every angle the
  // user selected on Ideation (they may target different audiences).
  const selectedAngles = campaign?.angles ?? [];
  const angleTerms = campaign
    ? [
        campaign.title,
        campaign.objective,
        ...(campaign.primaryAngle
          ? [
              campaign.primaryAngle.title,
              campaign.primaryAngle.hook,
              campaign.primaryAngle.audienceFit,
            ]
          : []),
        ...selectedAngles.flatMap((a) => [a.title, a.hook, a.audienceFit]),
        ...(campaign.toneTags ?? []),
      ].filter((s): s is string => Boolean(s && s.length))
    : [];

  // Legacy topical match (kept as a secondary, explainable signal).
  const scoreMap = new Map<string, number>();
  if (campaign && (selectedAngles.length > 0 || campaign.primaryAngle)) {
    const scored = await scoreContactsForCampaign(
      brandId,
      {
        campaignAngleTerms: angleTerms,
        preferredMediaTypes: ["JOURNALIST", "PODCASTER", "INFLUENCER"],
      },
      { limit: 500 },
    );
    for (const s of scored) scoreMap.set(s.contactId, s.score);
  }

  // Behavioral Likelihood-to-Cover — the headline score. Bulk, no-AI, brand
  // scoped; the drawer can refine a single contact's rationale with Claude.
  const likelihoodMap = await scoreContactsLikelihood(
    brandId,
    allContacts.map((c) => ({
      contactId: c.id,
      recentWork: c.recentWork,
      fields: c.fields,
    })),
    { topicTerms: angleTerms },
  );

  const rows: ContactRow[] = allContacts.map((c) => {
    const title = c.fields.find((f) => f.key === "title")?.value ?? null;
    const outletFromField = c.fields.find((f) => f.key === "outletName")?.value;
    const outletFromJoin = c.outlets[0]?.outlet.name ?? null;
    return {
      id: c.id,
      name: c.name,
      avatarUrl: c.avatarUrl,
      kind: c.kind,
      title,
      outletName: outletFromJoin ?? outletFromField ?? null,
      beats: c.beats.map((b) => b.beat.name),
      matchScore: scoreMap.get(c.id) ?? null,
      likelihood: (() => {
        const l = likelihoodMap.get(c.id);
        if (!l) return null;
        return {
          score: l.score,
          confidence: l.confidence,
          band: likelihoodBand(l.score),
          rationale: l.rationale,
        };
      })(),
    };
  });

  const details: Record<string, ContactDetail> = Object.fromEntries(
    allContacts.map((c) => {
      const title = c.fields.find((f) => f.key === "title")?.value ?? null;
      const outletFromField = c.fields.find((f) => f.key === "outletName")?.value;
      const outletFromJoin = c.outlets[0]?.outlet.name ?? null;
      return [
        c.id,
        {
          id: c.id,
          name: c.name,
          avatarUrl: c.avatarUrl,
          kind: c.kind,
          title,
          outletName: outletFromJoin ?? outletFromField ?? null,
          email: c.email,
          bio: c.bio,
          beats: c.beats.map((b) => b.beat.name),
          fields: c.fields,
          recentWork: c.recentWork,
          likelihood: (() => {
            const l = likelihoodMap.get(c.id);
            if (!l) return null;
            return {
              score: l.score,
              confidence: l.confidence,
              band: likelihoodBand(l.score),
              rationale: l.rationale,
              breakdown: l.breakdown,
            };
          })(),
        },
      ];
    }),
  );

  // Sort by behavioral likelihood first (the headline signal), then topical
  // match, then name. When no contact has any behavioral data (all zero) this
  // degrades gracefully to match/name ordering.
  rows.sort(
    (a, b) =>
      (b.likelihood?.score ?? -1) - (a.likelihood?.score ?? -1) ||
      (b.matchScore ?? -1) - (a.matchScore ?? -1) ||
      a.name.localeCompare(b.name),
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl text-brand-navy">
            Target Compilation
          </h1>
          <p className="text-sm text-muted-foreground">
            The shared directory + your brand&apos;s additions, ranked by{" "}
            <span className="font-medium text-brand-navy">
              Likelihood to Cover
            </span>{" "}
            — a behavioral score from prior replies, recent coverage, and
            competitor activity. Brand-scoped; open a contact to see why.
          </p>
        </div>
        <CampaignSwitcher
          current={campaign ? { id: campaign.id, title: campaign.title } : null}
          options={campaigns}
          basePath="/dashboard/strategize/targets"
        />
      </header>

      {campaign && (
        <div className="flex justify-end">
          <Link
            href={`/dashboard/draft/pitches?campaignId=${campaign.id}`}
            className="rounded-lg bg-brand-pink px-5 py-2.5 text-sm font-medium text-white hover:opacity-90"
          >
            Next: Draft pitches →
          </Link>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
        <AddContactForm />
        <TargetsShell
          campaignId={campaign?.id ?? null}
          primaryAngleTitle={campaign?.primaryAngle?.title ?? null}
          contacts={rows}
          contactDetails={details}
          discovery={discovery}
          enrichPartners={enrichPartners}
          lists={mediaLists}
        />
      </div>
    </div>
  );
}
