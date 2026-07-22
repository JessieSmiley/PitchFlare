import { requireTenant } from "@/lib/auth/tenant";
import { getBrandContextForAI } from "@/lib/brand/context";
import { computeBrandCompletion } from "@/lib/brand/completion";
import { BrandBasicsForm } from "@/components/brand/brand-basics-form";
import { BrandVoiceForm } from "@/components/brand/brand-voice-form";
import { BrandBoilerplateForm } from "@/components/brand/brand-boilerplate-form";
import { BrandExamplesList } from "@/components/brand/brand-examples-list";
import { BrandPillarsList } from "@/components/brand/brand-pillars-list";
import { BrandSpokespeopleList } from "@/components/brand/brand-spokespeople-list";
import { BrandProductsList } from "@/components/brand/brand-products-list";
import { BrandCompetitorsList } from "@/components/brand/brand-competitors-list";
import { CompletionMeter } from "@/components/brand/completion-meter";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function LevelSetPage() {
  const tenant = await requireTenant();
  if (!tenant.brand) {
    return (
      <p className="text-sm text-muted-foreground">Pick a brand first.</p>
    );
  }
  const brandId = tenant.brand.id;

  const [ctx, examples, pillars, spokespeople, products, competitors] =
    await Promise.all([
      getBrandContextForAI(brandId),
      db.brandExample.findMany({
        where: { brandId },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          title: true,
          url: true,
          description: true,
          emulate: true,
        },
      }),
      db.messagingPillar.findMany({
        where: { brandId },
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          title: true,
          description: true,
          talkingPoints: true,
        },
      }),
      db.spokesperson.findMany({
        where: { brandId },
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, title: true, bio: true },
      }),
      db.product.findMany({
        where: { brandId },
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, description: true },
      }),
      db.competitor.findMany({
        where: { brandId },
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, domain: true },
      }),
    ]);

  const completion = computeBrandCompletion(ctx);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-brand-pink">
          Brand profile
        </p>
        <h1 className="font-display text-4xl text-brand-navy">
          {tenant.brand.name}
        </h1>
        <p className="mt-1 text-muted-foreground">
          Lock in everything the AI needs to speak for {tenant.brand.name}.
          Every field auto-saves — switch brands anytime from the sidebar and
          come right back.
        </p>
      </div>

      <CompletionMeter result={completion} />

      <BrandBasicsForm
        brandId={brandId}
        initial={{
          name: ctx.brand.name,
          description: ctx.brand.description ?? "",
          website: ctx.brand.website ?? "",
          category: ctx.brand.category ?? "",
          logoUrl: ctx.brand.logoUrl ?? "",
        }}
      />

      <BrandVoiceForm
        brandId={brandId}
        website={ctx.brand.website}
        initial={{
          toneAttributes: ctx.voice.toneAttributes,
          bannedWords: ctx.voice.bannedWords,
          alwaysDo: ctx.voice.alwaysDo ?? "",
          neverDo: ctx.voice.neverDo ?? "",
          styleNotes: ctx.voice.styleNotes ?? "",
          sampleCorpus: ctx.voice.sampleCorpus ?? "",
        }}
      />

      <BrandBoilerplateForm
        brandId={brandId}
        initial={ctx.defaultBoilerplate ?? ""}
      />

      <BrandPillarsList brandId={brandId} initial={pillars} />
      <BrandSpokespeopleList brandId={brandId} initial={spokespeople} />
      <BrandProductsList brandId={brandId} initial={products} />
      <BrandCompetitorsList brandId={brandId} initial={competitors} />

      <BrandExamplesList brandId={brandId} initial={examples} />
    </div>
  );
}
