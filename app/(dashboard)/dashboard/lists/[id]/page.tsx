import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTenant } from "@/lib/auth/tenant";
import { db } from "@/lib/db";
import {
  resolveCampaignTopicTerms,
  scoreContactsLikelihood,
} from "@/lib/contacts/likelihood-service";
import { likelihoodBand } from "@/lib/contacts/likelihood";
import { LikelihoodPill } from "@/components/targets/likelihood-pill";
import { ListHeaderActions } from "@/components/lists/list-header-actions";
import { RemoveMemberButton } from "@/components/lists/remove-member-button";
import { ExportListButton } from "@/components/lists/export-list-button";
import { PitchListButton } from "@/components/lists/pitch-list-button";

export const dynamic = "force-dynamic";

const KIND_LABELS: Record<string, string> = {
  JOURNALIST: "Journalist",
  PODCASTER: "Podcaster",
  INFLUENCER: "Influencer",
  ANALYST: "Analyst",
  OUTLET: "Outlet",
};

export default async function ListDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const tenant = await requireTenant();
  if (!tenant.brand) {
    return <p className="text-sm text-muted-foreground">Pick a brand first.</p>;
  }
  const brandId = tenant.brand.id;
  const { id } = await params;

  const [list, campaigns] = await Promise.all([
    db.mediaList.findFirst({
    where: { id, brandId },
    select: {
      id: true,
      name: true,
      description: true,
      campaign: { select: { id: true, title: true } },
      members: {
        orderBy: { id: "asc" },
        select: {
          contact: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
              kind: true,
              beats: { include: { beat: { select: { name: true } } } },
              outlets: {
                where: { isPrimary: true },
                take: 1,
                include: { outlet: { select: { name: true } } },
              },
              fields: { select: { key: true, value: true, source: true } },
              recentWork: {
                select: { title: true, excerpt: true, publishedAt: true },
                orderBy: { publishedAt: "desc" },
                take: 30,
              },
            },
          },
        },
      },
    },
    }),
    db.campaign.findMany({
      where: { brandId },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true },
    }),
  ]);

  if (!list) notFound();

  const contacts = list.members.map((m) => m.contact);

  const topicTerms = list.campaign
    ? await resolveCampaignTopicTerms(brandId, list.campaign.id)
    : [];

  const likelihoodMap = await scoreContactsLikelihood(
    brandId,
    contacts.map((c) => ({
      contactId: c.id,
      recentWork: c.recentWork,
      fields: c.fields,
    })),
    { topicTerms },
  );

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div>
        <Link
          href="/dashboard/lists"
          className="text-xs text-muted-foreground hover:text-brand-navy"
        >
          ← All lists
        </Link>
        <header className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-4xl text-brand-navy">
                {list.name}
              </h1>
              {list.campaign ? (
                <span className="rounded-full bg-brand-mist px-2.5 py-0.5 text-xs font-medium text-brand-navy">
                  {list.campaign.title}
                </span>
              ) : (
                <span className="rounded-full bg-brand-mist px-2.5 py-0.5 text-xs text-muted-foreground">
                  Standalone
                </span>
              )}
            </div>
            {list.description && (
              <p className="mt-1 text-sm text-muted-foreground">
                {list.description}
              </p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              {contacts.length} contact{contacts.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/dashboard/strategize/targets"
              className="rounded-lg border border-border px-3 py-2 text-sm text-brand-navy hover:border-brand-pink"
            >
              + Add contacts
            </Link>
            {contacts.length > 0 && (
              <>
                <ExportListButton listId={list.id} />
                <PitchListButton
                  listId={list.id}
                  campaign={list.campaign}
                  campaigns={campaigns}
                />
              </>
            )}
            <ListHeaderActions
              listId={list.id}
              name={list.name}
              description={list.description}
            />
          </div>
        </header>
      </div>

      {contacts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            This list is empty. Add contacts from{" "}
            <Link
              href="/dashboard/strategize/targets"
              className="text-brand-pink hover:underline"
            >
              Target Compilation
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="p-3 font-medium">Contact</th>
                <th className="p-3 font-medium">Outlet</th>
                <th className="p-3 font-medium">Beats</th>
                <th className="p-3 font-medium">Likelihood to Cover</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => {
                const l = likelihoodMap.get(c.id);
                const title = c.fields.find((f) => f.key === "title")?.value;
                const outlet =
                  c.outlets[0]?.outlet.name ??
                  c.fields.find((f) => f.key === "outletName")?.value ??
                  "—";
                return (
                  <tr key={c.id} className="border-t border-border">
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-xs font-medium text-accent-foreground">
                          {c.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-medium text-brand-navy">
                            {c.name}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">
                            {title ?? KIND_LABELS[c.kind] ?? c.kind}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-brand-navy">{outlet}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {c.beats.slice(0, 3).map((b) => (
                          <span
                            key={b.beat.name}
                            className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
                          >
                            {b.beat.name}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="max-w-xs p-3">
                      {l ? (
                        <div className="flex flex-col gap-1">
                          <LikelihoodPill
                            score={l.score}
                            band={likelihoodBand(l.score)}
                            confidence={l.confidence}
                          />
                          {l.rationale && (
                            <span className="line-clamp-2 text-[11px] leading-snug text-muted-foreground">
                              {l.rationale}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <RemoveMemberButton listId={list.id} contactId={c.id} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
