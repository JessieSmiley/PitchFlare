import { db } from "@/lib/db";
import { getBrandContextForAI } from "@/lib/brand/context";
import { computeBrandCompletion } from "@/lib/brand/completion";
import type { CampaignPhase, CampaignStatus } from "@prisma/client";

export type DeadlineKind = "LAUNCH" | "EMBARGO" | "TIMELINE_END";

export type UpcomingDeadline = {
  brandId: string;
  brandName: string;
  brandSlug: string;
  campaignId: string;
  campaignTitle: string;
  kind: DeadlineKind;
  date: Date;
  daysAway: number;
};

export type CampaignSnapshot = {
  id: string;
  title: string;
  status: CampaignStatus;
  phase: CampaignPhase;
  updatedAt: Date;
  launchDate: Date | null;
  embargoDate: Date | null;
  timelineEnd: Date | null;
  counts: {
    angles: number;
    pitches: number;
    pressReleases: number;
    socialPosts: number;
    coverageClips: number;
  };
};

export type BrandSnapshot = {
  id: string;
  name: string;
  slug: string;
  completion: number;
  totalCampaigns: number;
  activeCampaigns: number;
  coverageClips: number;
  campaigns: CampaignSnapshot[];
};

export type AccountOverview = {
  brands: BrandSnapshot[];
  totals: {
    brands: number;
    campaigns: number;
    activeCampaigns: number;
    coverageClips: number;
    upcomingDeadlines: number;
  };
  upcomingDeadlines: UpcomingDeadline[];
};

const ACTIVE_STATUSES: CampaignStatus[] = ["ACTIVE", "DRAFT", "PAUSED"];

function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

/**
 * Aggregate everything an account is working on, organized by brand: campaign
 * status, per-phase progress counts, brand-profile completeness, and the
 * upcoming deadlines that drive the dashboard. Scoped to the brands the
 * current user can access within the account.
 */
export async function getAccountOverview(
  accountId: string,
  userId: string,
): Promise<AccountOverview> {
  const brands = await db.brand.findMany({
    where: { accountId, memberships: { some: { userId } } },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, slug: true },
  });

  const now = new Date();

  const brandSnapshots: BrandSnapshot[] = await Promise.all(
    brands.map(async (brand) => {
      const [campaigns, coverageClips, ctx] = await Promise.all([
        db.campaign.findMany({
          where: { brandId: brand.id },
          orderBy: { updatedAt: "desc" },
          select: {
            id: true,
            title: true,
            status: true,
            phase: true,
            updatedAt: true,
            launchDate: true,
            embargoDate: true,
            timelineEnd: true,
            _count: {
              select: {
                angles: true,
                pitches: true,
                pressReleases: true,
                socialPosts: true,
                coverageClips: true,
              },
            },
          },
        }),
        db.coverageClip.count({ where: { brandId: brand.id } }),
        getBrandContextForAI(brand.id),
      ]);

      const completion = computeBrandCompletion(ctx).score;

      const campaignSnapshots: CampaignSnapshot[] = campaigns.map((c) => ({
        id: c.id,
        title: c.title,
        status: c.status,
        phase: c.phase,
        updatedAt: c.updatedAt,
        launchDate: c.launchDate,
        embargoDate: c.embargoDate,
        timelineEnd: c.timelineEnd,
        counts: {
          angles: c._count.angles,
          pitches: c._count.pitches,
          pressReleases: c._count.pressReleases,
          socialPosts: c._count.socialPosts,
          coverageClips: c._count.coverageClips,
        },
      }));

      return {
        id: brand.id,
        name: brand.name,
        slug: brand.slug,
        completion,
        totalCampaigns: campaigns.length,
        activeCampaigns: campaigns.filter((c) =>
          ACTIVE_STATUSES.includes(c.status),
        ).length,
        coverageClips,
        campaigns: campaignSnapshots,
      };
    }),
  );

  // Flatten every future-dated milestone into a single sorted timeline.
  const deadlines: UpcomingDeadline[] = [];
  for (const brand of brandSnapshots) {
    for (const c of brand.campaigns) {
      if (c.status === "COMPLETED" || c.status === "ARCHIVED") continue;
      const milestones: Array<{ kind: DeadlineKind; date: Date | null }> = [
        { kind: "LAUNCH", date: c.launchDate },
        { kind: "EMBARGO", date: c.embargoDate },
        { kind: "TIMELINE_END", date: c.timelineEnd },
      ];
      for (const m of milestones) {
        if (!m.date) continue;
        if (m.date.getTime() < now.getTime()) continue;
        deadlines.push({
          brandId: brand.id,
          brandName: brand.name,
          brandSlug: brand.slug,
          campaignId: c.id,
          campaignTitle: c.title,
          kind: m.kind,
          date: m.date,
          daysAway: daysBetween(now, m.date),
        });
      }
    }
  }
  deadlines.sort((a, b) => a.date.getTime() - b.date.getTime());

  const totals = brandSnapshots.reduce(
    (acc, b) => {
      acc.campaigns += b.totalCampaigns;
      acc.activeCampaigns += b.activeCampaigns;
      acc.coverageClips += b.coverageClips;
      return acc;
    },
    { campaigns: 0, activeCampaigns: 0, coverageClips: 0 },
  );

  return {
    brands: brandSnapshots,
    totals: {
      brands: brandSnapshots.length,
      campaigns: totals.campaigns,
      activeCampaigns: totals.activeCampaigns,
      coverageClips: totals.coverageClips,
      upcomingDeadlines: deadlines.length,
    },
    upcomingDeadlines: deadlines,
  };
}
