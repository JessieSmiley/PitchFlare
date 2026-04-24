import { requireTenant } from "@/lib/auth/tenant";
import { db } from "@/lib/db";
import { CampaignSwitcher } from "@/components/strategize/campaign-switcher";
import { ReportTriggers } from "@/components/report/report-triggers";

export const dynamic = "force-dynamic";

export default async function ReportPage({
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
            <h1 className="font-display text-4xl text-brand-navy">Report</h1>
            <p className="text-sm text-muted-foreground">
              On-demand Status Reports, Media Briefs, and Talking Points —
              branded PDF exports for clients and spokespeople.
            </p>
          </div>
          <CampaignSwitcher
            current={null}
            options={campaigns}
            basePath="/dashboard/report"
          />
        </header>
        <div className="rounded-lg border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
          Pick a campaign to generate its reports.
        </div>
      </div>
    );
  }

  const campaign = await db.campaign.findFirst({
    where: { id: campaignId, brandId },
    select: { id: true, title: true },
  });
  if (!campaign) {
    return <p className="text-sm text-destructive">Campaign not found.</p>;
  }

  // Contacts available as Media Brief targets: members of any MediaList
  // for this campaign, plus anyone we've already sent a pitch to.
  const contactRows = await db.contact.findMany({
    where: {
      OR: [
        {
          mediaLists: {
            some: { mediaList: { campaignId: campaign.id } },
          },
        },
        { pitches: { some: { campaignId: campaign.id } } },
      ],
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: 100,
  });

  const [statusDocs, briefDocs, tpDocs] = await Promise.all([
    db.statusReportDoc.findMany({
      where: { campaignId: campaign.id },
      orderBy: { generatedAt: "desc" },
      take: 10,
      select: { id: true, generatedAt: true },
    }),
    db.mediaBriefDoc.findMany({
      where: { campaignId: campaign.id },
      orderBy: { generatedAt: "desc" },
      take: 20,
      include: { contact: { select: { name: true } } },
    }),
    db.talkingPointsDoc.findMany({
      where: { campaignId: campaign.id },
      orderBy: { generatedAt: "desc" },
      take: 10,
      select: { id: true, generatedAt: true },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl text-brand-navy">Report</h1>
          <p className="text-sm text-muted-foreground">
            Generating for{" "}
            <span className="font-medium text-brand-navy">{campaign.title}</span>
            .
          </p>
        </div>
        <CampaignSwitcher
          current={{ id: campaign.id, title: campaign.title }}
          options={campaigns}
          basePath="/dashboard/report"
        />
      </header>

      <ReportTriggers
        campaignId={campaign.id}
        contacts={contactRows}
        statusReports={statusDocs.map((d) => ({
          id: d.id,
          generatedAt: d.generatedAt,
          title: `Status · ${d.generatedAt.toLocaleDateString()}`,
        }))}
        mediaBriefs={briefDocs.map((d) => ({
          id: d.id,
          generatedAt: d.generatedAt,
          title: `Brief · ${d.contact.name}`,
        }))}
        talkingPoints={tpDocs.map((d) => ({
          id: d.id,
          generatedAt: d.generatedAt,
          title: `Talking points · ${d.generatedAt.toLocaleDateString()}`,
        }))}
      />
    </div>
  );
}
