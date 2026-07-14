"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { generateCampaignBrief, type CampaignBrief } from "@/lib/campaigns/ai";

type Props = {
  campaignId: string;
  initialBrief: CampaignBrief | null;
  initialGeneratedAt: string | null;
  initialModelUsed: string | null;
};

export function CampaignBriefCard({
  campaignId,
  initialBrief,
  initialGeneratedAt,
  initialModelUsed,
}: Props) {
  const router = useRouter();
  const [brief, setBrief] = useState<CampaignBrief | null>(initialBrief);
  const [generatedAt, setGeneratedAt] = useState<string | null>(
    initialGeneratedAt,
  );
  const [modelUsed, setModelUsed] = useState<string | null>(initialModelUsed);
  const [useOpus, setUseOpus] = useState(false);
  const [generating, startGenerate] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleGenerate() {
    setError(null);
    startGenerate(async () => {
      const res = await generateCampaignBrief({ campaignId, useOpus });
      if (!res.ok) {
        setError(res.error);
      } else {
        setBrief(res.brief);
        setGeneratedAt(res.generatedAt);
        setModelUsed(useOpus ? "opus" : "sonnet");
        router.refresh();
      }
    });
  }

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-lg text-brand-navy">
            Campaign brief
          </h2>
          <p className="text-xs text-muted-foreground">
            {brief
              ? "Claude's read of your setup. Regenerate after changing the campaign fields."
              : "Generate a synthesized brief from your campaign setup and brand context."}
          </p>
        </div>
        <label className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={useOpus}
            onChange={(e) => setUseOpus(e.target.checked)}
          />
          Use Opus
        </label>
      </div>

      <button
        type="button"
        onClick={handleGenerate}
        disabled={generating}
        className="mt-3 w-full rounded-lg bg-brand-pink px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-60"
      >
        {generating
          ? "Generating brief…"
          : brief
            ? "↻ Regenerate brief"
            : "✦ Generate campaign brief"}
      </button>

      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}

      {brief && (
        <div className="mt-4 space-y-4 text-sm text-brand-navy">
          <BriefSection title="Positioning">
            <p>{brief.positioning}</p>
          </BriefSection>

          <BriefSection title="Key narratives">
            <ul className="list-disc space-y-1 pl-5">
              {brief.keyNarratives.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          </BriefSection>

          <BriefSection title="Audience snapshot">
            <p>{brief.audienceSnapshot}</p>
          </BriefSection>

          <BriefSection title="Competitive context">
            <p>{brief.competitiveContext}</p>
          </BriefSection>

          {brief.risks.length > 0 && (
            <BriefSection title="Risks">
              <ul className="list-disc space-y-1 pl-5 text-destructive">
                {brief.risks.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </BriefSection>
          )}

          <BriefSection title="Recommended next steps">
            <ul className="list-disc space-y-1 pl-5">
              {brief.recommendedNextSteps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </BriefSection>

          {generatedAt && (
            <p className="pt-1 text-[11px] text-muted-foreground">
              Generated {new Date(generatedAt).toLocaleString()}
              {modelUsed ? ` · ${modelUsed}` : ""}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function BriefSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <div className="mt-1">{children}</div>
    </div>
  );
}
