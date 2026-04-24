import { requireTenant } from "@/lib/auth/tenant";
import { db } from "@/lib/db";
import { maskSecret } from "@/lib/crypto";
import { PROVIDERS } from "@/lib/providers";
import {
  PartnerCards,
  type PartnerCard,
} from "@/components/integrations/partner-cards";

export const dynamic = "force-dynamic";

const META: Record<
  "HUNTER" | "APOLLO" | "PODCHASER" | "SPARKTORO",
  { fieldCoverage: string[]; costNote: string }
> = {
  HUNTER: {
    fieldCoverage: ["email", "title", "outletName", "linkedinUrl", "twitterUrl", "phone", "confidence"],
    costNote:
      "Credits count against your own Hunter.io plan. We store your key encrypted and never use it beyond your own enrichment requests.",
  },
  APOLLO: {
    fieldCoverage: ["email", "title", "outletName", "linkedinUrl", "twitterUrl"],
    costNote: "Not yet connected — ships in a later release.",
  },
  PODCHASER: {
    fieldCoverage: ["hostName", "showName", "showCategory", "episodeCount"],
    costNote: "Not yet connected — ships in a later release.",
  },
  SPARKTORO: {
    fieldCoverage: ["audienceTopics", "socialHandles", "podcastAppearances"],
    costNote: "Not yet connected — ships in a later release.",
  },
};

export default async function IntegrationsPage() {
  const tenant = await requireTenant();
  const integrations = await db.integration.findMany({
    where: {
      accountId: tenant.account.id,
      partner: { in: ["HUNTER", "APOLLO", "PODCHASER", "SPARKTORO"] },
    },
  });

  const byPartner = new Map(integrations.map((i) => [i.partner, i]));

  const cards: PartnerCard[] = PROVIDERS.map((p) => {
    const existing = byPartner.get(p.partner);
    const meta = META[p.partner as keyof typeof META];
    return {
      partner: p.partner as PartnerCard["partner"],
      label: p.label,
      supported: p.supports({
        fullName: "A B",
        domain: "x.com",
        firstName: "A",
        lastName: "B",
      }),
      fieldCoverage: meta.fieldCoverage,
      costNote: meta.costNote,
      existing: existing
        ? {
            id: existing.id,
            maskedKey: maskSecret(existing.encryptedCredentials),
            status: existing.status,
            lastSyncAt: existing.lastSyncAt,
            lastError: existing.lastError,
          }
        : null,
    };
  });

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="font-display text-4xl text-brand-navy">Integrations</h1>
        <p className="text-sm text-muted-foreground">
          Bring-your-own-account data partners. Your API keys stay on
          PitchFlare encrypted at rest, and every enriched field shows a
          source badge on the contact profile so you can tell what came
          from where.
        </p>
      </div>

      <div className="rounded-md border border-border bg-accent px-4 py-3 text-xs text-accent-foreground">
        <strong className="text-brand-navy">Transparent sourcing.</strong> We
        never resell or mark up partner data. You connect your own account,
        we run lookups on your behalf, credits come out of your plan with
        the partner. Keys are encrypted AES-256-GCM with a server-held
        master key.
      </div>

      <PartnerCards cards={cards} />
    </div>
  );
}
