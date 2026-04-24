import { requireTenant } from "@/lib/auth/tenant";
import { db } from "@/lib/db";
import { CampaignSwitcher } from "@/components/strategize/campaign-switcher";
import { SendQueue, type QueueRow } from "@/components/execute/send-queue";

export const dynamic = "force-dynamic";

export default async function ExecuteEmailPage({
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

  const campaign = campaignId
    ? await db.campaign.findFirst({
        where: { id: campaignId, brandId },
        include: {
          pitches: {
            where: {
              status: {
                in: ["APPROVED", "SENT", "OPENED", "REPLIED", "PLACED", "NO_RESPONSE"],
              },
            },
            include: {
              contact: { select: { id: true, name: true, email: true } },
              sends: {
                select: { openedAt: true, firstClickedAt: true },
                orderBy: { sentAt: "desc" },
                take: 1,
              },
            },
            orderBy: [{ status: "asc" }, { createdAt: "asc" }],
          },
        },
      })
    : null;

  const rows: QueueRow[] = (campaign?.pitches ?? []).map((p) => ({
    pitchId: p.id,
    subject: p.subject,
    status: p.status,
    sentAt: p.sentAt,
    openedAt: p.sends[0]?.openedAt ?? null,
    firstClickedAt: p.sends[0]?.firstClickedAt ?? null,
    contact: {
      id: p.contact?.id ?? "",
      name: p.contact?.name ?? "—",
      email: p.contact?.email ?? null,
    },
  }));

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl text-brand-navy">
            Direct Email
          </h1>
          <p className="text-sm text-muted-foreground">
            Send approved pitches one at a time (never BCC). Opens + clicks
            track automatically via injected pixel + link wrapper.
          </p>
        </div>
        <CampaignSwitcher
          current={campaign ? { id: campaign.id, title: campaign.title } : null}
          options={campaigns}
          basePath="/dashboard/execute/email"
        />
      </header>

      {!campaign ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
          Pick a campaign to view its send queue.
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
          No approved or sent pitches on this campaign yet. Approve drafts
          on the Pitches screen first.
        </div>
      ) : (
        <SendQueue rows={rows} />
      )}
    </div>
  );
}
