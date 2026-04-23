import { requireTenant } from "@/lib/auth/tenant";
import { db } from "@/lib/db";
import { AddContactForm } from "@/components/targets/add-contact-form";
import { TargetsShell } from "@/components/targets/targets-shell";
import { CampaignSwitcher } from "@/components/strategize/campaign-switcher";
import { scoreContactsForCampaign } from "@/lib/contacts/match";
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
          include: { primaryAngle: true },
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
          select: { title: true, url: true, source: true },
          orderBy: { publishedAt: "desc" },
          take: 10,
        },
      },
    }),
  ]);

  // If the campaign has a primary angle, score contacts against it so the
  // table surfaces a "Match" column out of the gate.
  const scoreMap = new Map<string, number>();
  if (campaign?.primaryAngle) {
    const angleTerms = [
      campaign.title,
      campaign.objective,
      campaign.primaryAngle.title,
      campaign.primaryAngle.hook,
      campaign.primaryAngle.audienceFit,
      ...(campaign.toneTags ?? []),
    ].filter((s): s is string => Boolean(s && s.length));

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
        },
      ];
    }),
  );

  // Sort the table so highest-matching contacts surface first when a
  // primary angle is set; otherwise keep by createdAt desc.
  if (scoreMap.size > 0) {
    rows.sort(
      (a, b) =>
        (b.matchScore ?? -1) - (a.matchScore ?? -1) || a.name.localeCompare(b.name),
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl text-brand-navy">
            Target Compilation
          </h1>
          <p className="text-sm text-muted-foreground">
            The shared directory + your brand&apos;s additions. Scores are
            brand-scoped and update with your primary angle.
          </p>
        </div>
        <CampaignSwitcher
          current={campaign ? { id: campaign.id, title: campaign.title } : null}
          options={campaigns}
          basePath="/dashboard/strategize/targets"
        />
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
        <AddContactForm />
        <TargetsShell
          campaignId={campaign?.id ?? null}
          primaryAngleTitle={campaign?.primaryAngle?.title ?? null}
          contacts={rows}
          contactDetails={details}
        />
      </div>
    </div>
  );
}
