import { requireTenant } from "@/lib/auth/tenant";
import { getBrandContextForAI } from "@/lib/brand/context";
import { computeBrandCompletion } from "@/lib/brand/completion";
import { BrandBasicsForm } from "@/components/brand/brand-basics-form";
import { BrandVoiceForm } from "@/components/brand/brand-voice-form";
import { BrandBoilerplateForm } from "@/components/brand/brand-boilerplate-form";
import { BrandExamplesList } from "@/components/brand/brand-examples-list";
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

  const [ctx, examples] = await Promise.all([
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
  ]);

  const completion = computeBrandCompletion(ctx);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="font-display text-4xl text-brand-navy">Level-Set</h1>
        <p className="mt-1 text-muted-foreground">
          Lock in everything the AI needs to speak for {tenant.brand.name}.
          Every field auto-saves.
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
          logoUrl: "",
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

      <BrandExamplesList brandId={brandId} initial={examples} />
    </div>
  );
}
