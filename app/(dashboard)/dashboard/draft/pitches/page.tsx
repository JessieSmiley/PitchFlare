import { requireTenant } from "@/lib/auth/tenant";
import { db } from "@/lib/db";
import { CampaignSwitcher } from "@/components/strategize/campaign-switcher";
import {
  PitchComposer,
  type PitchRow,
} from "@/components/draft/pitch-composer";

export const dynamic = "force-dynamic";

export default async function PitchesPage({
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
            mediaLists: {
              orderBy: { createdAt: "desc" },
              take: 1,
              include: {
                members: {
                  orderBy: [{ tier: "asc" }, { matchScore: "desc" }],
                  include: {
                    contact: {
                      select: {
                        id: true,
                        name: true,
                        email: true,
                        kind: true,
                        outlets: {
                          where: { isPrimary: true },
                          take: 1,
                          include: { outlet: { select: { name: true } } },
                        },
                        recentWork: {
                          select: { title: true },
                          orderBy: { publishedAt: "desc" },
                          take: 5,
                        },
                      },
                    },
                  },
                },
              },
            },
            pitches: {
              select: {
                id: true,
                contactId: true,
                subject: true,
                body: true,
                status: true,
              },
            },
          },
        })
      : Promise.resolve(null),
  ]);

  let rows: PitchRow[] = [];
  if (campaign) {
    const mediaList = campaign.mediaLists[0];
    const pitchesByContact = new Map(
      campaign.pitches.map((p) => [p.contactId ?? "", p]),
    );

    const contacts = mediaList
      ? mediaList.members.map((m) => m.contact)
      : // Fallback: if no media list yet, use all pitches' contacts so the
        // user can still draft for contacts they've written to before.
        campaign.pitches
          .filter((p) => p.contactId)
          .map((p) => ({
            id: p.contactId!,
            name: "—",
            email: null,
            kind: "JOURNALIST",
            outlets: [],
            recentWork: [],
          }));

    rows = contacts.map((c) => {
      const p = pitchesByContact.get(c.id);
      return {
        pitchId: p?.id ?? null,
        status: (p?.status ?? "NONE") as PitchRow["status"],
        subject: p?.subject ?? "",
        body: p?.body ?? "",
        contact: {
          id: c.id,
          name: c.name,
          email: c.email,
          outletName: c.outlets[0]?.outlet.name ?? null,
          kind: c.kind,
          recentWorkTitles: c.recentWork.map((rw) => rw.title),
        },
      };
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl text-brand-navy">Pitches</h1>
          <p className="text-sm text-muted-foreground">
            Personalised drafts per contact. The AI sees brand context,
            campaign setup, primary angle, and the contact&apos;s recent work.
          </p>
        </div>
        <CampaignSwitcher
          current={campaign ? { id: campaign.id, title: campaign.title } : null}
          options={campaigns}
          basePath="/dashboard/draft/pitches"
        />
      </header>

      {campaign ? (
        rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
            No targets on this campaign. Build a media list on the Targets
            screen, then come back here.
          </div>
        ) : (
          <PitchComposer
            campaignId={campaign.id}
            rows={rows}
            opusByDefault={false}
          />
        )
      ) : (
        <div className="rounded-lg border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
          Pick or create a campaign on the Ideation screen first.
        </div>
      )}
    </div>
  );
}
