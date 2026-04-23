import { requireTenant } from "@/lib/auth/tenant";
import { db } from "@/lib/db";
import { CampaignForm } from "@/components/strategize/campaign-form";
import { IdeationCanvas } from "@/components/strategize/ideation-canvas";
import { CampaignSwitcher } from "@/components/strategize/campaign-switcher";

export const dynamic = "force-dynamic";

export default async function IdeationPage({
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

  const [campaigns, campaign] = await Promise.all([
    db.campaign.findMany({
      where: { brandId },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true },
    }),
    campaignId
      ? db.campaign.findFirst({
          where: { id: campaignId, brandId },
          include: {
            angles: {
              orderBy: [
                { newsworthinessScore: "desc" },
                { createdAt: "desc" },
              ],
              select: {
                id: true,
                title: true,
                hook: true,
                rationale: true,
                mediaFit: true,
                risk: true,
                newsworthinessScore: true,
                audienceFit: true,
              },
            },
          },
        })
      : Promise.resolve(null),
  ]);

  const initialCampaignValue = {
    title: campaign?.title ?? "",
    objective: campaign?.objective ?? "",
    goalType: (campaign?.goalType ?? "") as
      | ""
      | "AWARENESS"
      | "THOUGHT_LEADERSHIP"
      | "LAUNCH"
      | "CRISIS_RESPONSE"
      | "FUNDING"
      | "PARTNERSHIP",
    toneTags: campaign?.toneTags ?? [],
    budgetRange: (campaign?.budgetRange ?? "") as
      | ""
      | "Under $5k"
      | "$5k-$25k"
      | "$25k-$100k"
      | "$100k+",
    marketSentimentNotes: campaign?.marketSentimentNotes ?? "",
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl text-brand-navy">Strategize</h1>
          <p className="text-sm text-muted-foreground">
            Set up the campaign, then generate angles. The AI sees your Level-Set
            context on every call.
          </p>
        </div>
        <CampaignSwitcher
          current={campaign ? { id: campaign.id, title: campaign.title } : null}
          options={campaigns}
          basePath="/dashboard/strategize/ideation"
        />
      </header>

      <div className="grid gap-6 lg:grid-cols-[2fr_3fr]">
        <CampaignForm
          campaignId={campaign?.id}
          initial={initialCampaignValue}
        />

        {campaign ? (
          <IdeationCanvas
            campaignId={campaign.id}
            primaryAngleId={campaign.primaryAngleId}
            angles={campaign.angles}
          />
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
            Create the campaign on the left to unlock angle generation.
          </div>
        )}
      </div>
    </div>
  );
}
