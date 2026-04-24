import { requireTenant } from "@/lib/auth/tenant";
import { db } from "@/lib/db";
import { CampaignSwitcher } from "@/components/strategize/campaign-switcher";
import {
  AnalyzeShell,
  type ClipRow,
  type MentionRow,
  type Metrics,
} from "@/components/analyze/analyze-shell";

export const dynamic = "force-dynamic";

export default async function AnalyzePage({
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

  const campaigns = await db.campaign.findMany({
    where: { brandId },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true },
  });

  if (!campaignId) {
    return (
      <div className="flex flex-col gap-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-4xl text-brand-navy">Analyze</h1>
            <p className="text-sm text-muted-foreground">
              Coverage feed, sentiment, reach, and Share of Voice per
              campaign.
            </p>
          </div>
          <CampaignSwitcher
            current={null}
            options={campaigns}
            basePath="/dashboard/analyze"
          />
        </header>
        <div className="rounded-lg border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
          Pick a campaign to see its clips, mentions, and metrics.
        </div>
      </div>
    );
  }

  const campaign = await db.campaign.findFirst({
    where: { id: campaignId, brandId },
    include: {
      coverageClips: {
        orderBy: { publishedAt: "desc" },
        take: 100,
        select: {
          id: true,
          url: true,
          headline: true,
          publishedAt: true,
          reachEstimate: true,
          sentimentScore: true,
          sentimentLabel: true,
          outlet: { select: { name: true } },
        },
      },
      monitoringQueries: {
        select: {
          id: true,
          mentions: {
            where: { coverageClip: null },
            orderBy: { publishedAt: "desc" },
            take: 50,
            select: {
              id: true,
              title: true,
              url: true,
              outletName: true,
              publishedAt: true,
            },
          },
        },
      },
    },
  });
  if (!campaign) {
    return <p className="text-sm text-destructive">Campaign not found.</p>;
  }

  const clips: ClipRow[] = campaign.coverageClips.map((c) => ({
    id: c.id,
    url: c.url,
    headline: c.headline,
    outletName: c.outlet?.name ?? null,
    publishedAt: c.publishedAt,
    sentimentLabel: c.sentimentLabel,
    reachEstimate: c.reachEstimate,
  }));

  const mentions: MentionRow[] = campaign.monitoringQueries.flatMap((q) =>
    q.mentions.map((m) => ({
      id: m.id,
      title: m.title,
      url: m.url,
      outletName: m.outletName,
      publishedAt: m.publishedAt,
    })),
  );

  // Metrics roll-up.
  const totalReach = clips.reduce((s, c) => s + (c.reachEstimate ?? 0), 0);
  const scoredClips = campaign.coverageClips.filter(
    (c): c is typeof c & { sentimentScore: number } =>
      typeof c.sentimentScore === "number",
  );
  const avgSentiment = scoredClips.length
    ? scoredClips.reduce((s, c) => s + c.sentimentScore, 0) / scoredClips.length
    : null;

  // SoV is "brand mentions / (brand + competitor mentions)" across the
  // brand's Competitor list. Loose approximation until Chunk I adds real
  // per-competitor monitoring queries.
  const competitorCount = await db.competitor.count({ where: { brandId } });
  const sov = competitorCount > 0 && clips.length > 0
    ? clips.length / (clips.length + competitorCount)
    : null;

  const metrics: Metrics = {
    totalClips: clips.length,
    totalReach,
    sentimentScore: avgSentiment,
    sov,
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl text-brand-navy">Analyze</h1>
          <p className="text-sm text-muted-foreground">
            Coverage for{" "}
            <span className="font-medium text-brand-navy">{campaign.title}</span>
            .
          </p>
        </div>
        <CampaignSwitcher
          current={{ id: campaign.id, title: campaign.title }}
          options={campaigns}
          basePath="/dashboard/analyze"
        />
      </header>

      <AnalyzeShell
        campaignId={campaign.id}
        metrics={metrics}
        clips={clips}
        mentions={mentions}
      />
    </div>
  );
}
