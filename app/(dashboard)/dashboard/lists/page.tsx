import Link from "next/link";
import { requireTenant } from "@/lib/auth/tenant";
import { db } from "@/lib/db";
import { CreateListButton } from "@/components/lists/create-list-button";

export const dynamic = "force-dynamic";

export default async function ListsPage() {
  const tenant = await requireTenant();
  if (!tenant.brand) {
    return <p className="text-sm text-muted-foreground">Pick a brand first.</p>;
  }
  const brandId = tenant.brand.id;

  const [lists, campaigns] = await Promise.all([
    db.mediaList.findMany({
      where: { brandId },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        updatedAt: true,
        campaign: { select: { id: true, title: true } },
        _count: { select: { members: true } },
      },
    }),
    db.campaign.findMany({
      where: { brandId },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true },
    }),
  ]);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl text-brand-navy">Media Lists</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Saved sets of contacts — build them from the directory, then pitch,
            export, or reuse them across campaigns.
          </p>
        </div>
        <CreateListButton campaigns={campaigns} />
      </header>

      {lists.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
          <h2 className="font-display text-xl text-brand-navy">No lists yet</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Create a list here, or add contacts to one from{" "}
            <Link
              href="/dashboard/strategize/targets"
              className="text-brand-pink hover:underline"
            >
              Target Compilation
            </Link>{" "}
            — select contacts or open a profile and choose &ldquo;Add to
            list&rdquo;.
          </p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {lists.map((l) => (
            <li key={l.id}>
              <Link
                href={`/dashboard/lists/${l.id}`}
                className="flex h-full flex-col rounded-xl border border-border bg-card p-5 transition hover:border-brand-pink"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-display text-lg text-brand-navy">
                    {l.name}
                  </h2>
                  <span className="shrink-0 rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground">
                    {l._count.members} contact
                    {l._count.members === 1 ? "" : "s"}
                  </span>
                </div>
                {l.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {l.description}
                  </p>
                )}
                <div className="mt-auto flex items-center gap-2 pt-4 text-xs text-muted-foreground">
                  {l.campaign ? (
                    <span className="rounded-full bg-brand-mist px-2 py-0.5 text-brand-navy">
                      {l.campaign.title}
                    </span>
                  ) : (
                    <span className="rounded-full bg-brand-mist px-2 py-0.5">
                      Standalone
                    </span>
                  )}
                  <span>
                    Updated{" "}
                    {l.updatedAt.toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
