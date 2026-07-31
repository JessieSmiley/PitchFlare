import { requireTenant } from "@/lib/auth/tenant";
import { db } from "@/lib/db";
import { CampaignSwitcher } from "@/components/strategize/campaign-switcher";
import {
  PitchComposer,
  BROAD_PITCH_KEY,
  type PitchRow,
} from "@/components/draft/pitch-composer";

export const dynamic = "force-dynamic";

// Contact shape shared by the campaign's media list and an explicitly-chosen
// list, so both paths build PitchRows identically.
const contactSelect = {
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
    orderBy: { publishedAt: "desc" as const },
    take: 5,
  },
} as const;

export default async function PitchesPage({
  searchParams,
}: {
  searchParams: Promise<{ campaignId?: string; listId?: string }>;
}) {
  const tenant = await requireTenant();
  if (!tenant.brand) {
    return <p className="text-sm text-muted-foreground">Pick a brand first.</p>;
  }
  const brandId = tenant.brand.id;
  const params = await searchParams;
  const listId = params.listId ?? null;

  // When a specific list is chosen ("Pitch this list"), load it and prefer its
  // campaign; a standalone list falls back to the campaignId in the URL.
  const [campaigns, list] = await Promise.all([
    db.campaign.findMany({
      where: { brandId },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true },
    }),
    listId
      ? db.mediaList.findFirst({
          where: { id: listId, brandId },
          select: {
            id: true,
            name: true,
            campaignId: true,
            members: {
              orderBy: [{ tier: "asc" }, { matchScore: "desc" }],
              select: { contact: { select: contactSelect } },
            },
          },
        })
      : Promise.resolve(null),
  ]);

  const effectiveCampaignId = list?.campaignId ?? params.campaignId ?? null;

  const campaign = effectiveCampaignId
    ? await db.campaign.findFirst({
        where: { id: effectiveCampaignId, brandId },
        include: {
          mediaLists: {
            orderBy: { createdAt: "desc" },
            take: 1,
            include: {
              members: {
                orderBy: [{ tier: "asc" }, { matchScore: "desc" }],
                include: { contact: { select: contactSelect } },
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
    : null;

  let rows: PitchRow[] = [];
  if (campaign) {
    const pitchesByContact = new Map(
      campaign.pitches.map((p) => [p.contactId ?? "", p]),
    );

    // Priority: an explicitly chosen list → the campaign's latest media list →
    // contacts the user has already drafted for on this campaign.
    const contacts = list
      ? list.members.map((m) => m.contact)
      : campaign.mediaLists[0]
        ? campaign.mediaLists[0].members.map((m) => m.contact)
        : campaign.pitches
            .filter((p) => p.contactId)
            .map((p) => ({
              id: p.contactId!,
              name: "—",
              email: null,
              kind: "JOURNALIST",
              outlets: [] as { outlet: { name: string } }[],
              recentWork: [] as { title: string }[],
            }));

    const contactRows: PitchRow[] = contacts.map((c) => {
      const p = pitchesByContact.get(c.id);
      return {
        key: c.id,
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

    // The broader pitch (no target) is always available. Reuse an editable
    // targetless draft if one exists so its status/text round-trip.
    const broadPitch =
      campaign.pitches.find(
        (p) =>
          !p.contactId && (p.status === "DRAFT" || p.status === "APPROVED"),
      ) ?? campaign.pitches.find((p) => !p.contactId) ?? null;

    const broadRow: PitchRow = {
      key: BROAD_PITCH_KEY,
      pitchId: broadPitch?.id ?? null,
      status: (broadPitch?.status ?? "NONE") as PitchRow["status"],
      subject: broadPitch?.subject ?? "",
      body: broadPitch?.body ?? "",
      contact: null,
    };

    rows = [broadRow, ...contactRows];
  }

  // A standalone list with no campaign to draft under can't produce pitches.
  const listNeedsCampaign = Boolean(list) && !effectiveCampaignId;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl text-brand-navy">Pitches</h1>
          <p className="text-sm text-muted-foreground">
            Personalised drafts per contact, or a broader pitch with no target
            selected. The AI sees brand context, campaign setup, primary angle,
            and — when a contact is chosen — their recent work.
          </p>
          {list && (
            <p className="mt-1 inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
              Pitching list: {list.name} · {list.members.length} contact
              {list.members.length === 1 ? "" : "s"}
            </p>
          )}
        </div>
        <CampaignSwitcher
          current={campaign ? { id: campaign.id, title: campaign.title } : null}
          options={campaigns}
          basePath="/dashboard/draft/pitches"
        />
      </header>

      {listNeedsCampaign ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
          &ldquo;{list?.name}&rdquo; isn&apos;t attached to a campaign. Pitches
          belong to a campaign — pick one from the switcher above to draft for
          this list.
        </div>
      ) : campaign ? (
        <PitchComposer
          campaignId={campaign.id}
          rows={rows}
          opusByDefault={false}
        />
      ) : (
        <div className="rounded-lg border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
          Pick or create a campaign on the Ideation screen first.
        </div>
      )}
    </div>
  );
}
